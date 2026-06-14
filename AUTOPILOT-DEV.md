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
