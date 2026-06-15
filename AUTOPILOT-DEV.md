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

---

## Iteration 33 — input-hardening completeness audit (clean; recorded to avoid re-tread)

Per the brief's "out of safe work → completeness-audit pass rather than invent
risky features." After 5 prior Senior-Dev passes (timeouts, AI cost, cron,
file-serving auth, the merge proposal), I audited the remaining untrusted-input
surfaces for abuse/validation/error-isolation gaps. **All solid — no
shippable fix found.** Recording so a future dev rotation doesn't re-scan the
same ground.

| Surface | Guard verified | File |
|---|---|---|
| Public careers self-apply | zod schema (name/email/phone/url bounded), **honeypot** (`website` max-0), consent gate, **10MB cap**, **PDF type check** (mime or .pdf) | `app/careers/[id]/apply-actions.ts:17-71` |
| Single resume upload | 10MB cap + PDF type check | `candidates/upload/actions.ts:228-229` |
| Bulk resume upload | per-file 10MB + type check, per-file error collection (one bad file doesn't kill the batch) | `candidates/upload/actions.ts:173-174` |
| CSV import | per-row try/catch + `continue` (one bad row logged & skipped, not fatal), own RFC-4180-ish parser, 5MB cap, missing-fullName guard | `candidates/import/actions.ts:41-108` |
| File serving | per-role authorization (admin/hr full, hr_lite own-upload, vendor own-account, client own-job-packets), outer try/catch, 404 on missing | `api/files/[fileId]/route.ts:53-90` (audited iter 28) |

**Conclusion:** the untrusted-input hardening surface is comprehensive — size
caps, type checks, honeypot, consent, schema validation, and per-item error
isolation are all present and consistent. The codebase was built defensively;
the Senior-Dev lens has now swept network I/O (iters 8, 28), AI cost (18), cron
resilience (23), and input hardening (33) and found everything either already
solid or fixed.

**Remaining real Senior-Dev work is the two SUPERVISED proposals above**
(fix-types TRUNCATE, atomic merge) — both need a human-in-the-loop session, not
an unattended ship. Future unsupervised dev rotations are into diminishing
returns; highest value is verifying new code as features land, not hunting the
(now well-swept) existing surface.

**No code changed this iteration (completeness-audit pass).**

---

## Iteration 48 — numeric-edge audit (division-by-zero / Math.max-of-empty): clean

Scanned the two classes most likely to surface a `NaN`/`±Infinity` rendering or
logic bug. Both came up **correctly guarded** — recording so future dev
rotations don't re-chase them, and noting the pattern the codebase uses.

- **Division-by-zero in reports/metrics:** every percentage/ratio divisor is
  protected. `lib/metrics.ts` uses explicit `denominator > 0 ? … : 0` (lines
  154/230/282/414). `app/(app)/reports/page.tsx` floors bar-width divisors with
  `Math.max(1, …)` (sourceMax/locationMax/the per-chart `max` at 62/63/149/467)
  and guards the one without a Math.max via `totals > 0 ?` (418). No NaN width
  reaches the DOM even on an empty/new instance.
- **`Math.max(...spread)` of a possibly-empty array → `-Infinity`:**
  `lib/parse.ts:145` does `Math.max(...filtered)` with no seed, so an empty
  filter yields `-Infinity` — but line 146 immediately guards it
  (`Number.isFinite(max) && max > 0 ? String(max) : null`), so it correctly
  returns null. Not a bug.

**Conclusion:** numeric-edge handling is consistent and defensive. With this,
the Senior-Dev lens has swept network I/O (8, 28), AI cost (18), cron (23),
input hardening (33), React keys + N+1 (38, 43), and numeric edges (48). The
existing-surface audit is comprehensive; remaining real dev work is the two
supervised proposals at the top of this file.

**No code changed this iteration (completeness-audit pass).**

> **Iter 53 — two more classes checked clean (no separate section warranted):**
> (a) unhandled promise rejections — every `.then((r)=>r[0])` is inside an
> `await Promise.all`, and the one fire-and-forget-looking call
> (`bulk-actions.ts:139` Drive delete) is awaited and uses the two-arg
> `.then(ok, err)` form, so nothing is unhandled. (b) `process.env` derefs —
> none used without a fallback/guard. The swept surface now also covers
> promise-rejection and env-var classes. Stop-signal honored: not writing a
> full audit section for a clean result.
