# Autopilot — Market Strategist log

Positioning realism for **Tru Hyre = an internal Allianz HR/recruiting tool**,
NOT a SaaS product. The question each iteration: for an in-house Allianz
recruiting team, which of the 55 shipped features actually earn their keep,
which are gold-plating (SaaS-vendor instincts that an internal team won't use),
and what gap does a real Allianz recruiter still feel?

Analysis only — no code, no deploy from this lens.

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
