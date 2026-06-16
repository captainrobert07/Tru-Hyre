# Autopilot handoff — start here

One page to resume this work without reading the 11 `AUTOPILOT-*.md` logs.
**Refreshed at iteration 100** (was iter 60). Everything the ~100-iteration
quality run shipped is live: typography, crash instrumentation, connector/Drive
timeouts, AI cost cap, cron isolation, dark-mode, the **stored-XSS fix** (R9,
the highest-severity self-found issue), a full **accessibility track** (5 WCAG
criteria: label sweep, focus-trap, reduced-motion, skip-link/landmark,
active-nav — desktop + mobile), perf N+1 collapses, and a **22-spec E2E suite**.

**Prod-state caveat (read this):** `main` is occasionally *ahead* of prod by a
few commits when the Vercel free-tier deploy quota is exhausted (see Operational
notes / R10). When that happens the gap is **doc-only or type-only** commits
(byte-identical emitted JS), so prod runtime is current even when the SHA isn't.
The last user-facing code shipped clean to prod; check the tail of
`AUTOPILOT-LOG.md` for any line flagged `prod-deferred-quota` to see exactly
what's pending a deploy.

## The autonomous run has saturated. Four items remain — all need a human.

The strategist recorded a **saturation verdict at iteration 99**
(`AUTOPILOT-STRATEGY.md`): the code is hardened, the docs are complete, and the
marginal autonomous iteration now produces polish/meta-work rather than risk
reduction. The highest-leverage next move is human/sponsor action on the four
items below — each was deliberately NOT auto-shipped (deploy-critical /
destructive / auth trust boundary / plan-tier decision). Verified accurate
against current code at iter 100.

### R1 — Defuse the `fix-types.ts` TRUNCATE (do FIRST; before real prod data)
- **What:** `db/fix-types.ts:78,87` run `TRUNCATE TABLE resume_files/client_packets
  CASCADE` during `vercel-build` when legacy `blob_*` columns are detected.
  No-op today, but a DB restore / old-schema branch deploy re-arms it →
  silent loss of every uploaded resume on the next deploy.
- **Severity:** Critical (irreversible prod data loss), Low likelihood.
- **Fix:** before each TRUNCATE, count rows; if >0, require an explicit
  `ALLOW_FIXTYPES_TRUNCATE=1` env flag and loudly log, else `process.exit(1)`.
  Better long-term: gate the whole one-shot script behind a flag or delete it
  (its migration has already run in prod). Details: `AUTOPILOT-DEV.md` iter 3.
- **Effort:** human ~1h / supervised CC ~20m + a Vercel verify. **Touches the
  deploy path — verify on a preview before main.**

### R2 — Make the candidate merge atomic
- **What:** `app/(app)/candidates/duplicates/merge-actions.ts` runs an
  irreversible merge as a sequence of independent statements (reparent 11 child
  tables → delete loser) with NO transaction. Mid-run failure = partial
  corruption of a candidate's record graph.
- **Severity:** High (irreversible partial corruption), Low likelihood (admin
  action, rare).
- **Fix:** the driver is **neon-http** (`db/index.ts`) — `db.transaction()` is
  NOT supported and would fail at runtime. Use `db.batch([...])` (atomic) or a
  raw `BEGIN; …; COMMIT;`. Keep the pre-merge reads outside the batch. Add a
  merge-integrity test (loser gone + all children point at winner). Details:
  `AUTOPILOT-DEV.md` iter 13.
- **Effort:** human ~2-3h / supervised CC ~30m + a destructive-path test.

### R3 — Azure AD (Entra ID) SSO  (the #1 adoption gate)
- **What:** no SSO → a regulated insurer won't run recruiting on email/password,
  so the tool stays in pilot purgatory. `auth.config.ts:102` `providers: []` is
  an empty drop-in slot; the jwt callback already heals identity by email, so an
  Entra login matching a provisioned user inherits the right role automatically.
- **Severity:** High × High (blocks all real adoption).
- **Fix:** add `MicrosoftEntraID` to `auth.ts` providers with tenant/client
  secrets; decide reject-vs-auto-provision (recommend strict + admin invites);
  add a "Sign in with Microsoft" button; keep credentials as fallback. Details:
  `AUTOPILOT-PM.md` iter 5 + `AUTOPILOT-STRATEGY.md` build-vs-buy.
- **Effort:** human ~1-2d (mostly the Azure app registration + IT approval) /
  supervised CC ~30-60m once the tenant + secrets exist. **Auth trust boundary —
  re-run the auth reasoning.**

### R10 — Upgrade the deploy tier (sponsor/ops, not eng; can run in parallel)
- **What:** Vercel free tier caps at **100 deploys/day**; once hit it returns
  `payment_required` and blocks ALL production deploys for ~24h. Observed live
  and **exhausted twice in a single session** during this run — it toggles
  within hours on an active dev day.
- **Severity:** Medium × Medium — no standalone user outage, but for an internal
  tool that must be hotfix-deployable in EU business hours it's an **MTTR /
  availability risk**: you can't ship an urgent fix while quota-locked.
- **Fix:** move to a paid Vercel plan (or an Allianz-hosted runner) before
  go-live. It's a **plan-tier line item, not eng work** — the cheapest item here
  to retire. Details: `AUTOPILOT-STRATEGY.md` R10 (iter 94) + PM board P2 #13.
- **Effort:** one sponsor decision; ~0 eng.

## Recommended order
**R1 → R2 → R3, with R10 in parallel.** R1 and R2 make the tool safe to put real
Allianz data into; R3 makes it approvable to roll out; R10 is a one-line
plan-tier call a sponsor can clear independently before go-live. (PM action
board P0→P1, P2 #13.)

## Operational notes
- **Deploy quota:** Vercel free tier = 100 deploys/day. The run saturated it
  (~iters 43-51); main→prod auto-deploy stalls when exhausted. If running more
  unattended work, batch deploys (don't deploy every commit). See
  `AUTOPILOT-PM.md` iter 45.
- **Verify means SHA:** "green on Vercel" = the *production* deploy's commit SHA
  matches `main`, not merely "a build went green." (Learned the hard way iter 43.)
- **Deeper context:** `AUTOPILOT-RETRO.md` (state of run), `AUTOPILOT-STRATEGY.md`
  (risk register **R1-R10** + ROI + pilot scorecard + the **iter-99 saturation
  verdict**), `AUTOPILOT-PM.md` (action board, P0→P2 #13), `AUTOPILOT-INDEX.md`
  (doc map). If resuming the loop: the lens rotation + tail of `AUTOPILOT-LOG.md`
  tell you which lens is next; but per iter 99, prefer a supervised session on
  the four items above over another autonomous lap unless there's new pilot data.

**No application code changed this iteration (PM handoff-doc refresh, iter 60→100).**
