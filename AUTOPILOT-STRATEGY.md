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
