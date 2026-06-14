# Tru Hyre — Build Roadmap

Full feature backlog, built in dependency-ordered waves. Each wave is pushed and
verified green on Vercel before the next begins (no local typecheck on this machine —
the dev loop is edit → push → Vercel build).

Effort: **S** small · **M** medium · **L** large. ⭐ = ranked highest-leverage in the gap analysis.

---

## Wave 1 — Flagship + quick wins ✅ SHIPPED (preview build green, commit b742513)
- [x] ⭐ **Interview scheduling + Google Calendar invites** (L) — schedule/cancel from candidate page, Calendar event + Meet link, email candidate & interviewers, in-app notifications. `interviews` table, `lib/calendar.ts`, `lib/interviews.ts`.
- [x] ⭐ **Source attribution + analytics** (S) — `candidates.source` + `sourceDetail`; upload form, CSV import, inline edit; `getSourceEffectiveness` + reports funnel table.
- [x] ⭐ **SLA aging alerts via Vercel Cron** (S) — `/api/cron/sla` daily → reminder tasks + notifications for idle candidates, stale feedback, overdue interviews.
- [x] **Global command palette** (S) — ⌘K nav/search. **Already shipped** (`components/command-palette.tsx`).

> ⚠️ Live-cutover prerequisite for interviews: in Google Workspace Admin, grant the
> service account's client id domain-wide delegation for
> `https://www.googleapis.com/auth/calendar.events`, and set `GCAL_IMPERSONATE_USER`
> to the shared recruiting mailbox. Without it, scheduling still records the interview
> and emails the candidate, but no Calendar invite/Meet link is created.

## Wave 2 — Daily-loop leverage ✅ SHIPPED (preview build green, commit f173c5f)
- [x] ⭐ **Recruiter "My action items" inbox** (M) — `/inbox` + nav badge: my tasks, idle candidates I own, stale submissions I sent, my upcoming interviews, unread count.
- [x] ⭐ **Candidate comms timeline + ad-hoc email composer** (M) — emailOutbox history + template/custom send on the profile, logged + audited.
- [x] ⭐ **Structured interview scorecards** (M) — 1–5 per-criterion ratings + verdict, mirrored into the activity timeline.

## Feature flags ✅ SHIPPED (preview build green, commit 002a386)
- [x] **Admin enable/disable per feature** — `feature_flags` table + `lib/features.ts` registry; `/settings/features` toggles grouped by category; each feature gated at UI + server action (defense in depth). Disabling hides UI and blocks the action immediately. New features should register here.

## Wave 3 — AI multipliers ✅ SHIPPED (preview build green, commit 85119a4)
- [x] ⭐ **Candidate ↔ job match scoring** (L) — `lib/match.ts`: SQL skill prefilter → Claude scores shortlist 0–100 w/ reasons; `candidate_scores` cache; Recommended panel on job detail.
- [x] **AI candidate summary / highlights** (S) — button on candidate profile → generates + saves summary.
- [x] **JD generator** (S) — "Draft description" button on job form.
- [x] **Semantic resume search** (M) — `/candidates/ai-search`: NL query → criteria → SQL filter+rank; keyword fallback.
- [x] **AI screening questions** (S) — button on job form.
- [x] **AI duplicate-merge suggestions** (M) — `/candidates/duplicates`: fuzzy email/phone/name pair scan for manual review.

> Shared core: `lib/ai.ts` (Claude client + callTool/callText, no-op without `ANTHROPIC_API_KEY`). All 6 are feature-flagged (AI category) and gated UI + action. ⚠️ Need `ANTHROPIC_API_KEY` in Vercel to function live (build-safe without it).

## Wave 4 — Sourcing channels ✅ SHIPPED (preview build green, commit 7f9d2a1)
- [x] ⭐ **Public careers page + self-apply** (L) — `/careers` + `/careers/[id]` apply → parse pipeline, auto-submission, owner notify; honeypot + consent.
- [x] **Employee referral portal** (M) — `/careers/refer` form; tagged referral, notifies HR.
- [x] **Per-job public apply links** (S) — `/careers/[id]` is a shareable per-job apply link.
- [x] **LinkedIn/profile URL import** (M) — URL fields on upload override the parser.
- [x] **Talent pool / silver-medalist tagging** (M) — tag filter on candidates list + Talent pool quick link.

## Wave 5 — Pipeline & workflow ✅ SHIPPED (preview build green, commit db2c7de)
- [x] **Offer management** (L) — `offers` table + panel on candidate (comp/dates/status lifecycle). (Offer-letter PDF generation: future.)
- [x] **Job requisition approval flow** (M) — `jobs.approvalStatus`; non-admin jobs → pending; admin approve/reject banner. Flag default OFF.
- [x] **Extended bulk actions** (S) — bulk add-tag added to existing bulk stage/vendor/delete; feeds talent pool.
- [x] **Interview reminders** (S) — SLA cron notifies interviewers of same-day interviews.
- [~] **Configurable pipeline stages per job** (L) — core stage enum is fixed (reworking it breaks kanban/emails/metrics). SHIPPED as a non-destructive alternative: per-job **stage checklists** (advisory items per stage, editor on the job page, `stage_checklists` flag).
- [x] **Interview panels / multi-round** (M) — multiple interviewers + distinct multi-round tracking (roundLabel/roundIndex) + reusable **interview kits** (`/interview-kits`, `interview_kits` flag, reference panel on candidate).
- [x] **Candidate self-scheduling links** (L) — public tokenized slot-picker at `/schedule/[token]`; token is sole credential.

## Wave 6 — Communication ✅ SHIPPED (preview build green, commit ae1386e)
- [x] **Bulk email to segments** (S) — Email dropdown in candidates bulk toolbar; templated send to selection.
- [x] **Email sequences / drip** (M) — `sequence_enrollments` + `lib/sequences.ts`; enroll/cancel on candidate; cron sends due steps.
- [x] **SMS / WhatsApp notifications** (M) — `lib/sms.ts` provider abstraction + optional SMS on stage-change. ⚠️ Needs SMS provider env (SMS_PROVIDER_URL/AUTH/FROM) to actually send.
- [~] **Two-way Gmail sync** (L) — `inbound_messages` table + manual "log reply" + inbound display shipped. ⚠️ Automatic IMAP/Gmail-push sync needs external setup (not built).

## Wave 7 — Analytics & reporting ✅ SHIPPED (preview build green, commit 81db57e)
- [x] **Funnel metrics** (M) — funnel conversion %, cycle-time-per-stage, time-to-submit/offer (already in reports; now flagged).
- [x] **Vendor performance scorecard / SLA** (M) — `getVendorSlaCompliance` + dashboard leaderboard (existing, flagged).
- [x] **Recruiter productivity dashboard** (M) — `getRecruiterScoreboard` + reports table (existing, flagged).
- [x] **Scheduled report exports** (S) — weekly Monday pipeline digest emailed via cron (`scheduled_digest`).
- [x] **Diversity / EEO reporting** (M) — voluntary opt-in self-ID section on the careers form (consent-gated), `candidates.diversitySelfId`/`diversityConsent` columns, aggregate report with small-cell suppression (`diversity_reporting` flag, off by default, GDPR-conscious).
- [x] **Custom report builder** (L) — `/reports/custom`: pick a metric + date range, view a table, save report definitions.

## Wave 8 — Platform & integrations ✅ SHIPPED (preview build green, commit 6261e30)
- [x] **Webhook / integration layer** (M) — `webhooks` table + `lib/webhooks.ts`; fires candidate.stage_changed; admin UI.
- [x] **Public API + API keys** (L) — `api_keys` + `/api/v1/candidates` bearer-auth read API; admin key mgmt.
- [x] **Activity feed** (M) — `/activity` from audit log + nav.
- [x] **GDPR / data-retention tooling** (M) — `/settings/platform` GDPR overview surfacing existing export/erasure.
- [x] **Saved-view sharing** (S) — owner can share/unshare a saved candidate view org-wide from the view chip; shared views surface for all staff (`saved_view_sharing` flag).
- [~] **2FA / SSO (Azure AD)** (L) — DEFERRED: needs external IdP integration (provider config/secrets).
- [x] **Granular role permissions** (M) — additive per-user capability grants (`user_permissions` + `lib/permissions.ts`, admin UI at `/settings/users/[id]/permissions`).
- [~] **Interviewer availability sync** (M) — DEFERRED: needs Google Calendar free/busy (external).

## Wave 9 — UX & polish ✅ SHIPPED (preview build green, commit cecf593)
- [x] **PWA / installable** (M) — `app/manifest.ts`.
- [x] **Onboarding tour / empty states** (S) — dismissible welcome banner on dashboard.
- [x] **Keyboard shortcuts** (S) — ⌘K palette + list nav + shortcut help (existing, now flagged).
- [x] **Mobile-optimized views** (M) — app shell already responsive (mobile nav + grids).
- [x] **Dark mode** (S) — SHIPPED: tokenized neutrals (RGB-channel CSS vars) + `.dark` class, no-FOUC script, top-bar toggle (dark_mode flag). Brand/status hues shared; ink_inverted→green in dark.

## Roles
- [x] **hr_lite role** ✅ SHIPPED (prod, verified 11/11 E2E) — uploads resumes, changes status, comments, sees status, but ONLY on candidates they uploaded. Full hr/admin unchanged. Enforced at middleware (edge bounce off /dashboard), candidate list filter, detail 404-on-non-owner, and every mutating action via authorizeCandidate(). Seeded hrlite@truhyre.app.
