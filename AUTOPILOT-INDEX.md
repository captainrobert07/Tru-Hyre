# Autopilot docs — index

The repo accumulated nine `AUTOPILOT-*.md` files across two build phases and one
quality run. This index says which are **live decision surfaces** (read these)
and which are **archived build history** (done, kept for provenance, safe to
ignore). Without it, a new reader can't tell a current proposal from a shipped
2-week-old task list.

## Live — read these (the current quality run + open decisions)

| Doc | What it is | Why you'd open it |
|---|---|---|
| **AUTOPILOT-PM.md** | Product-manager log | **Start here.** Holds the single prioritized action board (P0 data-loss gates → P1 adoption → P2 posture), the SSO proposal, and honesty audits. The one decision surface. |
| **AUTOPILOT-DEV.md** | Senior-dev log | The two supervised-only fix proposals: `fix-types.ts` TRUNCATE data-loss landmine, and non-atomic `mergeCandidatesAction`. Both need a supervised session. |
| **AUTOPILOT-STRATEGY.md** | Market-strategist log | Five angles: feature triage, adoption/switching-cost, build-vs-buy, rollout wedge, ROI model. Strategic context for the roadmap. |
| **AUTOPILOT-LOG.md** | Per-iteration live log | The chronological record of every quality-run iteration (one line each). The "what happened" feed. |
| **AUTOPILOT-24H.md** | The run brief ("brain") | The operating instructions the quality run re-reads each iteration. Process, not findings. |

The open decisions, in one place, live in **AUTOPILOT-PM.md**'s action board.
`CHANGELOG.md` records what already shipped.

## Archived — build history (done & superseded, kept for provenance)

These are completed task lists from the original from-scratch build phases. They
describe states that have **all shipped** (each carries a `STATUS: … done /
shipped to production` line). Don't treat them as current plans.

| Doc | Phase |
|---|---|
| `AUTOPILOT.md` | Original build — waves 1-9 unattended |
| `AUTOPILOT-2.md` | Build run 2 — backlog buildout |
| `AUTOPILOT-3.md` | Build run 3 — tiers + dark mode + live cutover |
| `AUTOPILOT-UX.md` | UX overhaul — 14 items, all shipped |

> Candidate cleanup (supervised): once the build history is no longer needed for
> reference, these four could move to a `docs/archive/` folder or be deleted —
> left in place for now since deletion is irreversible and they're harmless.
