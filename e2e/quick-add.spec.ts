import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Quick-add create menu — mounted app-shell-wide, opened by the "N" keyboard
 * shortcut or the floating + button, with create links (candidate/job/client/…).
 * Untested until now. Read-only: asserts open/contents/close without following
 * a create link. Also exercises the global-shortcut "not while typing" guard.
 */

test("the 'N' shortcut opens the quick-add menu; Escape closes it", async ({ page }) => {
  await login(page, SEEDS.admin);
  await expect(page).toHaveURL(/\/dashboard/);

  // Body-focused (not in an input) → "N" opens the menu.
  await page.locator("body").click();
  await page.keyboard.press("n");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: /create new/i })).toBeVisible();
  await expect(page.getByText("New candidate")).toBeVisible();
  await expect(page.getByText("New job")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0, { timeout: 10_000 });
});

test("the floating Quick-add button opens the same menu", async ({ page }) => {
  await login(page, SEEDS.admin);
  await page.getByRole("button", { name: /quick add/i }).click();
  await expect(page.getByRole("heading", { name: /create new/i })).toBeVisible({ timeout: 10_000 });
});

test("'N' does NOT trigger while typing in a field", async ({ page }) => {
  await login(page, SEEDS.hr);
  await page.goto("/candidates");
  // Type into the search box — the "n" must go into the field, not open the menu.
  const box = page.getByRole("searchbox").first();
  await box.fill("engineer"); // contains 'n', typed while focused
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(box).toHaveValue("engineer");
});
