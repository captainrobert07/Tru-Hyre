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
- [~] **Configurable pipeline stages per job** (L) — DEFERRED: reworking the core stage enum would break kanban/emails/metrics; not done to protect stability.
- [~] **Interview panels / multi-round** (M) — PARTIAL: interviews already support multiple interviewers; distinct multi-round tracking deferred.
- [~] **Candidate self-scheduling links** (L) — flag registered, UI DEFERRED (needs public tokenized slot-picker + availability model). Not faked.

## Wave 6 — Communication
- [ ] **Two-way Gmail sync** (L)
- [ ] **SMS / WhatsApp notifications** (M)
- [ ] **Email sequences / drip** (M)
- [ ] **Bulk email to segments** (S)

## Wave 7 — Analytics & reporting
- [ ] **Funnel metrics** (time-to-fill, time-in-stage, conversion %) (M)
- [ ] **Vendor performance scorecard / SLA** (M)
- [ ] **Recruiter productivity dashboard** (M)
- [ ] **Diversity / EEO reporting** (M)
- [ ] **Scheduled report exports** (S)
- [ ] **Custom report builder** (L)

## Wave 8 — Platform & integrations
- [ ] **2FA / SSO (Azure AD)** (L)
- [ ] **Granular role permissions** (M)
- [ ] **Webhook / integration layer** (M)
- [ ] **Interviewer availability sync** (M)
- [ ] **GDPR / data-retention tooling** (M)
- [ ] **Public API + API keys** (L)
- [ ] **Activity feed** (M)
- [ ] **Saved-view sharing** (S)

## Wave 9 — UX & polish
- [ ] **Mobile-optimized views** (M)
- [ ] **Dark mode** (S)
- [ ] **Keyboard shortcuts** (S)
- [ ] **Onboarding tour / empty states** (S)
- [ ] **PWA / installable** (M)
