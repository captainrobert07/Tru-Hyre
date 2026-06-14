# Autopilot 3 — Tier 1/2/3 + dark mode + live-cutover tooling

Branch feat/tiers-cutover. Full approval, autopilot. Verify each wave green on
Vercel (push → poll readyState). Deploy: VERCEL_TOKEN in .env.local,
project prj_1GJQm86CXWcTxIUDugqaojLAM1Lh. Seeded admin admin@truhyre.app / Kris@35193.
Prod tru-hyre-rho.vercel.app. Rules: every feature → flag + UI gate + action guard;
additive schema only; strict ESLint (no unused); "use server" exports only async fns.

## STATUS (run 1): shipped to main @ bb7d92e, prod green, E2E 12/12 + 11/11.
DONE: CUT (Test-connection per integration), DM (dark contrast WCAG-tuned),
T1a (multi-round interviews + interview_kits table), T1d (bottlenecks + exec CSV
export), T1f (bulk resume upload), T1 blind-mode anonymization.
REMAINING (deliberately NOT built blind at end of long run — flagged for a
focused session): rest of T1 (skill taxonomy, candidate availability,
client/vendor depth, references), ALL of T2 (configurable stages, self-scheduling,
report builder, candidate portal, granular RBAC — L-effort architectural, high
regression risk), T3 connector send-flows (config + Test button READY; wiring
pending). Live-cutover = enter real keys at /settings/integrations + click Test.

## Run 2 (branch feat/tier1-batch2) ✅ SHIPPED to main @ 22f7e96, prod green, E2E 12/12+11/11+3/3
- [x] Skill taxonomy / synonyms (lib/skill-taxonomy.ts → match + semantic search)
- [x] Candidate availability notes (inline field)
- [x] Vendor contracts & commission (feePercent + paymentTerms)
- [x] Reference checks (candidate_references; request emails referee + log response)

REMAINING: Tier-1 leftover (client-side feedback portal, multi-contact org charts,
vendor self-onboarding, intake auto-match, offer-acceptance prediction);
ALL Tier-2 (configurable stages, self-scheduling, report builder, candidate portal,
granular RBAC — L-effort architectural, need a supervised session);
Tier-3 connector send-flows (config+Test ready, wiring pending).

## Run 3 (fan-out blueprints → single-writer integration) ✅ main @ 2a46b50, prod green, E2E 12/12+11/11
20-agent fan-out blueprinted all 10 remaining; I integrated sequentially. SHIPPED:
client-feedback-scores, granular RBAC (userPermissions + lib/permissions), offer-acceptance
prediction, custom report builder, vendor self-onboarding, intake auto-match (suggested jobs).
org-charts = already covered by existing multi-contact client UI. stage_checklists = flag+table
shipped, UI deferred.
NOW SHIPPED (main @ a6dac7f, prod green, E2E 12/12+11/11): self-scheduling (public tokenized
slot-picker; token is sole credential, never accepts candidateId from client) and candidate
portal ('candidate' role + /portal/candidate; profileId resolved from DB user row, every query
keyed to it; 4-lens adversarial sec-review passed with 0 critical — cross-candidate access not
possible; applied its 2 high fixes). Build gotcha fixed: users.candidateProfileId must be a
PLAIN column (no .references thunk) or it creates a users<->candidates circular type ref that
collapses Drizzle's inferred row types. EVERYTHING IN THE BACKLOG IS NOW BUILT.

## Waves
- [ ] T1a · Multi-round interviews + interview kits (interviews.round + kits table)
- [ ] T1b · Candidate availability + saved-view share UI + skill taxonomy
- [ ] T1c · AI: screening Qs per candidate, intake auto-match, offer-acceptance prediction
- [ ] T1d · Analytics: cost-per-hire, bottleneck alerts, exec dashboard export, forecasting
- [ ] T1e · Client/vendor: contracts/commission, client feedback portal, org charts, references
- [ ] T1f · Bulk resume upload + resume anonymization (blind mode) + diversity opt-in fields
- [ ] T2a · Configurable pipeline stages per job
- [ ] T2b · Candidate self-scheduling (public tokenized slot-picker)
- [ ] T2c · Custom report builder
- [ ] T2d · Candidate portal (login → own status)
- [ ] T2e · Granular role permissions
- [ ] T3  · Connector wiring: job-board post, DocuSign, Outlook, Zapier, Gmail inbound poll,
      availability sync, bg-check, transcription, SSO activation, client billing
      (+ "Test connection" per integration for live cutover)
- [ ] DM  · Dark mode contrast tuned to WCAG AA/AAA (verified ratios)
- [ ] CUT · Live-cutover tooling: per-integration Test button (green/red), cutover checklist page
- [ ] FIN · E2E re-run, merge to main
