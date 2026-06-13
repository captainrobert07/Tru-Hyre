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

## Run 2 (branch feat/tier1-batch2) — safe Tier-1 remainder
- [ ] Skill taxonomy / synonyms (normalize "JS"→"JavaScript" in match + search)
- [ ] Candidate availability (availableFrom already exists; add availability notes + surface)
- [ ] Vendor contracts & commission (fee %, payout-on-hire tracking)
- [ ] Reference checks (request + collect via email; references table)

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
