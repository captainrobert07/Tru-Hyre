import { test, expect } from "@playwright/test";

/**
 * The SLA cron route (`/api/cron/sla`) writes tasks + notifications, so it must
 * not be triggerable by an arbitrary caller. It self-authenticates (the
 * auth.config allowlist exempts `/api/cron`, so the route itself is the gate):
 *   - if CRON_SECRET is set (production), ONLY `Authorization: Bearer <secret>`
 *     passes — the `x-vercel-cron` header is client-spoofable and must NOT bypass it
 *   - else it falls back to the x-vercel-cron header / non-prod
 * No spec covered this gate.
 *
 * Environment-agnostic contract (holds whether or not CRON_SECRET is set in the
 * deployed env): a request the route must reject in production gets 401 and does
 * NOT run the sweep. We send (a) no credentials and (b) a bogus Bearer — both
 * must 401 against a production deployment (NODE_ENV=production + no real secret
 * match + no trusted cron header). Read-only: a 401 means the sweep never ran.
 */

test("the SLA cron route rejects an unauthenticated caller (401, no sweep)", async ({ request }) => {
  const r = await request.get("/api/cron/sla", { failOnStatusCode: false });
  // Must not execute for an anonymous browser-style caller.
  expect([401, 403], `expected 401/403, got ${r.status()}`).toContain(r.status());
  // And it must not have returned a success/ran-the-sweep body.
  const body = await r.text();
  expect(body).not.toMatch(/"ok"\s*:\s*true/i);
});

test("a spoofed Bearer token does not pass the SLA cron gate", async ({ request }) => {
  const r = await request.get("/api/cron/sla", {
    headers: { authorization: "Bearer not-the-real-cron-secret-zzz999" },
    failOnStatusCode: false,
  });
  expect([401, 403], `a wrong Bearer should be rejected, got ${r.status()}`).toContain(r.status());
  const body = await r.text();
  expect(body).not.toMatch(/"ok"\s*:\s*true/i);
});
