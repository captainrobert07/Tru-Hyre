# Autopilot — Product Manager log

Reconcile ROADMAP.md / INTEGRATIONS.md against what's truly built vs scaffold
vs deferred. Flag dishonest "done"s. Propose (don't blind-build) the next
highest-value increment with effort + risk. Tiny doc/honesty fixes may ship;
large features get PROPOSED for a supervised session.

---

## Iteration 5 — honesty audit (passes) + SSO proposal (decision-ready)

### Honesty audit: the docs tell the truth (verified against code, not taken on faith)

I spot-checked the riskiest "stable/done" claims by tracing them to call sites.
No dishonest "done"s found. This is rare and worth stating plainly.

- **HRIS handoff — claim holds.** INTEGRATIONS.md says "stable — POSTs a hire
  record on →joined." Verified: `pushHrisHire()` (`lib/connectors.ts:28`) is
  feature-gated and actually invoked on the `joined` transition
  (`app/(app)/candidates/[id]/actions.ts:307-314`) with a real hire payload.
  Not a stub. (My first grep used a wrong function name and looked like a dead
  wire — tracing the real name `pushHrisHire` confirmed it fires.)
- **Zapier / Slack / webhooks — claims hold.** `pushZapier("candidate.stage_changed")`
  and `notifySlack(...)` and `fireWebhook(...)` all fire on stage change
  (`actions.ts:302-306`). Best-effort, feature-gated, no-op unless configured.
- **Scaffold items are labelled scaffold.** INTEGRATIONS.md explicitly marks
  DocuSign, Outlook/M365 calendar, transcription, background-check, and SSO/2FA
  as **scaffold** (config + Test only), with a per-item "to make functional"
  note. No silent "enter a key and it works" lies.
- **ROADMAP deferred markers are consistent.** SSO (`[~] DEFERRED`), two-way
  Gmail sync (`[~]`, "automatic sync not built"), SMS (`[x]` with "needs env to
  send" caveat), configurable stages (`[~]`, shipped as checklists instead).
  Reality matches the markers.

**Verdict: documentation integrity is strong.** No honesty fix needed this
iteration. The risk here was a false "all done" — checking proved it's honest,
which is the point of the lens.

### Next highest-value increment — PROPOSAL: Azure AD (Entra ID) SSO

Both the strategy lens (iteration 4) and the integrations doc name this as the
#1 adoption blocker for an internal Allianz tool. The PM angle: it's also the
**cheapest high-value increment**, because the auth architecture is already
shaped to accept it.

**Why it's low-code (grounded in the actual auth files):**
- Auth.js v5 (NextAuth) with `providers: []` in `auth.config.ts:102` and a
  Credentials provider in `auth.ts`. Adding a provider is additive.
- The `jwt` callback in `auth.ts` already **heals identity by email on every
  request** — it looks up the live `users` row by `token.email` and refreshes
  id/role/permissions. So an SSO login whose email matches a provisioned
  `users` row inherits the correct role automatically. No new identity model.
- Role/route enforcement (`auth.config.ts` `authorized`) is role-based, not
  credential-based — it doesn't care *how* you logged in. SSO logins flow
  through it unchanged.

**Scoped plan (for a supervised session — NOT blind-built):**
1. Add `MicrosoftEntraID` provider to `auth.ts` providers array with
   `clientId`/`clientSecret`/`tenantId` from env (mirror the existing
   `integrations`-table + envFallback pattern; the "SSO/2FA" Auth integration
   slot already exists in `lib/integrations.ts`).
2. In `signIn`/`jwt`, map the Entra profile email → existing `users` row.
   **Decision needed:** reject SSO logins with no matching `users` row (strict,
   recommended for a regulated org) vs auto-provision a default-role user
   (convenient, riskier). Recommend **strict + admin invites** to preserve the
   existing invitation flow as the provisioning path.
3. Add a "Sign in with Microsoft" button on `/login`, keep email/password as a
   fallback during rollout (feature-flag the credentials provider off later).
4. Keep `hr_lite`/role logic untouched — roles still come from the `users` row.

**Effort:** human ~1-2 days (mostly the Azure app registration + IT approval +
testing the tenant); **CC ~30-60 min of code** once the tenant/secrets exist.
The bottleneck is org-side, not engineering.

**Risk:** Medium. Touches the auth trust boundary, so per the safety rails it
requires re-running the auth reasoning and a supervised deploy — explicitly
NOT an unattended-autopilot change. Mitigated by: additive provider (credentials
path stays as fallback), no change to the role model, and the email-keyed
identity heal already in place.

**Dependencies (org, not code):** an Entra app registration in Allianz's
tenant, redirect URI allow-listing, and `clientId/secret/tenantId` in Vercel
env. Without these, SSO can't be tested — which is exactly why it's a
supervised increment, not an autopilot one.

### What I am explicitly NOT proposing
- No new feature breadth (the strategy lens established the portfolio is already
  wider than an internal team needs).
- Not auto-building SSO tonight — auth trust boundary + external tenant deps +
  no local verify = supervised only.

**No code changed this iteration (PM analysis + proposal lens).**

---

## Iteration 10 — README honesty sync (SHIPPED — a doc-only fix the lens permits)

Iteration 5 audited the *feature* docs (ROADMAP/INTEGRATIONS) and found them
honest. This iteration audited the **README** — the most-read doc, the first
thing a new dev or reviewer sees — and it had drifted materially from shipped
reality. Verified each claim against code before fixing:

| README claimed | Reality (verified) | Fix |
|---|---|---|
| "Vercel Blob — resume PDFs" (×3) | `lib/drive.ts` uses `googleapis` Drive; the whole `fix-types.ts` blob→drive migration happened | → Google Drive (service account) |
| Set `BLOB_READ_WRITE_TOKEN` in setup + deploy | No Blob anywhere; storage is `GOOGLE_SERVICE_ACCOUNT_JSON` + `GDRIVE_RESUMES_FOLDER_ID` | → correct env vars |
| "Resend — transactional email" | `lib/email.ts` is nodemailer + Gmail SMTP | → Gmail SMTP (nodemailer) |
| "An Allianz HR Platform — Project by Kris" (title + footer) | Compliance scrub (commit f1af46c) removed all company-name refs; the seed actively neutralizes this exact string | → "An internal hiring platform" |
| `.env.example` `APP_TAGLINE` carried the same scrubbed string | same compliance issue, second file | → scrubbed |
| First build runs `pnpm db:push && pnpm db:seed` | actual `vercel-build`: fix-types → drizzle-kit push → seed → next build | → real chain |

**Why this matters (PM framing):** a dishonest README is worse than no README.
It told a new dev to provision a Blob store and a Resend account that don't
exist, and it reintroduced the exact company-name string the codebase spent a
commit scrubbing for compliance — in the one file most likely to be read first.
This is the same "honest done" discipline as iter 5, applied to onboarding docs.

**Shippable (not a proposal):** docs-only, zero code/runtime risk, verified
against the actual `lib/` + `package.json` + `.env.example`. Shipped this
iteration.

**Still NOT touched:** the `db/fix-types.ts` TRUNCATE fix (AUTOPILOT-DEV.md) and
SSO (above) remain supervised-only proposals.

---

## Iteration 15 — the single prioritized action board (reconcile everything)

By rotation 3 the autopilot has surfaced findings across four docs (DEV,
STRATEGY, PM) plus the deferred ROADMAP tail. The PM job now isn't another
analysis — it's to **reconcile them into one ranked "do this next" list** so the
user has a single decision surface at breakfast instead of four. Ordered by
(blast-radius × likelihood) for fixes and (adoption-unlock × effort) for
features. Effort is dual-scaled (human team / supervised CC session).

### P0 — do before real Allianz data goes in (correctness & safety gates)
| # | Item | Why P0 | Effort | Source |
|---|---|---|---|---|
| 1 | **Defuse `fix-types.ts` TRUNCATE** | Irreversible silent prod data-loss landmine on the deploy path; arms on any schema regression | human ~1h / CC ~20m + verify | AUTOPILOT-DEV.md iter 3 |
| 2 | **Atomic candidate merge** | Irreversible admin merge is non-atomic → partial corruption on mid-run death; needs neon-http `db.batch` (not `db.transaction`) | human ~2-3h / CC ~30m + destructive-path test | AUTOPILOT-DEV.md iter 13 |
| 3 | **Read the digest crash logs** | `instrumentation.ts` (shipped iter 1) now captures the real stack of digest:3495001251 — wait for it to fire, then one-line fix the actual throw | passive → ~15m when it fires | iter 1 + investigation |

P0 rationale: 1 and 2 are both "irreversible data loss with no undo." They're
low-likelihood today but the cost per occurrence is unrecoverable, and real
production data raises the stakes. Fix the landmines before loading the truck.

### P1 — adoption gates (nothing scales without these; pilot-purgatory exits)
| # | Item | Why P1 | Effort | Source |
|---|---|---|---|---|
| 4 | **Azure AD SSO** | #1 adoption blocker; a regulated insurer won't run recruiting on email/password. Low-code (Auth.js drop-in) — bottleneck is the Azure tenant/IT approval | human ~1-2d (mostly org) / CC ~30-60m | PM iter 5, STRATEGY iter 4/14 |
| 5 | **Real HRIS/Workday handoff** | The `joined`→HRIS POST fires (verified iter 5), but a real Workday sync is scaffold; re-keying hires kills adoption | human ~2-4d / CC depends on Workday API access | STRATEGY iter 4, ROADMAP wave 8 |
| 6 | **M365 mail + Teams notifications default-on** | Allianz lives in Microsoft; Gmail SMTP is an odd fit + governance flag. Meet them where they are | human ~1-2d / CC ~1-2h once Graph app exists | STRATEGY iter 9/14 |

### P2 — posture & polish (de-risk + sharpen the moat)
| # | Item | Why P2 | Source |
|---|---|---|---|
| 7 | **State EU data-residency + audit posture** (doc, then enforce) | Compliance sign-off gate; cheap to write, unlocks legal | STRATEGY iter 4/14 |
| 8 | **One-page build-vs-buy memo** (AI econ + residency + zero per-seat) | Arms whoever approves this internally; the moat is economics, not features | STRATEGY iter 14 |
| 9 | **Hide SaaS gold-plating from `/settings/features`** | public_api/Zapier/job-board/vendor-self-onboard — internal teams won't use them; declutters admin | STRATEGY iter 4 |
| 10 | **Instrument displacement** (spreadsheet-death date / time-in-tool) | Measure real adoption, not vanity counts | STRATEGY iter 9 |

### Explicitly DEFER / DON'T do
- **No feature #56.** The portfolio is already wider than an internal team needs
  (STRATEGY iter 4). Resist breadth; deepen the moat.
- **Two-way Gmail IMAP sync, Calendar free/busy, configurable stages** — ROADMAP
  `[~]` items that need external setup for marginal internal value. Leave deferred.

### The one-sentence answer to "what do I do first?"
**Fix the two data-loss landmines (P0 #1-2), then chase SSO (P1 #4) — that
sequence makes the tool safe to put real Allianz data into, then approvable to
roll out. Everything else waits.**

**No code changed this iteration (PM reconciliation/analysis lens).**

---

## Iteration 20 — CHANGELOG (SHIPPED — document the release)

The autopilot run shipped 6 code changes + 4 new E2E specs + a stack of docs
across ~20 iterations, but the repo had **no CHANGELOG** (`package.json` is at
0.1.0, no VERSION file). For an internal tool the changelog isn't ceremony —
it's how the next person (or the user at breakfast) sees what actually changed
without reading 20 commits. The priority board (iter 15) is forward-looking;
this is the backward-looking complement.

**Shipped `CHANGELOG.md`** (Keep-a-Changelog format, pre-1.0 date-stamped):
groups the run's work into Fixed / Added / Changed / Documented, plus an
`[0.1.0] initial build` baseline. The "Documented" section makes the two
supervised proposals (TRUNCATE, merge-atomicity) and the strategy/PM docs
discoverable from one place, so a reviewer lands on the decision queue without
spelunking the AUTOPILOT-*.md files.

**Why doc, not code:** pure documentation, zero runtime risk; the PM lens
explicitly permits doc fixes. Verified against the actual merged commit list
(`git log a388f38..HEAD`) so every entry maps to a real shipped change — no
aspirational entries.

**Recommendation:** when the supervised P0/P1 items land, add a dated section
(e.g. `[0.2.0]`) and bump `package.json`. The changelog is now the spine for
that.

---

## Iteration 25 — AUTOPILOT doc index (SHIPPED — navigability + honest archive)

The repo now has **nine `AUTOPILOT-*.md` files**: five live ones from this
quality run (PM, DEV, STRATEGY, LOG, 24H) and four from the original build phases
(`AUTOPILOT.md`, `-2`, `-3`, `-UX`). A new reader — or the user at breakfast —
can't tell a current proposal from a 2-week-old shipped task list. Stale docs
that read as current are a doc-honesty problem, not just clutter.

**Shipped `AUTOPILOT-INDEX.md`:** a one-screen map splitting the set into
**Live (read these)** — with a one-line "why you'd open it" per doc and "start
at PM.md's action board" — and **Archived build history** — the four old docs,
each verified to carry a `STATUS: … done/shipped` line, so labeling them archive
is honest, not a guess. Includes a flagged-but-not-taken cleanup suggestion
(move to `docs/archive/` or delete) left as a supervised call since deletion is
irreversible.

**Why doc, not code:** pure navigability fix, zero runtime risk; the PM lens
permits doc fixes. I verified the archive claim against each file's own status
line rather than assuming — same honesty discipline as the iter-5/10 audits.

This closes the doc-sprawl loop: iter 15 reconciled the *findings* into one
board; this reconciles the *files* into one map.

---

## Iteration 30 — action-board status refresh (keep the decision surface honest)

The prioritized board (iter 15) is now 14 iterations old. Its **open items are
still accurate** — nothing in P0/P1 was touched, correctly, since they're all
supervised-only (data-loss fixes, SSO). But the board didn't reflect what the
autopilot *closed* in the meantime, and a decision surface that's silently stale
misleads as much as a wrong one. This refresh keeps it honest.

### Still open — unchanged, still the priority (re-confirmed against current main)
- **P0 #1 Defuse `fix-types.ts` TRUNCATE** — OPEN (supervised). The deploy-path
  data-loss landmine is untouched; still the #1 thing before real data.
- **P0 #2 Atomic candidate merge** — OPEN (supervised). neon-http `db.batch`
  fix still needed; AUTOPILOT-DEV.md iter 13 has the design.
- **P0 #3 Read digest crash logs** — STILL PASSIVE. `instrumentation.ts` is live
  (shipped iter 1); waiting for the crash to fire to pull the real stack.
- **P1 #4 SSO**, **#5 HRIS handoff**, **#6 M365/Teams** — all OPEN. SSO remains
  the single highest-leverage increment.
- **P2 #7-10** (data-residency doc, build-vs-buy memo, hide gold-plating,
  displacement instrument) — OPEN; all leadership/decision items, not eng.

### Shipped since the board (iters 16-29) — quality work that DIDN'T need a decision
These were the autopilot's lane: clearly-correct fixes + tests + analysis, all
green, no supervision needed. Recorded so the board reflects reality:
- **Reliability fixes (3):** AI prompt-length cap (iter 18, closes the STRATEGY
  iter-14 AI-cost risk), cron interview-reminders isolation (iter 23), Drive SDK
  timeouts (iter 28, extends the iter-8 connector fix).
- **UI/a11y (3):** loading skeletons for the 2 heaviest routes (iter 16), and
  two screen-reader label rounds — candidate sidebar (iter 21) + client contact
  form (iter 26).
- **E2E suite 3 → 9 specs:** feature-gating (17), token-route security (22),
  landing page + compliance guard (27), on top of the rotation-1/2 isolation
  specs.
- **Docs:** CHANGELOG (20), AUTOPILOT-INDEX (25), plus STRATEGY rounded out to
  five angles + an exec summary (19, 24, 29).

### Net read for breakfast (unchanged headline)
The autopilot has cleared all the safe-to-ship quality work; **what remains is
exactly the supervised queue** — the two data-loss fixes and SSO. The one
sentence still holds: **fix the two P0 data-loss landmines, then chase SSO.** The
difference vs iter 15: there's now nothing *else* worth doing unsupervised ahead
of them — the polish/test/doc backlog is drained.

**No code changed this iteration (PM status-refresh/analysis lens).**

---

## Iteration 35 — CHANGELOG refresh (keep the release record honest)

The CHANGELOG (iter 20) recorded the run through ~iter 19 and had gone stale: it
claimed "E2E grew 3 → 7 specs" when there are now **10**, and omitted everything
shipped iters 21-34 (cron isolation, Drive timeouts, three a11y rounds, three
new E2E specs, the strategy/PM doc work). A release record that misstates what
shipped is the same doc-honesty problem as the iter-30 stale board — verified
against `git log` / `ls e2e`, not memory.

Updated the Unreleased section: corrected the spec count + listed the 7 new
specs, added the cron + Drive-timeout fixes and a new **Accessibility** group,
and refreshed the Documented section (strategy now 5 angles + exec summary +
risk register; added INDEX + the input-hardening audit). Every entry maps to a
real merged commit.

This is the third "keep it honest" refresh (board iter 30, register iter 34,
changelog now) — the recurring PM job once a run is long enough that its own
records drift. Doc-only, zero runtime risk.

---

## Iteration 40 — retrospective & wind-down recommendation (`AUTOPILOT-RETRO.md`)

At 8 full rotations, the highest-value PM move is no longer another artifact —
it's to call the run's state honestly. Wrote `AUTOPILOT-RETRO.md`: what shipped
(40/40 green, ~12 code fixes, E2E 3→11, five decision docs), the data showing
the inflection (half the last 8 iterations were analysis/doc; the unsupervised
backlog is drained and every lens has hit completion), and the recommendation —
**redirect the loop to the 3 supervised items (R1 TRUNCATE, R2 atomic merge,
R3 SSO) with a human in the loop, rather than spin marginal rotations.**

A PM whose backlog is drained doesn't manufacture work; they say so and
recommend reallocation. That's this doc. It's the one deliverable that helps the
user decide what to do with the loop, which no prior artifact addressed.

This likely closes the PM lens's net-new work for the run — future PM rotations,
if the loop continues, will be status refreshes (the iter-30/34/35 pattern)
until a new feature wave creates genuinely new ground.

---

## Iteration 45 — deploy-quota incident (the loop hit a hard platform limit)

**What happened.** Around iteration 43, main→prod auto-deploys silently stopped
firing. Iteration 44 traced it: the Vercel **free-tier deployment quota (100/day)
was exhausted** — the API rejected a prod deploy with
`api-deployments-free-per-day`. The run burns ~2-3 deploys/iteration (branch
preview + merge build + prod), so ~40 iterations/day saturates the cap.

**Impact.** `main` stayed correct (all code merged), but production fell behind:
prod served iter-42 (`b8b0819`) while main was 2 iterations ahead. My iter-43
"prod green" line was wrong — it matched a stale deploy without checking the
SHA; corrected in the iter-44 log. **Resolved iteration 45:** the quota reset,
and one production deploy of current `main` (`c231e69`) caught prod up to all 44
iterations at once. Verified prod sha == main HEAD.

**The honesty lesson (process fix, not code).** "Verify green on Vercel" must
mean **check the production deploy's commit SHA matches main**, not just "a
green build exists." A green branch preview ≠ shipped to prod. Future
deploy-verify steps in this loop (and in any /ship workflow) should assert the
SHA, which would have caught this at iter 43 instead of iter 44.

**What it means for the loop (reinforces the retro).** The cadence is not free —
it consumes a finite daily platform budget, and at ~40 iters/day it self-limits.
This is concrete evidence for `AUTOPILOT-RETRO.md`'s call: an unsupervised loop
optimized for "one small unit per tick" eventually spends real resources
(deploy quota, and the reviewer's attention) faster than it creates value.
**Recommendation stands and is now cost-backed: pause the cron and redirect to
the supervised queue (R1/R2/R3).** If the loop continues, it should batch (merge
several iterations per prod deploy) rather than deploy every tick.
