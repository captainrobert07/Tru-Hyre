import { test, expect } from "@playwright/test";

/**
 * Regression lock for the iter-81 prefers-reduced-motion fix (WCAG 2.3.3).
 * The global @media(prefers-reduced-motion: reduce) block collapses every
 * element's transition/animation to ~instant. Verified on the public login
 * page (a .btn-primary has `transition-all`), so no auth needed.
 *
 * Reads the COMPUTED transition-duration under each media state — the control
 * (no-preference) case proves the assertion is meaningful, not vacuously true.
 */

function maxTransitionMs(durationStr: string): number {
  // e.g. "0.01ms" or "0.15s, 0.3s" → largest in ms
  return Math.max(
    0,
    ...durationStr.split(",").map((s) => {
      const t = s.trim();
      if (t.endsWith("ms")) return parseFloat(t);
      if (t.endsWith("s")) return parseFloat(t) * 1000;
      return 0;
    }),
  );
}

test("reduce-motion collapses transitions to ~instant", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  const btn = page.getByRole("button", { name: /sign in/i }).first();
  await expect(btn).toBeVisible();
  const dur = await btn.evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(maxTransitionMs(dur), `reduce-motion should collapse transition (got ${dur})`).toBeLessThanOrEqual(1);
});

test("control: without the preference, the same element keeps its transition", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/login");
  const btn = page.getByRole("button", { name: /sign in/i }).first();
  await expect(btn).toBeVisible();
  const dur = await btn.evaluate((el) => getComputedStyle(el).transitionDuration);
  // Proves the reduce assertion isn't vacuously true: normally it's > 1ms.
  expect(maxTransitionMs(dur), `default should keep a real transition (got ${dur})`).toBeGreaterThan(1);
});
