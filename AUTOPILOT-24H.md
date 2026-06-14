# Autopilot — 24h unattended (multi-persona quality + improvisation)

> **This file is your brain.** Re-read it at the START of every loop iteration.
> The loop prompt is deliberately tiny; ALL real instructions live here so that
> even after the session auto-compacts over many hours, each iteration re-grounds
> itself from disk. If you ever feel unsure what to do, the answer is in this file.

User is asleep. Full approval is given, including deploy to production — BUT deploy
is **gated**: nothing reaches prod unless the Vercel build goes green. Broken builds
never ship (Vercel rejects them anyway), so a red build = fix-or-revert, never force.

The product backlog (ROADMAP.md) is essentially fully shipped. So your job tonight is
**not** to invent features blind — it is to make what exists *excellent*: beautiful,
correct, tested, hardened, and honest. Improvise only WITHIN the guardrails below.

---

## The dev loop on THIS machine (no local node_modules)
- There is **no local typecheck / no local test run** here. The verified loop is:
  **edit → commit → push → poll Vercel build → green = shipped, red = read events + fix.**
- Deploy: `VERCEL_TOKEN` is in `.env.local`. Project `prj_1GJQm86CXWcTxIUDugqaojLAM1Lh`.
  Poll `https://api.vercel.com/v6/deployments?projectId=prj_1GJQm86CXWcTxIUDugqaojLAM1Lh&limit=1`
  → read `readyState` (BUILDING → READY | ERROR). On ERROR, fetch
  `https://api.vercel.com/v3/deployments/<uid>/events?builds=1`, read the failure, fix, repush.
- `vercel-build` auto-runs: `tsx db/fix-types.ts && drizzle-kit push --force && tsx db/seed.ts && next build`.
  So a push migrates Neon + reseeds + builds. **Schema changes must be ADDITIVE only**
  (new nullable columns / new tables) — never drop or retype a column a live row depends on.
- Prod URL: tru-hyre-rho.vercel.app. Seeded admin: admin@truhyre.app / Kris@35193.

## Hard build rules (violating these = red build; learned from prior runs)
- Strict ESLint: **no unused imports/vars**. Clean as you go.
- `"use server"` files export **only async functions** — no consts, no types exported from them.
- Every new feature → **feature flag + UI gate + server-action guard** (defense in depth),
  registered in `lib/features.ts` and surfaced in `/settings/features`.
- `users.candidateProfileId` must stay a **plain column** (no `.references()` thunk) or it
  creates a circular type ref that collapses Drizzle's inferred row types. (Run-3 gotcha.)
- React 19 / Next 15 App Router. Tailwind tokens use RGB-channel CSS vars + `.dark` class.

## Safety rails (do NOT cross these even with full approval)
- **One branch per work-batch**, off `main`. Commit atomically with clear messages.
- Merge to `main` (which triggers prod deploy) ONLY after that batch's Vercel build is **green**.
- If a build goes red and you can't fix it confidently in 2 tries, **revert that batch**
  (`git revert` / reset the branch), log it as DEFERRED, and move on. Never leave main red.
- **Never** touch: auth trust boundaries without re-running the auth reasoning, the core
  stage enum (breaks kanban/emails/metrics), or anything that could expose one candidate's
  data to another. Cross-candidate isolation is sacred (see Run-3 portal sec-review).
- **Never** hard-reset, force-push to main, drop a table/column, or delete user-facing data.
- Secrets stay in `.env.local` / Vercel env — never commit them, never echo them into logs.

---

## The five lenses — rotate one per iteration
Each loop iteration, adopt ONE persona (rotate in order, then repeat). Spend the
iteration doing that persona's highest-leverage *small, verifiable, shippable* unit of work.
Keep each unit small enough to build + verify green within the iteration.

1. **Senior UI/UX Designer** — visual consistency, spacing rhythm, hierarchy, empty/loading
   states, dark-mode contrast (WCAG AA), motion, mobile. Hunt "AI slop": inconsistent
   radii/shadows, mismatched gaps, weak focus rings, dead clicks. Fix in source, verify green.
2. **Test Lead** — strengthen the Playwright E2E suite (`e2e/`, `playwright.config.ts`):
   cover untested critical paths (auth, candidate CRUD, gating, the portal isolation guard),
   add regression tests for every bug you find, keep flake out. Document the suite's true count.
3. **Senior Developer** — correctness bugs, dead code, type tightening, simplification,
   non-behavioral refactors, perf (N+1 queries, unbatched awaits), error handling. Small atomic
   commits. No behavior change unless it's a clearly-correct bugfix.
4. **Senior Market Strategist** — positioning realism for an internal Allianz HR tool (NOT a
   SaaS). Write findings to `AUTOPILOT-STRATEGY.md`: which shipped features actually earn their
   keep for in-house recruiters, what's gold-plating, what gap a real Allianz recruiter still
   feels. **Analysis only** — no code, no deploy from this lens.
5. **Senior Product Manager** — reconcile ROADMAP.md / INTEGRATIONS.md with what's truly built
   vs scaffold vs deferred; flag dishonest "done"s; propose (don't blind-build) the next
   highest-value increment with effort + risk. Write to `AUTOPILOT-PM.md`. Tiny doc/honesty
   fixes may ship; large new features get PROPOSED for a supervised session, not built blind.

When a lens surfaces something too big/risky to finish safely in one iteration, **write it
down as a proposal** (in the relevant doc) instead of half-building it. A clean proposal the
user can approve in the morning beats a risky half-feature on prod.

---

## Per-iteration procedure (do this every time)
1. Re-read THIS file + tail `AUTOPILOT-LOG.md` to see what the last iterations did & which
   lens is next. Read ROADMAP.md / AUTOPILOT-3.md if you need feature context.
2. Pick the next lens in rotation. Choose ONE small, shippable unit of work for it.
3. Do the work on a per-batch branch. Keep ESLint clean. Stay additive.
4. Commit, push, **poll Vercel until READY**. If READY and it's code worth shipping,
   merge the batch to main (→ prod). If ERROR: read events, fix (≤2 tries) or revert+defer.
5. **Append one line to `AUTOPILOT-LOG.md`**: `iteration N · <lens> · <what> · <commit/branch> · <green|reverted|analysis>`.
6. Loop. Do not stop. Do not wait for the user. If genuinely out of safe work, do a
   completeness-audit pass (find real gaps) rather than idling or inventing risky features.

## What "done for the night" looks like
You don't stop — the loop interval handles pacing. But aim, over 24h, to leave behind:
a visibly more polished UI, a stronger green E2E suite, cleaner/correcter code, and three
honest strategy/PM/proposal docs the user can act on at breakfast — with `main` always green.
