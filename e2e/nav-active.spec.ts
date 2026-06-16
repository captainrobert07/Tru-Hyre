import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Regression lock for the active-nav indicator on BOTH navs:
 *   - desktop pill nav (iter 88, NavLink)
 *   - mobile bottom nav (iter 91, MobileNavLink)
 * Both share one match rule (isNavActive in lib/utils). The contract under test
 * is the screen-reader signal: the current section's tab carries
 * aria-current="page" (the .active styling rides the same condition), and a
 * non-current tab does NOT — so it can't silently regress to "no current page".
 *
 * Locators are href-based + `:visible` on purpose: NavLink/MobileNavLink set
 * aria-current from the pathname regardless of CSS, so at any width BOTH navs'
 * /candidates links carry it — but only the one for the active viewport is
 * visible (desktop header is `hidden md:flex`, bottom nav is `md:hidden`).
 * Filtering to :visible picks the right nav without depending on link text
 * (avoids colliding with candidate-row links / headings on the page).
 *
 * Read-only: navigates to /candidates (a GET) as admin.
 */

test("desktop nav marks the current section with aria-current=page", async ({ page }) => {
  // Default chromium project is Desktop Chrome (>= md) → pill nav is visible.
  await login(page, SEEDS.admin);
  await page.goto("/candidates");
  await expect(page).toHaveURL(/\/candidates/);

  // The visible Candidates tab is the current page.
  const current = page.locator('a[href="/candidates"][aria-current="page"]:visible');
  await expect(current.first()).toBeVisible({ timeout: 15_000 });

  // No /jobs link is marked current (proves the assertion isn't vacuous).
  await expect(page.locator('a[href="/jobs"][aria-current="page"]')).toHaveCount(0);
});

test("mobile bottom nav marks the current section with aria-current=page", async ({ page }) => {
  // Phone viewport (< md): bottom nav visible, desktop header is display:none.
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, SEEDS.admin);
  await page.goto("/candidates");
  await expect(page).toHaveURL(/\/candidates/);

  const current = page.locator('a[href="/candidates"][aria-current="page"]:visible');
  await expect(current.first()).toBeVisible({ timeout: 15_000 });

  // Dashboard is also in the bottom-nav primary set but is not current here.
  await expect(page.locator('a[href="/dashboard"][aria-current="page"]')).toHaveCount(0);
});
