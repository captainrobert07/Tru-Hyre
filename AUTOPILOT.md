# Autopilot log — building all remaining waves unattended

User is asleep; all approvals are given. Build waves 4–9, verify each on Vercel
(push → poll deploy READY), register EVERY feature in `/settings/features`
(lib/features.ts), then run end-to-end HTTP functional testing. Do not stop.

Deploy verify: `VERCEL_TOKEN` in `.env.local`, project `prj_1GJQm86CXWcTxIUDugqaojLAM1Lh`.
Poll `https://api.vercel.com/v6/deployments?projectId=...&limit=1` → readyState.
On ERROR, fetch `/v3/deployments/<uid>/events?builds=1`, fix, repush.

Build rules: strict ESLint (no unused imports), `"use server"` files export only
async fns, additive schema only, every feature → feature flag + UI gate + action guard.

## Branch chain (each off the prior so final branch has everything)
- feat/wave1-interviews-source-sla ✅ green
- feat/wave2-inbox-comms-scorecards ✅ green
- feat/feature-flags ✅ green
- feat/wave3-ai ✅ green (2eaa737)
- feat/wave4-sourcing ✅ green (7f9d2a1)
- feat/wave5-pipeline ✅ green (db2c7de)
- feat/wave6-comms ✅ green (ae1386e)
- feat/wave7-analytics ⏳ IN PROGRESS

## Status
- [x] Wave 4 — Sourcing (careers page, referral portal, apply links, LinkedIn import, talent pool)
- [x] Wave 5 — Pipeline (offers, requisition approval, bulk tag, interview reminders; configurable stages + self-schedule deferred honestly)
- [x] Wave 6 — Communication (bulk email, drip sequences, SMS provider, inbound log; auto Gmail sync external)
- [ ] Wave 6 — Communication (two-way Gmail*, SMS*, sequences, bulk email)
- [ ] Wave 7 — Analytics (funnel, vendor scorecard, recruiter dashboard, diversity, scheduled exports, report builder)
- [ ] Wave 8 — Platform (2FA/SSO*, granular perms, webhooks, availability sync, GDPR tooling, public API*, activity feed, saved-view sharing)
- [ ] Wave 9 — UX (mobile, dark mode, keyboard shortcuts, onboarding, PWA)
- [ ] Final: confirm ALL features in /settings/features
- [ ] Final: end-to-end HTTP functional test of preview deploy

(* = needs external infra; build in-app portion, flag the external config step.)
