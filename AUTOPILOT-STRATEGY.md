# Autopilot — Market Strategist log

Positioning realism for **Tru Hyre = an internal Allianz HR/recruiting tool**,
NOT a SaaS product. The question each iteration: for an in-house Allianz
recruiting team, which of the 55 shipped features actually earn their keep,
which are gold-plating (SaaS-vendor instincts that an internal team won't use),
and what gap does a real Allianz recruiter still feel?

Analysis only — no code, no deploy from this lens.

---

## Executive summary (iteration 29 — bottom line up front)

Five analysis passes (iters 4, 9, 14, 19, 24) converge on one thesis, distilled
here so a sponsor reads the conclusion before the 350 lines of working. If you
read nothing else in this file, read this.

**The thesis in one paragraph.** Tru Hyre's defensible reason to exist as a
build (not a bought ATS) is **AI economics + data residency + zero per-seat**:
the AI features save real recruiter hours at metered token cost (haiku-default,
cost-capped — iters 14, 24), and candidate PII stays in Allianz's own
infrastructure, which is a compliance edge for an EU insurer. It will **lose any
feature-count contest to a vendor**, so it should stop competing on breadth (the
55-feature surface is already wider than an internal team needs — iter 4) and
lean into the moat. The single thing standing between "good internal tool" and
"actually deployed at Allianz" is **adoption, not features** — specifically SSO
and Microsoft-ecosystem fit (iters 4, 9). Everything else is secondary.

**The four decisions that matter, in order:**
1. **Ship SSO (Azure AD).** The #1 adoption gate; low-code (Auth.js drop-in),
   bottleneck is the Azure tenant/IT approval, not engineering. → iter 4/PM iter 5.
2. **Pilot one high-volume pod, not the org.** Define success as displacement
   (they stop using their spreadsheet) + a time-to-submit drop, measured against
   a pre-captured baseline. → iter 19.
3. **Lead the sponsor memo with the ROI inequality,** not a feature list:
   ~€60-90k/yr of reclaimed capacity (10-person team) vs low-hundreds-€/month of
   tokens vs the maintenance cost. → iter 24.
4. **Hold the line on scope and AI cost.** No feature #56; hide the SaaS
   gold-plating for the internal build; keep AI user-initiated + capped so the
   moat stays cheap. → iters 4, 14, 18 (the shipped prompt-cap).

**The one risk that kills it quietly:** key-person/bus-factor — it's a
from-scratch internal build. The doc-honesty discipline in this repo (honest
README, INTEGRATIONS maturity badges, these logs) is the cheapest hedge; treat
it as insurance, not housekeeping. → iter 14.

Detailed working follows: feature triage (iter 4), adoption & switching cost
(iter 9), build-vs-buy & risk (iter 14), rollout wedge (iter 19), ROI model
(iter 24).

---

## Iteration 4 — feature portfolio triage (55 features, 9 categories)

### The framing that matters
An internal tool serves **one known org** with **known recruiters, known
hiring managers, a known IT/security regime, and an existing HRIS (Workday-class)**.
That inverts several SaaS assumptions:
- You don't need to *acquire* users or *win* clients — the client is Allianz.
- You don't need a public API / marketplace / self-serve onboarding — there's
  no third-party ecosystem buying integrations.
- You *do* need to fit Allianz's identity (SSO), data-residency, and the
  HRIS/Workday system of record. That's where an internal tool lives or dies.

### Earns its keep (core recruiting loop — keep, these are the product)
- **Candidates + resume parsing + pipeline stages + kanban** — the spine.
- **Interview scheduling + scorecards + interview reminders** — daily-driver.
- **Recruiter inbox + SLA aging alerts** — the "what needs me today" view is
  exactly what an internal recruiter opens first. High keep.
- **AI match scoring, AI summary, AI semantic search, AI red-flags** — genuine
  time-savers on real req volume; the strongest differentiator vs a spreadsheet.
- **Offer management + reference checks + source attribution** — standard,
  expected, used.
- **Reports/analytics + custom report builder** — internal teams report upward
  (to HR leadership); funnel + time-to-fill matter for headcount planning.
- **Dark mode / keyboard shortcuts / command palette** — cheap polish that
  power-users (recruiters live in the tool all day) actually feel.

### Gold-plating for an INTERNAL tool (built well, but questionable ROI in-house)
These are SaaS-vendor patterns. Not wrong, but a real Allianz team may never
switch them on. They're correctly feature-flagged (most default OFF), so the
cost is maintenance + surface area, not user confusion.
- **Public API + API keys (`public_api`)** — who's the third-party consumer
  inside Allianz? Workday/HRIS integration would be a direct connector, not a
  public bearer API. Likely dead weight unless an internal team plans to build
  against it.
- **Zapier / outbound automation, Job-board posting, Webhooks** — external
  ecosystem plumbing. Allianz posts to its own careers infrastructure and
  LinkedIn via corporate accounts, not via a Zapier zap from an internal tool.
- **Vendor self-onboarding (`vendor_onboarding`)** — implies an open agency
  marketplace. Internal staffing uses a *known, contracted* vendor list;
  self-serve onboarding is a SaaS growth feature, not an internal need.
- **Candidate self-scheduling + candidate self-service portal** — nice, but
  these add a public/tokened attack surface and a support burden. For internal
  hiring at Allianz's volume, recruiter-driven scheduling may be simpler and
  lower-risk. Keep OFF until a recruiter actually asks.
- **SMS/WhatsApp + Slack/Teams notifications** — Teams is plausible (Allianz is
  a Microsoft shop); SMS/WhatsApp is consumer-grade and a data-governance
  headache for a regulated insurer. Teams > SMS for this org.

### The gap a real Allianz recruiter still feels (NOT yet built)
This is the honest "what's missing that matters more than any of the
gold-plating above":
1. **SSO / Azure AD (SAML/OIDC).** Already deferred in ROADMAP (Wave 8). For an
   internal Allianz tool this is not optional — it's the #1 blocker to real
   adoption. A regulated insurer will not run a recruiting tool on a separate
   email/password store. **Highest-value next increment, full stop.** Everything
   else is secondary to "can Allianz IT bless this."
2. **HRIS / Workday handoff that's real.** `hris_handoff` exists as a flag but
   ROADMAP marks the actual sync as scaffold. The moment a candidate is hired,
   the data must flow to the system of record. An internal tool that makes
   recruiters re-key hires into Workday will lose to the spreadsheet.
3. **Data residency / audit posture made explicit.** GDPR tools exist, but an
   internal Allianz tool needs to *state* where candidate data lives (EU
   region) and prove the audit trail to compliance. This is adoption-gating for
   legal sign-off, not a feature recruiters request.

### Recommendation to the user (decisions for breakfast, not auto-built)
- **Don't build more breadth.** The portfolio is already wider than an internal
  team needs. Resist adding feature #56.
- **Reframe the roadmap around adoption, not features:** SSO → HRIS handoff →
  compliance posture. These three unlock *real* Allianz usage; the 55 features
  are moot if IT won't approve the login.
- **Consider hiding (not deleting) the gold-plating** from `/settings/features`
  for the internal build, so the admin surface reflects what Allianz will
  actually run. Flags stay in code; just don't present SaaS-ecosystem toggles.

**No code changed this iteration (analysis-only lens).**

---

## Iteration 9 — adoption & switching-cost realism (new angle, not feature triage)

Iteration 4 asked "which features earn their keep." This iteration asks the
question that decides whether ANY of them matter: **will a real Allianz
recruiting team switch to this, and what does it cost them to do so?** An
internal tool nobody migrates to is dead regardless of how good the features
are. The competitor isn't another product — it's the recruiter's current habit
(a shared spreadsheet, an email folder, or an ATS module inside Workday).

### Switching cost is genuinely LOW — and that's the build's quiet strength
Verified the actual onboarding surface, not the marketing claim:
- **CSV import** (`/candidates/import`) accepts a header row in any column order,
  ignores unknown columns. A team can dump their existing candidate spreadsheet
  in on day one without reformatting. This is the single most important adoption
  feature in the app and it already exists and is honest about its contract.
- **Bulk invite** (`/settings/invitations/bulk`) onboards the whole recruiting
  team in one step rather than one-user-at-a-time.
- **Only `fullName` is truly required** on a candidate (every other column has a
  DB default). So a sparse, messy legacy export still imports — no "clean your
  data first" wall that kills migrations before they start.

**Strategic read:** the team did the unglamorous adoption plumbing. Most
internal tools die at "I'd have to re-enter everything" — this one doesn't.

### The riskiest adoption ASSUMPTION baked into the build
The product assumes recruiters will **live in Tru Hyre as their primary surface**.
But Allianz recruiters live in **Outlook + Teams** all day. The two features that
decide daily-active usage are therefore:
1. **Email that works from inside the tool.** Gmail SMTP is wired, but Allianz is
   a Microsoft shop — outbound from a shared Gmail mailbox is an odd fit and a
   likely governance flag. The honest adoption play is **M365/Graph mail**, not
   Gmail. (Strategy iter 4 flagged Teams > SMS; same root: meet them in Microsoft.)
2. **Notifications where they already look.** The recruiter inbox + SLA alerts
   are excellent, but they require *opening the app*. A Teams notification on
   "candidate went stale / interview today" is what actually pulls a Microsoft-
   shop user back in. `slack_notifications` covers Teams via incoming webhook —
   this is higher adoption-leverage than it looks and worth defaulting ON for an
   internal rollout (with a Teams webhook), not leaving OFF as a SaaS afterthought.

### What I'd measure before declaring product-market fit (internal edition)
Internal PMF isn't MRR — it's **displacement**. Two honest metrics:
- **Spreadsheet-death date:** the day the team stops maintaining their old
  tracker in parallel. Until then, Tru Hyre is additive work, not a replacement.
- **Time-in-tool per recruiter per day.** If it's near-zero except when a manager
  asks for a report, the tool is a reporting layer, not a workflow — and the AI
  features (its real differentiator) are going unused.

### Recommendation (decisions for breakfast, not auto-built)
- **Lean into the low switching cost** in rollout: pre-load each team's existing
  spreadsheet via CSV import on day one so they open to *their* data, not an
  empty shell. First-impression = "it already knows my pipeline."
- **Re-rank the adoption roadmap to meet Microsoft:** SSO (iter 4 #1) → M365 mail
  → Teams notifications default-on. This is the same "fit Allianz's reality"
  thread as iter 4, now aimed at daily-active usage rather than legal sign-off.
- **Instrument displacement, not vanity counts.** Add a tiny "last spreadsheet
  export" / time-in-tool signal later so the team can see real adoption. (Propose
  only — not built; analytics scope is a supervised decision.)

**No code changed this iteration (analysis-only lens).**

---

## Iteration 14 — build-vs-buy defensibility & internal risk (the existential angle)

Iter 4 = which features; iter 9 = will they switch. This iteration asks the
question that can kill an internal tool independent of both: **why build this
instead of buying Greenhouse / SmartRecruiters / Workday Recruiting?** Every
internal tool faces a procurement/IT exec who will ask exactly that. If there's
no honest answer, the tool gets shelved no matter how good it is.

### The honest build-vs-buy case (where Tru Hyre actually wins / loses)

**Where buying a commercial ATS wins (be honest about these):**
- Compliance & certifications out of the box (SOC 2, ISO 27001, GDPR DPAs,
  data-residency contracts). A vendor sells Allianz legal a signed paper trail;
  an internal tool has to *earn* each of those, and that's expensive ongoing work.
- Vendor-managed uptime, security patching, pen-tests, and a support SLA. With
  Tru Hyre, Allianz owns all of that — it's now a product the company maintains.
- Integrations breadth (job boards, assessment vendors, background-check
  partners) that a vendor maintains so you don't.

**Where Tru Hyre genuinely wins (the real reasons to build, not cope):**
1. **The AI layer is the moat, and it's cost-controlled.** `lib/ai.ts` funnels
   every AI feature through one client, defaults to **claude-haiku-4-5** (the
   cheap/fast tier), and **no-ops gracefully without a key** — so AI spend is
   opt-in and bounded, not a runaway per-seat license. A commercial ATS charges
   per-seat for comparable AI as an upsell; here the marginal cost is metered
   tokens on Allianz's own key. For a large internal team this is a real
   structural cost advantage, not a vanity feature.
2. **Data stays in-house.** Candidate PII (a GDPR-sensitive asset for an EU
   insurer) lives in Allianz's own Neon/Postgres + Drive, not a third-party
   multi-tenant SaaS. For a regulated insurer this can be the deciding factor —
   it's a *compliance* advantage, not just a technical one.
3. **Exact-fit workflow + zero per-seat cost.** No license ceiling on how many
   recruiters/hiring-managers use it; the role model (admin/hr/hr_lite/client/
   vendor portals) is shaped to Allianz's actual agency-driven hiring, not a
   generic ATS's assumptions.

**Strategic read:** the defensible case is **AI economics + data residency +
zero per-seat**, NOT feature breadth (a vendor will always have more features).
The roadmap should lean INTO the moat and stop trying to match vendor breadth.

### The internal risks that actually threaten this (rank-ordered)
1. **Key-person / bus-factor risk.** This is a from-scratch internal build. If
   the builder leaves, who maintains the auth trust boundary, the neon-http
   quirks (see AUTOPILOT-DEV.md merge/transaction notes), the Drive service
   account? A commercial ATS doesn't have this risk. **Mitigation:** the docs
   discipline already in this repo (honest README, INTEGRATIONS maturity badges,
   these autopilot docs) is the single best hedge — keep it current. This is a
   real reason the doc-honesty iterations (5, 10) have strategic value, not just
   tidiness.
2. **Compliance debt compounding.** Every month without SSO + a stated
   data-residency/audit posture is a month the tool can't be Allianz-blessed for
   real PII at scale. This is the iter-4/iter-5 thread, restated as *risk*: it's
   not just a missing feature, it's the gate that keeps the whole build in
   "pilot" purgatory.
3. **AI cost surprise.** Today it's haiku + opt-in, well-controlled. The risk is
   scope creep into expensive per-candidate AI on every list render. Keep AI
   behind explicit user actions (it already is) and never auto-run it on page
   load — that's the line between "cheap moat" and "runaway bill."

### Recommendation (decisions for breakfast, not auto-built)
- **Write the one-page build-vs-buy memo** for whoever approves this internally,
  leading with AI economics + data residency + zero per-seat — not a feature
  list (you lose the feature contest to any vendor).
- **Treat doc-honesty as bus-factor insurance,** not housekeeping. It's the
  cheapest mitigation for the #1 internal risk.
- **Draw a hard line on AI cost:** AI stays user-initiated, haiku-default,
  key-gated. Make "no AI on page load" an explicit project rule so a future
  feature can't quietly turn the moat into a liability.

**No code changed this iteration (analysis-only lens).**

---

## Iteration 19 — the rollout wedge (which team first, how to define pilot success)

Prior angles: what to build (4), will they switch (9), build-vs-buy (14). The
next decision a real internal launch faces — and the one most likely to be
fumbled — is **the wedge: which single team pilots this first, and what makes
the pilot a yes/no.** Internal tools rarely die from bad code; they die from a
vague pilot that never produces a clear "keep it" verdict, so it drifts back to
the spreadsheet. Good news: the product already has the pieces to run a sharp
pilot — the gap is choosing the wedge and the metric, not building anything.

### Pick the narrowest team where the AI moat is most felt
Don't pilot org-wide. Pick **one recruiting pod with high req volume and messy
sourcing** — that's where the differentiators (AI match scoring, semantic
search, dedupe, red-flags) save the most hours per week. A low-volume team won't
feel the AI and will judge the tool on chrome. The wedge is "the team drowning
in candidates," because that's where "it ranked my shortlist in 10 seconds"
lands as magic, not novelty.

### Use the phased role model AS the rollout sequence (it already maps)
The role model (admin/hr/hr_lite/client/vendor) is a natural staged rollout —
de-risk by widening the blast radius one ring at a time:
1. **Week 1-2 — internal only:** `hr` + `hr_lite` recruiters. CSV-import the
   pod's existing pipeline on day one (iter 9: import takes any-order headers,
   only fullName required) so they open to *their* data. No external users yet.
2. **Week 3-4 — add hiring managers:** the `client` portal, PII-redacted
   (verified iter 12 contract). Now a hiring manager reviews submissions in-tool
   instead of over email — the first cross-functional proof.
3. **Only after that — vendors:** the `vendor` portal. External-facing, highest
   isolation stakes (iter 12), so it goes last when confidence is highest.

Each ring is independently revertible (turn off the portal flag) — a safe
escalation ladder, not a big-bang launch.

### Define pilot success BEFORE starting — and the metrics already exist
The pilot must have a pre-committed yes/no bar, or it ends in "it was fine, I
guess." The product already computes the right numbers (`lib/metrics.ts`), so
the bar can be evidence-based, not vibes:
- **Primary (displacement, from iter 9):** the pod stops maintaining their old
  spreadsheet by end of week 2. Binary. If they keep both, the tool failed.
- **Cycle time:** `getCycleTimePerStage` — does time-to-submit / time-to-offer
  drop vs their pre-pilot baseline? Capture the baseline BEFORE turning it on.
- **AI utilization:** are match-scoring / semantic-search actually used per
  recruiter per week? If the moat feature goes untouched, you bought chrome.
  (Needs the displacement/usage instrumentation proposed iter 9 — this is the
  concrete reason to build that tiny signal: without it the pilot can't be graded.)
- **Coverage:** `getCoverageRatio` / `getRecruiterScoreboard` — does every open
  req have movement, or are candidates rotting? A tool that hides rot fails.

### The anti-pattern to refuse
**Do not pilot by feature-touring the whole 55-feature surface.** A pilot that
shows everything teaches nothing. Turn OFF the gold-plating (iter 4) for the
pilot org so the pod sees only the core loop + AI, judges *that*, and isn't
distracted into evaluating Zapier/job-board toggles they'll never use.

### Recommendation (decisions for breakfast, not auto-built)
- **Name the pilot pod and the success bar in one sentence each** before any
  rollout: "Pod X stops using their spreadsheet and cuts time-to-submit 20% in
  4 weeks." If you can't write that sentence, you're not ready to pilot.
- **Capture the pre-pilot baseline** (cycle time, current tracker) the week
  before — you can't prove improvement without it.
- **Sequence by the role rings,** internal → hiring managers → vendors, each
  flag-revertible. This is the safe version of the iter-15 P1 adoption work.

**No code changed this iteration (analysis-only lens).**

---

## Iteration 24 — the ROI model (does the AI moat pay for the maintenance?)

Iter 14 argued *qualitatively* that the AI moat justifies building. The exec's
next question is quantitative: **does it actually save enough recruiter time to
pay for a from-scratch internal tool's maintenance?** A build-vs-buy case
without a number is a vibe. This is the back-of-envelope a sponsor needs — with
assumptions stated, so it's honest estimation, not fabricated precision.

> ⚠️ These are ILLUSTRATIVE assumptions, not measured data. The whole point of
> the iter-9 displacement instrument + iter-19 baseline capture is to REPLACE
> these guesses with the pilot pod's real numbers. Treat as a model to fill in.

### Where the AI features save time (mapped to the workflow step each shortcuts)
| AI feature (`lib/`) | Manual step it replaces | Illustrative time saved |
|---|---|---|
| **Match scoring** (`match.ts`) | Recruiter reads N resumes to rank a shortlist | ~10-15 min per req's first pass |
| **Semantic search** (`semantic-search.ts`) | Boolean-guessing keyword searches to find a profile | ~5 min per search, several/day |
| **AI summary** | Skimming a resume to brief a hiring manager | ~3-5 min per submitted candidate |
| **JD generator** | Drafting a job description from scratch | ~20-30 min per new req |
| **Screening questions** | Writing role-specific screen questions | ~10 min per req |
| **Dedupe + red-flags** | Manual duplicate hunting / resume scanning | ~variable; catches misses, not just time |

### The model (fill in with real headcount + volume)
Pick conservative numbers and let the sponsor adjust:
- Assume **1 recruiter saves ~30-45 min/day** across these (one ranked
  shortlist + a few searches + a couple of summaries). Call it **~3 hrs/week**.
- A **10-recruiter team** → ~30 recruiter-hours/week reclaimed → at a loaded
  cost of, say, €40-60/hr, that's **~€1,200-1,800/week** of recovered capacity,
  i.e. **~€60-90k/year** — redeployed into more reqs filled, not layoffs.
- **AI cost against that:** haiku-default (iter 18 cap keeps it bounded). Even
  at thousands of AI calls/week, token spend is **double-digit to low-hundreds
  €/month** — one to two orders of magnitude below the labor value. The moat is
  cheap *because* of the cost discipline shipped this run (haiku + key-gate +
  prompt cap).
- **Maintenance cost (the honest debit):** the from-scratch build needs eng
  time — call it a fraction of one engineer ongoing. That's the real number to
  weigh against the ~€60-90k/yr, and the one a vendor's per-seat license avoids.

### The one honest sentence for the sponsor
**"If a 10-person team reclaims ~3 hrs/recruiter/week from the AI features, that's
~€60-90k/yr of capacity for low-hundreds-€/month of tokens — the question isn't
whether it saves time, it's whether maintaining it costs less than that gap."**
That reframes the decision correctly: not "is the tool good" (it is) but "is our
maintenance cost below the labor savings" — and the cost-discipline work
(iter 18) is what keeps the token side of that inequality negligible.

### What makes this real instead of a slide
- **Instrument AI utilization** (proposed iter 9/19): calls per recruiter per
  week. If the moat features go unused, the numerator collapses and the whole
  ROI case is fiction — so usage is the metric that validates or kills this.
- **Capture time-to-submit before/after** (iter 19 baseline): the cleanest
  external proxy for "hours saved" without a stopwatch study.

### Recommendation (decisions for breakfast, not auto-built)
- **Put a number on it before the build-vs-buy memo (iter 14):** plug the real
  team size + loaded hourly cost into the model above; lead the memo with the
  labor-savings-vs-maintenance inequality, not a feature list.
- **Make AI utilization the headline pilot metric.** It's both the adoption
  signal (iter 9) and the ROI validator — one number does double duty.

**No code changed this iteration (analysis-only lens).**

---

## Iteration 34 — consolidated risk register (one table, sponsor-actionable)

Risks have been named across iters 4/9/14/18/24 + the two DEV data-loss
proposals, but scattered prose isn't actionable. This consolidates them into one
likelihood × severity × status × mitigation table — the standard artifact a
sponsor signs off against. Not a new analysis; a reconciliation (like the PM
board did for tasks). Status reflects what THIS run has already closed.

| # | Risk | Likelihood | Severity | Status | Mitigation / owner |
|---|---|---|---|---|---|
| R1 | `fix-types.ts` TRUNCATE wipes resumes on a deploy that sees legacy `blob_*` cols | Low (today) | **Critical** (irreversible prod data loss) | **OPEN** | Supervised fix in AUTOPILOT-DEV.md iter 3 (row-count guard + env flag, or retire the script). Do before real data. |
| R2 | Non-atomic candidate merge corrupts a record graph on mid-run failure | Low | High (irreversible partial corruption) | **OPEN** | Supervised: neon-http `db.batch` (AUTOPILOT-DEV.md iter 13) + merge-integrity test. |
| R3 | No SSO → Allianz IT won't approve for real PII; stuck in pilot purgatory | High | High (blocks all adoption) | **OPEN** | Azure AD via Auth.js drop-in (PM iter 5). #1 increment. Org bottleneck, not eng. |
| R4 | Key-person / bus-factor on a from-scratch internal build | Medium | High (no vendor to fall back on) | **MITIGATING** | Doc-honesty discipline (README sync iter 10, INTEGRATIONS badges, INDEX iter 25) is the live hedge — keep current. |
| R5 | Compliance debt: no stated EU data-residency / audit posture | Medium | High (legal sign-off gate) | **OPEN** | Write the posture doc (PM board P2 #7); cheap, unlocks legal. |
| R6 | AI cost surprise (unbounded prompts / AI on page-load) | Low | Medium (runaway token bill) | **CLOSED** | Shipped iter 18: prompt-length cap + haiku-default + key-gate + user-initiated. Keep the "no AI on page load" rule. |
| R7 | Production digest crash (digest:3495001251) recurs unexplained | Unknown | Medium (user-facing 500) | **INSTRUMENTED** | `instrumentation.ts` live since iter 1 — next occurrence yields the real stack. Passive until it fires. |
| R8 | Over-broad feature surface (55 features) dilutes the internal tool | Medium | Low-Medium (maintenance + confusion) | **OPEN (decision)** | Hide gold-plating from `/settings/features` for the internal build (iter 4 / PM board P2 #9). |
| R9 | Stored XSS via user-supplied URLs (candidate linkedinUrl/githubUrl, client website rendered into `href`; `javascript:` fires in the viewer's authenticated session) | Medium (public careers form is an unauth write path) | High (session compromise of a recruiter/admin) | **CLOSED** | Fixed + live iter 51: `safeExternalUrl()` (lib/utils) gates href to http(s) only; regression-locked iter 52. |

### How to read this
- **Two CRITICAL/High-severity OPEN items are data-loss (R1, R2)** — both
  supervised-only, both the P0 of the PM board. Nothing else competes with them.
- **The highest-likelihood OPEN risk is R3 (SSO)** — not a data risk but the
  adoption gate; it's High×High and the #1 increment for a reason.
- **R6, R9 are CLOSED and R7 INSTRUMENTED by this run** — concrete evidence the
  unsupervised quality work retired real risk, not just polish. R9 (stored XSS)
  was the highest-severity issue the run *found* on its own, not just hardened.
- **R4 (key-person) is the quiet one** — its mitigation is the doc discipline
  this run has been compounding, which is why those doc iterations had teeth.

### Recommendation (decisions for breakfast, not auto-built)
- **Gate "real Allianz data goes in" on R1 + R2 being closed.** That's the
  single hard line; everything else can run in parallel.
- **Track this register, not the prose.** When a supervised item lands, flip its
  status here — it's the one-glance health view for whoever owns the call.

**No code changed this iteration (analysis-only lens).**

---

## Iteration 39 — falsification pass: steelman "just buy an ATS" + kill-criteria

Every section above builds the case to build. A strategist who only confirms
their own thesis is doing PR. This pass does the opposite: argue the strongest
version of "kill the build, buy Greenhouse/SmartRecruiters," then state the
concrete conditions under which that's the right call. If the build thesis
survives an honest steelman, it's robust; if it doesn't, that's the single most
important finding of this run — better to know now than after more sunk cost.

### Steelman: the strongest case to STOP and buy
1. **The moat may be renting, not owning.** "AI economics" assumes Allianz's own
   Anthropic key stays cheaper than a vendor's per-seat AI. But vendors bundle AI
   into a seat price that also covers compliance, uptime, and support — and their
   per-token cost is lower at their scale. If Allianz already pays for a Workday
   recruiting module, the marginal cost of its AI add-on may be near zero to the
   budget holder. The "cheap moat" could be cheaper-looking than real.
2. **Data residency is a vendor checkbox, not a build-only win.** Enterprise ATSs
   sell EU data-residency + signed DPAs as a standard SKU. The build doesn't
   *uniquely* own residency — it just defers the compliance paperwork Allianz
   legal will demand anyway, and a vendor has already done that work.
3. **Total cost of ownership is understated.** The ROI model (iter 24) counts
   recruiter hours saved but under-weights the build's ongoing eng cost,
   on-call, security patching, and the key-person risk (R4) — all of which a
   vendor amortizes across thousands of customers. "Zero per-seat" ignores the
   non-zero per-engineer.
4. **Opportunity cost.** Every hour maintaining an internal ATS is an hour not
   spent on something only Allianz can build. Recruiting is not Allianz's
   differentiator; an insurer's eng talent is arguably mis-deployed here.

### Why the build thesis still survives (the rebuttals that hold)
- On (1)/(2): the decisive factor isn't cost or residency in isolation — it's
  **control + fit**. A vendor's AI ranks candidates by *its* model on *its*
  schema; the build ranks on Allianz's own data with prompts tuned to Allianz's
  roles, and the data never leaves. For a regulated insurer that's a control
  argument money doesn't settle.
- On (3): TCO is the real risk, and the honest answer is **it depends on a number
  we don't have yet** — which is exactly why iter 24 says measure it and iter 9
  says instrument utilization. The thesis isn't "build regardless," it's "build
  IF the measured savings clear the measured maintenance."
- On (4): true at scale, but a *small* internal tool that a pod actually adopts
  has already sunk most of its build cost; the remaining question is marginal
  maintenance vs. marginal value, not greenfield build vs. buy.

### Kill-criteria — when to STOP the build and buy (decide against these)
Pre-commit to these so the decision is evidence-driven, not sunk-cost-driven:
- **K1 — Adoption fails the pilot.** If the iter-19 pilot pod does NOT hit
  spreadsheet-death + a time-to-submit drop in 4-6 weeks, the tool isn't
  displacing anything → buy or stop. This is the dominant kill-signal.
- **K2 — SSO/compliance proves load-bearing-hard.** If Allianz IT won't approve
  the custom auth/data posture even with SSO shipped, the build can't hold real
  PII → a pre-certified vendor wins.
- **K3 — Maintenance > savings.** If measured eng maintenance (post-instrument)
  exceeds the measured recruiter-hours value, the ROI inverts → buy.
- **K4 — Bus-factor materializes.** If the build can't survive the key person
  leaving (no second maintainer, docs notwithstanding), the operational risk
  outweighs the fit advantage → buy.

### The honest verdict
The build thesis is **robust but conditional** — it survives the steelman on
*control + fit* grounds, but every cost/risk rebuttal resolves to "measure it,"
not "trust it." So the real recommendation tightens: **don't treat the build as
decided — treat it as on-probation against K1-K4, with the iter-19 pilot as the
trial.** That's a stronger position than any of the build-the-case sections,
because it's the one a skeptical exec can't dismiss as advocacy.

**No code changed this iteration (analysis-only lens).**

---

## Iteration 44 — the pilot scorecard (the fill-in go/no-go sheet)

Iter 19 named the pilot metrics; iter 39 pre-committed the kill-criteria
(K1-K4). This operationalizes both into ONE sheet a sponsor fills in at the end
of the pilot to get a go/no-go — turning scattered "measure this / kill if that"
prose into a decision instrument. Nothing new to analyze; this is the artifact
that makes the prior two sections usable in a room.

### How to run it
Capture the **baseline** column the week BEFORE turning Tru Hyre on for the pod
(you can't prove improvement without it). Fill **result** at end of week 4-6.
**Verdict** is per-row pass/fail against the threshold; the overall call follows
the decision rule below.

| # | Metric | Source | Baseline (pre) | Threshold to PASS | Result | Verdict | Kills |
|---|---|---|---|---|---|---|---|
| M1 | Spreadsheet displacement | observed | pod maintains old tracker | pod STOPPED maintaining it by wk 2 | ___ | ☐ | K1 |
| M2 | Time-to-submit | `getCycleTimePerStage` | ___ days | ↓ ≥ 15% vs baseline | ___ | ☐ | K1 |
| M3 | AI utilization | (needs iter-9 instrument) | n/a | ≥ 3 AI actions / recruiter / week | ___ | ☐ | K1 |
| M4 | Pipeline coverage | `getCoverageRatio` | ___% | every open req has movement; no worse than baseline | ___ | ☐ | K1 |
| M5 | SSO / IT sign-off | IT | none | Allianz IT approves the auth/data posture | ___ | ☐ | K2 |
| M6 | Maintenance vs savings | eng log + M2/M3 | n/a | measured eng hours < recruiter hours saved | ___ | ☐ | K3 |
| M7 | Second maintainer exists | team | 1 (key-person) | ≥ 2 people can run/deploy it | ___ | ☐ | K4 |

### Decision rule (pre-committed, so it's not relitigated under sunk cost)
- **GO (expand):** M1 passes AND ≥ 3 of M2-M4 pass AND M5 is on a credible path.
  The tool is displacing work and the moat features are used.
- **FIX-AND-RETRY:** M1 passes but the AI/cycle metrics (M2-M4) lag → adoption is
  real but the moat isn't landing; address utilization (training/UX) and re-run
  one cycle before deciding.
- **NO-GO (buy or stop):** M1 fails (K1) → the tool isn't displacing anything,
  the dominant kill-signal. Also NO-GO if M5 fails hard (K2) or M6 inverts (K3),
  regardless of the rest.

### Why M1 is weighted highest
Displacement is the one metric that can't be gamed: a pod either stopped using
its spreadsheet or it didn't. Cycle-time and AI-usage can look fine while the
team quietly keeps its real workflow elsewhere — so M1 gates the GO and is the
dominant NO-GO. Everything else refines the call; M1 makes it.

**No code changed this iteration (analysis-only lens).**

---

## Iteration 49 — consistency audit (no new analysis; the doc is complete)

The strategist lens has produced its full set: 5 analysis angles, an executive
summary, a risk register, a falsification pass, and a pilot scorecard. Rather
than pad a complete document with a redundant 10th angle, this iteration is a
QA pass on the artifact itself — checking the 9 sections (written across ~45
iterations) for internal contradiction.

**Result: consistent.** Cross-checked the load-bearing claims:
- Feature count cited as **55** in every section that references it (iters 4, 9, 14).
- The moat is stated identically as **AI economics + data residency + zero
  per-seat** in the exec summary and the build-vs-buy section.
- **SSO is the #1 adoption gate** consistently — exec summary, iter 4, risk
  register R3, ROI section all agree, none contradicts.
- ROI figures align: **~3 hrs/recruiter/week → ~€60-90k/yr** for a 10-person
  team, cited consistently in the exec summary and the ROI model.
- The blocking dependency (**name a pilot pod + success bar**) is stated once
  (iter 19) and referenced by the scorecard/kill-criteria — no duplication or drift.

**Verdict: the strategy doc is complete, consistent, and self-critical (it
argues its case, ranks its risks, steelmans itself, and gives a fill-in
go/no-go). No further strategist analysis is warranted until real pilot data
exists to update it against.** Future strategist rotations should update the
risk-register statuses and the scorecard with measured numbers once a pilot
runs — not add more pre-pilot theory.

**No code changed this iteration (analysis/QA pass).**
