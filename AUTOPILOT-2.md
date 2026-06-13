# Autopilot Run 2 — build everything from the backlog

User asleep, full approval, ultracode. Build ALL backlog features, then audit +
dedupe + functionality test + UI/UX polish. Verify each wave green on Vercel
(push → poll). Take decisions, never stop. Branch: feat/mega-integrations-features.

Deploy verify: VERCEL_TOKEN in .env.local, project prj_1GJQm86CXWcTxIUDugqaojLAM1Lh.
Seeded admin admin@truhyre.app / Kris@35193. Prod tru-hyre-rho.vercel.app.

## STATUS: shipped to production (main @ 765579d), all builds green, E2E auth 12/12 + hr_lite 11/11
Done: W-A integrations foundation (13 integrations, admin key entry → reflects everywhere via
DB→env resolver in ai/email/sms/drive/calendar/parse-ai), W-B offer-letter PDF + candidate
merge + saved-view share, W-D AI outreach/red-flags + Slack/HRIS connectors, W-Z audit
(40-agent adversarial → 13 findings) + fixes (merge data-loss, cron auth spoof, hr_lite file
access, API audit log, dedupe helpers). Deferred (documented, not faked): remaining long-tail
features (configurable stages, multi-round, candidate portal, granular RBAC, job-board posting,
DocuSign/Outlook/transcription/bg-check/SSO send-flows) — their CONFIG is ready in
/settings/integrations; wiring is the next batch.

## Execution order (dependency-first)
- [ ] **W-A · Integration settings foundation** (FIRST — user-requested, others depend on it)
  - integrations table (key, label, category, enabled, config jsonb, secret-masked)
  - lib/integrations.ts registry + getIntegration()/isIntegrationReady()
  - /settings/integrations admin page: enable + enter API keys/config per integration
  - migrate existing env-driven bits to read DB-config-with-env-fallback:
    Anthropic, Google SA (drive+calendar), Gmail SMTP, SMS, cron, job boards,
    Slack/Teams, DocuSign, HRIS, Outlook, transcription, background-check, Zapier
- [ ] **W-B · Quick deferred wins** (✅ buildable, no infra)
  - Offer-letter PDF generation · Candidate merge tool · Saved-view sharing UI
  - Bulk resume upload · Resume anonymization (blind mode)
  - Candidate ratings/tags by recruiters · Automated interview feedback reminders (done in cron? extend)
- [ ] **W-C · Pipeline/scheduling deferred** (✅)
  - Configurable pipeline stages per job · Multi-round interview tracking
  - Interview kits · Candidate self-scheduling (public tokenized) · Candidate availability calendar
- [ ] **W-D · AI batch** (✅, reuse lib/ai.ts)
  - AI outreach drafting · resume red-flag detection · interview Qs per candidate
  - semantic job→candidate auto-match on intake · careers FAQ chatbot
  - offer-acceptance prediction
- [ ] **W-E · Analytics batch** (✅)
  - Cost-per-hire/budget · pipeline bottleneck alerts · exportable exec dashboard
  - hiring forecasting/headcount · diversity fields+consent (opt-in) · client SLAs
- [ ] **W-F · Client/vendor depth** (✅)
  - Vendor contracts/commission · client-side feedback portal · multi-contact org charts
  - vendor self-onboarding · reference checks (email)
- [ ] **W-G · Skill taxonomy** (✅) · candidate portal (L) · granular role permissions (M)
- [ ] **W-H · Integration-gated connectors** (🔌, in-app + config UI, document external)
  - Job-board posting · Slack/Teams notify · DocuSign offers · HRIS handoff
  - Outlook calendar · Zapier outbound · auto Gmail/IMAP sync · availability sync
  - background-check · transcription · 2FA/SSO (scaffold) · client billing
- [ ] **W-Z · Finalize**: code audit, remove dup code, functionality test (E2E expand),
  UI/UX polish pass, fix any errors. All features in /settings/features. Merge to main.

Rules: every feature → feature flag + UI gate + action guard. Integrations →
config in /settings/integrations. Additive schema only. Strict ESLint (no unused).
"use server" files export only async fns. Push each wave, verify READY, next.
