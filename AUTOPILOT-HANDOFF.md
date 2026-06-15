# Autopilot handoff — start here

One page to resume this work without reading the 11 `AUTOPILOT-*.md` logs.
Written at iteration 60. **Production is current and healthy** — everything the
59-iteration quality run shipped is live (typography, crash instrumentation,
connector/Drive timeouts, AI cost cap, cron isolation, dark-mode, a11y sweep,
the stored-XSS fix, 15 E2E specs). `main` == prod.

## The autonomous run is done. Three items remain — all need a human.

Each was deliberately NOT auto-shipped (deploy-critical / destructive / auth
trust boundary). Verified still-accurate against current code at iter 60.

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

## Recommended order
**R1 → R2 → R3.** R1 and R2 make the tool safe to put real Allianz data into;
R3 makes it approvable to roll out. (PM action board P0→P1.)

## Operational notes
- **Deploy quota:** Vercel free tier = 100 deploys/day. The run saturated it
  (~iters 43-51); main→prod auto-deploy stalls when exhausted. If running more
  unattended work, batch deploys (don't deploy every commit). See
  `AUTOPILOT-PM.md` iter 45.
- **Verify means SHA:** "green on Vercel" = the *production* deploy's commit SHA
  matches `main`, not merely "a build went green." (Learned the hard way iter 43.)
- **Deeper context:** `AUTOPILOT-RETRO.md` (state of run), `AUTOPILOT-STRATEGY.md`
  (risk register R1-R9 + ROI + pilot scorecard), `AUTOPILOT-INDEX.md` (doc map).

**No application code changed this iteration (PM handoff-doc).**
