import { test, expect } from "@playwright/test";

/**
 * Public token-as-sole-credential routes — the unauthenticated surfaces where a
 * URL token IS the auth. The security contract: a bad/guessed token must never
 * render the actionable surface (set-password form / slot picker) and must
 * never 500 — it degrades to a safe "invalid" state.
 *
 *   /invite/[token]   → set-password onboarding; bad token renders a friendly
 *                       "Invitation not found" shell, no form (page.tsx:24)
 *   /schedule/[token] → candidate self-scheduling; bad token notFound()s, and
 *                       the route is also gated by the self_scheduling flag
 *                       (default OFF → 404 regardless) (page.tsx:13,17)
 *
 * Unauthenticated + read-only: visiting a bogus token writes nothing, so this
 * is safe to run against prod. Tokens are random strings that won't collide
 * with any real seeded link.
 */

const BOGUS = "definitely-not-a-real-token-zzz999";

test("/invite/[token] with a bad token shows a safe invalid state, not a form", async ({ page }) => {
  const resp = await page.goto(`/invite/${BOGUS}`);
  // Never a server error.
  expect(resp?.status() ?? 0, "must not 5xx").toBeLessThan(500);

  // Friendly invalid messaging, and crucially NO password-set form.
  await expect(page.getByText(/invitation not found|invalid|expired|revoked/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /set (your )?password|activate|accept/i })).toHaveCount(0);
});

test("/schedule/[token] with a bad token never renders a slot picker", async ({ page }) => {
  const resp = await page.goto(`/schedule/${BOGUS}`);
  expect(resp?.status() ?? 0, "must not 5xx").toBeLessThan(500);

  // Either 404 (bad token or flag off) — never an actionable booking surface.
  // A booking button would indicate a leaked/valid-looking link.
  await expect(page.getByRole("button", { name: /book|confirm|request (a )?slot|schedule/i })).toHaveCount(0);
});

test("tokenized routes do not leak candidate PII for a bogus token", async ({ page }) => {
  for (const path of [`/invite/${BOGUS}`, `/schedule/${BOGUS}`]) {
    await page.goto(path);
    const body = (await page.locator("body").innerText()).toLowerCase();
    // A safe invalid page should not contain an email address or phone-like
    // digit run from a real record.
    expect(body, `${path} should not surface an @-email`).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  }
});
