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
  `AbortSignal.timeout(8000)` to all six outbound fetches — and later to the
  admin integration **"Test"** reachability ping (the one outbound fetch the
  first pass missed), so testing a hung URL fails fast instead of 504ing.
- **Candidate PII no longer logged on unconfigured sends.** The email/SMS paths
  logged the recipient (email/phone + subject/body) whenever the optional
  integration wasn't set up — a real prod state. Now log a message-only
  "not configured" warning (data-minimization; matches the no-PII-in-logs rule).
- **Gray `Badge` tone broke in dark mode.** It was the lone raw-palette holdout
  (`bg-slate-100`), rendering a glaring near-white pill on the dark canvas in
  4 places. Switched to theme tokens that flip via `.dark`.
- **AI prompt input was unbounded.** `lib/ai.ts` capped output tokens but sent
  prompts verbatim; raw-text entry points (AI-search box, semantic search)
  could paste-bomb input tokens. Added a 24k-char cap at the chokepoint.
- **SLA cron could abort before its main job.** The interview-reminders block
  was unwrapped while its siblings had try/catch; a bad row 500'd the handler
  and skipped the core SLA task-creation. Isolated it (log-and-continue).
- **Google Drive SDK calls had no timeout.** A hung `files.create`/`delete`/
  metadata-`get` stalled resume upload / packet gen until the function timeout
  (the iter-8 fix, extended to the Drive client). Added a 20s timeout; the
  streaming download is intentionally left unbounded (large files are slow,
  not hung).
- **Stale README.** Synced docs to shipped reality (Google Drive not Vercel
  Blob, Gmail SMTP not Resend, real `vercel-build` chain) and scrubbed a stale
  company-name string from the README + `.env.example`.

### Security
- **Stored-XSS via user-supplied URLs (fixed).** Candidate `linkedinUrl`/
  `githubUrl` and client `website` were rendered into `href` without scheme
  validation, so a `javascript:` URL fired in the viewer's authenticated session.
  Added `safeExternalUrl()` (http(s)-only) at all render sites; regression-locked.

### Accessibility
- **Screen-reader labels on label-less forms.** Date inputs, selects, and
  placeholder-only fields across the candidate sidebar, client/vendor contact
  forms, interview scheduler, offers, references, email composer, scheduling
  link, scorecard, and platform settings now have `aria-label`s — 0 label-less
  inputs app-wide (WCAG 4.1.2). Layout unchanged.
- **Modal focus management.** Shared `useFocusTrap` hook on SlideOver, confirm,
  and quick-add: focus moves into the dialog, Tab cycles within it, and focus
  restores to the trigger on close (WCAG 2.4.3). command-palette intentionally
  left to its `cmdk` library. Escape now cancels the confirm dialog too.
- **`prefers-reduced-motion`.** A global media query collapses all animation/
  transition/smooth-scroll to ~instant for users who request reduced motion
  (WCAG 2.3.3); no effect on the default experience.
- **Set-password autocomplete.** Invite + admin user-form password fields use
  `autocomplete="new-password"` so password managers offer/save correctly.
- **Keyboard/SR navigation wayfinding.** A skip-to-content link + a `<main>`
  landmark let keyboard users bypass the nav on every page (WCAG 2.4.1/1.3.1),
  and the current page is now marked with `aria-current="page"` + an active
  style across **all four nav surfaces** — desktop pill nav, desktop "More"
  overflow, mobile bottom nav, and mobile "More" sheet (WCAG 2.4.3). One shared
  `isNavActive` rule so the surfaces can't disagree on "current page."
- **Mobile browser-chrome theme color.** A media-aware `themeColor` (light
  `#f4f5f7` / dark `#0d1119`, the canvas tokens) so the phone address/status bar
  matches the app in both themes instead of staying default white over the dark
  canvas. Branded custom **404** and **error** pages (recovery links + app
  chrome) replace the framework's bare defaults across ~20 `notFound()` sites.

### Added
- **Production error instrumentation.** `instrumentation.ts` (`onRequestError`)
  logs the real error + stack + route + digest to Vercel logs, so a hashed
  production digest can be traced to an exact file:line on its next occurrence.
- **Loading skeletons** for the two heaviest server routes (`jobs/[id]`,
  `reports/custom`, ~12 queries each) that previously showed a blank screen on
  navigation.
- **E2E suite grew 3 → 26 specs** (Playwright): `hr_lite` ownership isolation,
  public careers self-apply, client/vendor portal cross-tenant isolation,
  feature-flag gating (`public_api` never serves data unauthenticated), public
  token-route security, the landing page (+ compliance guard), auth session
  lifecycle (login → real signOut → gone), a broad 32-route render smoke net +
  a portal render net, an internal-API auth gate, a saved-view write round-trip,
  candidate search/filter, the quick-add menu, the candidate-preview focus trap,
  the bulk-action dropdown open/reveal, `hr_lite`'s route-level RBAC boundary
  (bounced from every org-wide/admin path), active-nav `aria-current` on desktop
  + mobile, the public careers not-found boundary (closed/missing reqs stay
  private), the branded 404 recovery links, the public vendor-signup contract
  (+ its anti-spam honeypot), and regression locks for the XSS, focus-trap,
  reduced-motion, and skip-link fixes. The whole public/unauthenticated surface
  is now covered.

### Changed
- **Design-token consistency.** Brand mark + empty-state icon moved from raw
  `rounded-2xl` to the `rounded-xl2` design token (pixel-identical; prevents
  drift if the token is retuned).
- **Bulk-action perf.** Bulk tag + stage-change collapsed their per-row
  read-N+1 into one `inArray` query (up to 500 fewer round-trips per action).
- **Stable React keys / detail-page titles / dependency trim.** Activity-feed
  rows keyed by id (not index); the 5 untitled detail pages got tab titles;
  dropped 2 unused deps (`@dnd-kit/sortable`, `postgres`).

### Documented (decision-ready, not auto-built)
- `AUTOPILOT-DEV.md` — two supervised-only fix proposals: the `db/fix-types.ts`
  `TRUNCATE`-on-deploy data-loss landmine, and the non-atomic `mergeCandidatesAction`
  (needs neon-http `db.batch`, not `db.transaction`).
- `AUTOPILOT-STRATEGY.md` — an executive summary (BLUF) over five angles:
  feature-portfolio triage, adoption/switching-cost, build-vs-buy defensibility,
  the rollout-wedge plan, and an ROI model — plus a consolidated risk register
  (R1-R8, likelihood × severity × status).
- `AUTOPILOT-PM.md` — doc-honesty audits, an Azure AD SSO proposal, and a single
  prioritized action board reconciling all findings (P0 data-loss gates → P1
  adoption → P2 posture), kept status-refreshed.
- `AUTOPILOT-INDEX.md` — a map of the nine `AUTOPILOT-*.md` files (live decision
  surfaces vs archived build history).
- `AUTOPILOT-DEV.md` also records an input-hardening completeness audit (the
  untrusted-input surface is comprehensively guarded).

## [0.1.0] — initial build
- Next.js 15 + Drizzle/Neon rebuild of the recruitment platform: candidates,
  jobs, clients, vendors, resume intake, submissions, pipeline/kanban, offers,
  interviews, reports, AI features (match/summary/search/dedupe), public careers
  + apply, client/vendor/candidate portals, role-based access (admin/hr/hr_lite/
  client/vendor/candidate), dark mode, and a 9-wave feature roadmap. See
  `ROADMAP.md` and `INTEGRATIONS.md` for the full surface.
