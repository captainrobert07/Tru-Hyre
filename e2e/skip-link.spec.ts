import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Regression lock for the iter-86 skip-to-content link + <main> landmark
 * (WCAG 2.4.1 Bypass Blocks / 1.3.1). On every authenticated page the shell
 * must expose a "Skip to content" link targeting #main-content, and the
 * content region must be a <main id="main-content"> landmark.
 */

test("the app shell exposes a skip-link and a <main> landmark", async ({ page }) => {
  await login(page, SEEDS.admin);
  await expect(page).toHaveURL(/\/dashboard/);

  // The <main id="main-content"> landmark exists.
  const main = page.locator("main#main-content");
  await expect(main).toHaveCount(1);

  // The skip-link exists and targets it (sr-only, so check by attribute, not visibility).
  const skip = page.getByRole("link", { name: /skip to content/i });
  await expect(skip).toHaveAttribute("href", "#main-content");
});

test("the skip-link is visually hidden until focused, then reveals", async ({ page }) => {
  await login(page, SEEDS.admin);

  const skip = page.getByRole("link", { name: /skip to content/i });
  // sr-only by default → 0-size / clipped, so Playwright considers it hidden.
  await expect(skip).toBeHidden();

  // Focusing it (focus:not-sr-only) makes it a real, visible control.
  await skip.focus();
  await expect(skip).toBeVisible();
});
