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
