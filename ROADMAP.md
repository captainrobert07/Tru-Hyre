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

## Wave 3 — AI multipliers (Claude already wired in `lib/parse-ai.ts`)
- [ ] ⭐ **Candidate ↔ job match scoring** (L) — SQL prefilter → Claude scores shortlist 0–100 with reasons; `candidate_scores` table.
- [ ] **AI candidate summary / highlights** (S)
- [ ] **JD generator** (S)
- [ ] **Semantic resume search** (M)
- [ ] **AI screening questions** (S)
- [ ] **AI duplicate-merge suggestions** (M)

## Wave 4 — Sourcing channels
- [ ] ⭐ **Public careers page + self-apply** (L) — `/careers` feeds the parse pipeline.
- [ ] **Employee referral portal** (M)
- [ ] **Per-job public apply links** (S)
- [ ] **LinkedIn/profile URL import** (M)
- [ ] **Talent pool / silver-medalist tagging** (M)

## Wave 5 — Pipeline & workflow
- [ ] **Offer management + offer letters** (L)
- [ ] **Job requisition approval flow** (M)
- [ ] **Configurable pipeline stages per job** (L)
- [ ] **Extended bulk actions** (S)
- [ ] **Interview reminders** (S)
- [ ] **Interview panels / multi-round** (M)
- [ ] **Candidate self-scheduling links** (L)

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
