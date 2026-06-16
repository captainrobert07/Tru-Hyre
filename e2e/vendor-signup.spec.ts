import { test, expect } from "@playwright/test";

/**
 * Public vendor self-onboarding page (`app/careers/vendor-signup`). It's an
 * UNAUTHENTICATED write surface (a prospective agency submits its details →
 * lands pending for HR approval), gated by the `vendor_onboarding` flag, which
 * defaults OFF for the internal build (the strategist flagged it as SaaS
 * gold-plating to hide — STRATEGY iter 4 / PM board P2 #9). No spec covered it.
 *
 * Flag-AGNOSTIC contract (stays green whatever an admin sets):
 *   - flag OFF  → notFound() (no public self-onboarding surface exposed)
 *   - flag ON   → the signup form renders with its required fields AND the
 *                 honeypot stays hidden (anti-spam)
 * Either way: never a 5xx, never an auth bounce (it's public).
 *
 * Unauthenticated + read-only: it only loads the page, never submits.
 */

test("vendor-signup is either a clean 404 (flag off) or a valid public form (flag on) — never 5xx", async ({ page }) => {
  const resp = await page.goto("/careers/vendor-signup");
  expect(resp?.status() ?? 0, "should not be a 5xx").toBeLessThan(500);
  // Public route — must never bounce to login.
  await expect(page).not.toHaveURL(/\/login/);

  const submit = page.getByRole("button", { name: /apply to partner/i });
  const formShown = await submit.count();

  if (formShown > 0) {
    // Flag ON: the required fields must be present...
    await expect(page.getByLabel(/agency|company|name/i).first()).toBeVisible();
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    // ...and the honeypot ("website") must stay hidden — it's a bot trap; if it
    // ever becomes visible/focusable, real users would fill it and get rejected.
    const honeypot = page.locator('input[name="website"]');
    await expect(honeypot).toHaveCount(1);
    await expect(honeypot).toBeHidden();
  } else {
    // Flag OFF (the internal default): notFound() UI, no signup surface.
    await expect(page.getByText(/this page could not be found/i)).toBeVisible({ timeout: 15_000 });
  }
});
