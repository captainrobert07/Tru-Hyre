# Changelog

All notable changes to Tru Hyre are recorded here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); the project is pre-1.0 so
versions are date-stamped milestones rather than semver releases yet.

## [Unreleased] — autopilot quality run (2026-06)

A multi-pass quality + hardening run on the shipped product. Every change below
was verified green on a Vercel preview build before merging to `main`. No new
product features were added — the focus was correctness, security, tests,
observability, polish, and honest docs. Two higher-risk fixes were written up as
supervised proposals rather than shipped blind (see `AUTOPILOT-DEV.md`).

### Fixed
- **Internal page titles & stat values were marketing-sized.** `PageHeader` used
  the hero clamp (`text-display`, up to 72px italic serif) on all 48 internal
  pages, and `StatCard` used the 40-48px marketing token — job titles rendered
  enormous and stat values wrapped. Now sized for app chrome.
- **Outbound connectors had no fetch timeout.** Slack/HRIS/Zapier/webhook/SMS
  sends are awaited synchronously on the stage-change path; a hung endpoint
  stalled the recruiter's action until the platform 504. Added
  `AbortSignal.timeout(8000)` to all six outbound fetches.
- **Gray `Badge` tone broke in dark mode.** It was the lone raw-palette holdout
  (`bg-slate-100`), rendering a glaring near-white pill on the dark canvas in
  4 places. Switched to theme tokens that flip via `.dark`.
- **AI prompt input was unbounded.** `lib/ai.ts` capped output tokens but sent
  prompts verbatim; raw-text entry points (AI-search box, semantic search)
  could paste-bomb input tokens. Added a 24k-char cap at the chokepoint.
- **Stale README.** Synced docs to shipped reality (Google Drive not Vercel
  Blob, Gmail SMTP not Resend, real `vercel-build` chain) and scrubbed a stale
  company-name string from the README + `.env.example`.

### Added
- **Production error instrumentation.** `instrumentation.ts` (`onRequestError`)
  logs the real error + stack + route + digest to Vercel logs, so a hashed
  production digest can be traced to an exact file:line on its next occurrence.
- **Loading skeletons** for the two heaviest server routes (`jobs/[id]`,
  `reports/custom`, ~12 queries each) that previously showed a blank screen on
  navigation.
- **E2E suite grew 3 → 7 specs** (Playwright): `hr_lite` ownership isolation,
  public careers self-apply (non-polluting), client/vendor portal cross-tenant
  isolation, and the feature-flag gating contract (`public_api` never serves
  data unauthenticated; gated routes redirect when off).

### Changed
- **Design-token consistency.** Brand mark + empty-state icon moved from raw
  `rounded-2xl` to the `rounded-xl2` design token (pixel-identical; prevents
  drift if the token is retuned).

### Documented (decision-ready, not auto-built)
- `AUTOPILOT-DEV.md` — two supervised-only fix proposals: the `db/fix-types.ts`
  `TRUNCATE`-on-deploy data-loss landmine, and the non-atomic `mergeCandidatesAction`
  (needs neon-http `db.batch`, not `db.transaction`).
- `AUTOPILOT-STRATEGY.md` — feature-portfolio triage, adoption/switching-cost,
  build-vs-buy defensibility, and the rollout-wedge plan.
- `AUTOPILOT-PM.md` — doc-honesty audits, an Azure AD SSO proposal, and a single
  prioritized action board reconciling all findings (P0 data-loss gates → P1
  adoption → P2 posture).

## [0.1.0] — initial build
- Next.js 15 + Drizzle/Neon rebuild of the recruitment platform: candidates,
  jobs, clients, vendors, resume intake, submissions, pipeline/kanban, offers,
  interviews, reports, AI features (match/summary/search/dedupe), public careers
  + apply, client/vendor/candidate portals, role-based access (admin/hr/hr_lite/
  client/vendor/candidate), dark mode, and a 9-wave feature roadmap. See
  `ROADMAP.md` and `INTEGRATIONS.md` for the full surface.
