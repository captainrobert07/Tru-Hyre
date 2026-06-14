# Autopilot — Senior Developer log & proposals

Per-iteration findings from the Senior Developer lens. Clearly-correct
behavior-preserving fixes ship directly; anything that touches the
deploy-critical path or can't be verified on this machine is PROPOSED here
for a supervised session (per AUTOPILOT-24H.md safety rails).

---

## Iteration 3 — code audit (clean) + one real data-loss bug (PROPOSED)

### Audit result: codebase is genuinely tidy
Scanned the usual Senior-Dev targets and found **no** clearly-correct
ship-now bugfix:
- **Perf / waterfalls:** candidate detail page (the heaviest) already batches
  with two `Promise.all` blocks (`app/(app)/candidates/[id]/page.tsx:60,94`).
  No N+1 / unbatched-await hotspots found in render paths.
- **Dead code / type holes:** zero `TODO/FIXME/HACK`, zero `@ts-ignore`,
  zero `as any` across `app/ lib/ components/`.
- **Numeric coercion:** id/page parsing is guarded everywhere checked —
  `candidates/[id]/page.tsx:50` (`Number.isFinite || notFound`),
  `candidates/compare/page.tsx:26` (`isFinite && >0` filter),
  `lib/list-params.ts:15` (`Math.max(1, floor(... || 1))`).
- **Suspected RBAC leak on /candidates/compare — FALSE ALARM.** The compare
  query has no `uploadedById` filter, but the page is gated by
  `requireStaff()` (`lib/rbac.ts:31`), which redirects `hr_lite` away.
  Only admin/hr reach it. Cross-tenant isolation holds.

### Real bug found (NOT shipped — too risky to blind-build): `db/fix-types.ts` TRUNCATEs prod tables on deploy

**What:** `db/fix-types.ts` runs first in `vercel-build`
(`tsx db/fix-types.ts && drizzle-kit push --force && tsx db/seed.ts && next build`).
For `resume_files` and `client_packets`, when it detects legacy `blob_*`
columns it runs:

```
fix-types.ts:78  TRUNCATE TABLE resume_files CASCADE      (hasLegacy && !hasNew)
fix-types.ts:87  TRUNCATE TABLE resume_files CASCADE      (hasLegacy && hasNew, half-migrated)
```

**Why it's dangerous:** `TRUNCATE ... CASCADE` deletes every row in those
tables (and cascades to dependents) with no row-count guard and no backup.
Today it's a no-op because prod already migrated to `drive_file_id` (the
`!hasLegacy && hasNew` branch at :91). But the branch stays armed: any event
that reintroduces a `blob_*` column — a DB restore from an old snapshot, a
branch deploy off an older schema, a manual hotfix, a Neon point-in-time
recovery — silently wipes every uploaded resume + client packet on the next
deploy. Silent destructive data loss on the deploy path is exactly what the
safety rails forbid ("never delete user-facing data").

**Severity:** High (irreversible prod data loss) × Low (likelihood today,
since the trigger requires schema regression). Net: a latent landmine worth
defusing before it's forgotten.

**Proposed fix (safe, needs a supervised session + Vercel verify):**
1. Before either TRUNCATE, count rows. If `count > 0`, do NOT truncate
   silently — require an explicit `ALLOW_FIXTYPES_TRUNCATE=1` env flag and
   loudly log the row count being destroyed. Without the flag, `console.error`
   a clear message and `process.exit(1)` so the deploy fails visibly rather
   than wiping data. An empty table truncates freely (the common case).
2. Better long-term: this whole file is a one-shot migration that has already
   run in prod. Once confirmed every environment is on `drive_file_id`, gate
   the entire script behind a `RUN_LEGACY_FIXTYPES=1` flag (default off) or
   delete it, so it can never fire again. Keep `drizzle-kit push` as the
   ongoing migration mechanism.
3. If a real legacy→drive data migration is ever needed again, migrate the
   data (map old blob refs → drive ids) instead of truncating.

**Why proposed, not shipped:** edits the deploy-critical migration path. A
subtle error (wrong env-var name, exit-code logic, an ALTER ordering bug)
breaks *every* future deploy, and there's no local typecheck/DB here to
verify it — only push-and-pray on prod. This is precisely the "too big/risky
to finish safely in one iteration → write it down" case from the brief.

**Files:** `db/fix-types.ts:76-95`, `package.json:17` (`vercel-build`).

---

## Iteration 13 — audit (clean) + candidate-merge non-atomicity (PROPOSED)

### Audit result: still tidy
Scanned fresh Senior-Dev classes not covered in iter 3/8:
- **Stale-UI / revalidatePath:** mutating server actions revalidate the right
  paths. The `rev=0` files (`careers/[id]/apply-actions.ts`,
  `careers/vendor-signup/actions.ts`) redirect to a thank-you page, so no
  revalidate is needed — correct, not a gap.
- **Floating promises:** the `db.update(...)` calls that looked unawaited are
  all elements inside a `Promise.all([...])` (merge-actions.ts:37-49) — awaited
  collectively, not floating.
- **`.map(async)` fire-and-forget:** all three sites
  (`bulk-email-actions.ts:43`, `webhooks.ts:21`, `settings/integrations/page.tsx:18`)
  are wrapped in `await Promise.all(...)`. No silent drops.
- **`forEach(async)` no-op trap:** none in the codebase.

### Real bug found (NOT shipped — fix needs the right driver primitive + a destructive-path verify): `mergeCandidatesAction` is non-atomic

**What:** `app/(app)/candidates/duplicates/merge-actions.ts` performs a
destructive, irreversible admin merge as a SEQUENCE of independent statements:
reparent 11 child tables (Promise.all, :37-49) → delete loser scores (:53) →
reparent comments (:55) → backfill winner (:81) → **delete the loser candidate
(:84)**. There is no surrounding transaction.

**Why it's dangerous:** if the function dies mid-sequence (cold-start kill,
network blip to Neon, function timeout), it leaves a partial state — e.g.
children reparented to the winner but the loser row still present, or comments
moved but the winner backfill never applied. For an irreversible merge with no
undo, partial application is a silent data-integrity corruption.

**Why it's NOT a blind fix:** the obvious "wrap in `db.transaction()`" does NOT
work here. The DB client is **neon-http** (`db/index.ts`:
`drizzle(neon(url), ...)` from `drizzle-orm/neon-http`), which has **no
interactive transaction support** — there is no session to hold a `BEGIN/COMMIT`
across calls. Applying `db.transaction()` would fail at runtime or silently
not isolate. Nothing in the codebase uses transactions today, confirming this.

**Proposed fix (supervised — needs a destructive-path test, not blind):**
1. Convert the whole merge to a single atomic unit via **`db.batch([...])`**
   (supported by neon-http: sends all statements in one transactional batch).
   Build the reparents + scores-delete + comments-update + winner-backfill +
   loser-delete as one ordered `db.batch` array so it's all-or-nothing.
   Caveat: ordering matters (backfill reads loser before delete), and
   `db.batch` semantics for read-then-write need verifying — the backfill
   currently reads `loser` BEFORE the batch (lines 29-32), so that read can stay
   outside; only the writes need batching.
2. Alternatively, drop to a raw SQL transaction via the `neon` tagged-template
   in a single multi-statement string (`BEGIN; ...; COMMIT;`).
3. Either way: add an E2E/seeded test that merges two candidates and asserts the
   loser is gone AND every child record points at the winner — a merge bug is
   invisible until someone notices orphaned/lost data weeks later.

**Why proposed:** destructive irreversible admin path + a driver-specific
atomicity primitive + no local DB to verify partial-failure behavior. Exactly
the "write it down rather than half-build on prod" case. Lower likelihood than
the fix-types TRUNCATE (merge is admin-initiated + rare), but higher blast
radius per occurrence (silent corruption of a real candidate's record graph).

**Files:** `app/(app)/candidates/duplicates/merge-actions.ts:29-99`,
`db/index.ts` (neon-http driver).
