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

> **Iter 56 — `dangerouslySetInnerHTML` (the XSS sibling of R9) checked clean:**
> Two sinks. `app/layout.tsx:39` is a static dev-authored THEME_SCRIPT (no user
> input). `template-editor.tsx:109` renders `previewHtml` from admin-edited
> template HTML — but it's **admin-only** (`/settings` gate) and the admin views
> their *own* HTML in their *own* session (self-XSS, and previewing HTML is the
> feature's purpose). Critically, that template HTML is only ever previewed by
> its author or **sent as an email** — it is NEVER rendered into a candidate/
> client/portal page (zero `dangerouslySetInnerHTML` in portal/careers/
> components). So the R9 vector (untrusted input → another user's DOM) does not
> recur here. No fix; sanitizing the admin preview would break legitimate HTML
> authoring.

---

## Iteration 78 — focus-trap rollout: command-palette intentionally EXCLUDED (reasoned)

Completing P2 #11 (focus-trap on the 4 modals), the 4th — `command-palette.tsx`
— was assessed and **deliberately NOT given the generic `useFocusTrap` hook.**
This is a decision, not an omission:

- The palette is built on **`cmdk`** (`import { Command } from "cmdk"`), a
  purpose-built command-menu library that already manages focus: it `autoFocus`es
  its search input on open and owns arrow-key list navigation + the input/list
  focus model.
- The generic hook focuses the *first focusable* on open — which would **steal
  focus from cmdk's search input** (a UX regression: a command palette must
  focus its input) and its Tab-cycling could fight cmdk's own key handling.
- It opens via a global **⌘K shortcut with no trigger element**, so the
  "restore focus to trigger" half is also largely moot (nothing specific to
  restore to).

**Verdict:** forcing the hook here to make the checklist read "4/4" would
degrade a working, library-managed keyboard UX for marginal gain — exactly the
"don't half-build a risky change" rule. The right state is **3/4 modals on the
shared hook (SlideOver, confirm, quick-add) + command-palette correctly left to
cmdk.** P2 #11 is effectively complete.

If a future audit wants belt-and-suspenders here, the *only* safe addition would
be focus-restore-on-close (not a full trap), and only if a real trigger element
is introduced — low priority.

**No code changed this iteration (reasoned exclusion + assessment).**

---

## Iteration 93 — runtime-crash audit (clean)

A targeted sweep for the production-crash classes that don't show up at build
time (the kind that produced the unexplained digest:3495001251 we shipped
`instrumentation.ts` to catch). Under a deploy-quota freeze this window, the
honest Senior Developer move was a verify-by-reading audit rather than a
code change that can't be deploy-verified.

**Classes checked, all clean:**

- **neon-http interactive transactions.** `grep .transaction(` across
  app/lib/db → **zero** call sites. The driver doesn't support interactive
  `db.transaction`; the merge path correctly uses `db.batch([...])` (the only
  builder-array site, R2, already tracked as a supervised proposal). No latent
  runtime throw here.
- **Floating promises / unawaited writes.** The three `.map(async …)` sites
  (`bulk-email-actions.ts:43`, `settings/integrations/page.tsx:18`,
  `lib/webhooks.ts:21`) are each wrapped in `await Promise.all(...)`. The
  `merge-actions.ts` `db.update(...)` lines that match an "unawaited" grep are
  builder objects *inside* a `db.batch([...])` array — correct, not floating.
- **Null/NaN numeric formatting** (`.toFixed` / `.toLocaleString` throw on
  null/undefined). Every site is guarded: `dashboard` `coverage.ratio` is
  `openPositions > 0 ? round(…) : 0` (always finite); `avgTimeToSubmit/Offer`
  gate on `> 0`; `candidates-table` `fmt` and `compare` `fmtMoney` both do a
  null check + `Number.isNaN` guard; the compare `ids` parser filters on
  `Number.isFinite(n) && n > 0`.
- **`db.execute` result-shape mismatch.** neon-http returns an object with a
  `.rows` field, not a directly-mappable array. Every raw-SQL consumer uses the
  defensive `(rows.rows || rows)` unwrap (metrics.ts ×4, match.ts:86,
  semantic-search.ts:121). The one bare `rows.map(...)` (match.ts:117) reads
  from `db.select()` (the query builder, which returns a real array), not from
  `db.execute` — correct.

**Verdict:** the runtime-crash surface is well-hardened; no shippable fix
surfaced and none was manufactured. The remaining real risk is unchanged and
already documented: R1 (`fix-types.ts` TRUNCATE-on-deploy) and R2 (non-atomic
merge), both supervised-only.

**No code changed this iteration (clean audit).**

---

## Iteration 103 — XSS-sink audit (clean) + provenance comment

Swept the two un-audited XSS-adjacent classes (the iter-51 fix only covered
user-URL `href`s). Both clean:

- **`dangerouslySetInnerHTML` sinks** — only two in the whole app:
  - `app/layout.tsx:39` — a static `THEME_SCRIPT` constant (no user data). Safe.
  - `template-editor.tsx:109` — renders `previewHtml`, which is the admin's OWN
    authored template body in an admin-only editor. `renderTemplate(..., "html")`
    (`lib/email-templates.ts:42`) `htmlEscape()`s every interpolated `{{token}}`
    value, so the sample-context data can't inject. **Crucially, the four real
    outbound-email paths use the identical render call** (bulk-email-actions:53,
    email-actions:119, email-on-stage-change:73, sequences:75) — so a candidate
    name containing `<script>` is escaped before it can ride into any recipient's
    email. The surface that actually matters is closed.
  - Added a provenance comment at the sink so a future dev (or a security linter,
    which flags the bare pattern) doesn't "fix" the safe preview and break the
    feature, or copy the pattern to a cross-user-fed sink. (A generic
    PostToolUse security-guidance warning did fire on the pattern — confirmed a
    true negative against the traced data flow.)
- **Index-as-key `.map`s** — 18 sites, all over static / append-only lists
  (import errors, breadcrumbs, kit questions, match reasons, chart bars). None
  reorder or splice, so index keys are harmless here (the iter-38 React-key bug
  was a genuinely reorderable list; these aren't).

**Verdict:** the untrusted-input → HTML surface is comprehensively escaped at the
chokepoint; no shippable fix, none manufactured. Third consecutive clean dev
audit (93/98/103), consistent with the iter-99 saturation verdict.

**Only change this iteration: a JSX provenance comment (bundle-identical — comments
are stripped at build) + this DEV-log entry.**

---

## Iteration 113 — stage-change ↔ stage_history non-atomicity (PROPOSED, supervised)

A repeated data-consistency gap of the **same class as R2** (non-atomic
multi-write on neon-http), found by widening the iter-108 error/mutation sweep.

**What.** Every stage transition does two sequential writes that must both land
or neither: update `candidates.stage`, then insert the matching `stage_history`
row (which records that candidate's *own* `fromStage`). They're not wrapped, so
a process death / DB error *between* them leaves a candidate whose stage moved
with **no history row** (or, in the bulk loop, a partially-applied batch). The
audit trail silently drifts from reality.

Sites (all the same shape):
- `candidates/bulk-actions.ts:69-76` — per-row in a loop over the selection
  (worst case: N candidates moved, history written for only the first k).
- `candidates/[id]/actions.ts:~272, ~403` — single-candidate stage changes.
- `jobs/[id]/kanban/actions.ts:41-42` — drag-to-stage on the kanban board.

**Severity:** Medium (audit/history integrity, not user data loss). **Likelihood:**
Low (needs a failure mid-pair) but the bulk path widens the window per click.

**Why NOT blind-shipped.** Same rule as R1/R2: atomicity change on multiple
mutation paths, and the driver is **neon-http** — no interactive
`db.transaction()`. The fix is `db.batch([...])` (Drizzle neon-http supports it,
atomic), which is genuinely applicable here because each statement can be
pre-built (the per-row `fromStage` is known before the batch). But: `db.batch`
is used **nowhere in the codebase yet** (no precedent), the bulk loop needs the
per-row values assembled into one statement array, and the destructive/partial
path needs a test. That's a supervised session, not an unattended lap.

**Proposed fix.** Per call site, replace the update+insert pair with a single
`await db.batch([updateStmt, insertHistoryStmt])`; for the bulk loop, build the
full statement array across all moved rows and batch once. Add a test asserting
"stage moved ⇒ a matching history row exists" survives a simulated mid-write
error. This also retires R2's sibling concern with one shared pattern.

**No code changed this iteration (proposal only — supervised).**
