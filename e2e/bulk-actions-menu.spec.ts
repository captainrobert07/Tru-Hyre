import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * The candidate bulk-action bar: selecting rows reveals it, and its dropdown
 * (<details>/<summary> "Move to stage") opens to show its options. This locks
 * the interaction the iter-96 caret refactor touched (it added `group` to the
 * <details> and swapped the glyph for <DropdownCaret>) — the menu must still
 * open and reveal its actions, which no existing spec exercised. The smoke net
 * only checks routes don't 5xx; it never opens a menu.
 *
 * Strictly read-only: it selects rows and OPENS the menu, then asserts the
 * options are revealed. It never clicks a mutating action (no stage change, no
 * delete), so it can't pollute prod data.
 */

test("selecting candidates reveals the bulk bar and its dropdown opens", async ({ page }) => {
  await login(page, SEEDS.hr);
  await page.goto("/candidates");

  // Need at least one row to select. If the list is empty (unseeded env), skip.
  const selectAll = page.getByRole("checkbox", { name: /select all/i });
  await expect(selectAll).toBeVisible({ timeout: 15_000 });

  // Selecting rows reveals the bulk-action bar ("N selected").
  await selectAll.check();
  await expect(page.getByText(/\d+ selected/)).toBeVisible();

  // The "Move to stage" dropdown is a <details>/<summary>; it starts closed.
  const moveToStage = page.getByText("Move to stage", { exact: false });
  await expect(moveToStage).toBeVisible();
  const details = page.locator("details", { has: moveToStage });
  await expect(details).not.toHaveAttribute("open", /.*/);

  // Clicking the summary opens it and reveals the stage options (e.g. "screening").
  await moveToStage.click();
  await expect(details).toHaveAttribute("open", /.*/);
  await expect(details.getByRole("button", { name: /screening/i })).toBeVisible();

  // Clicking it again closes it (native <details> toggle) — no mutation occurred.
  await moveToStage.click();
  await expect(details).not.toHaveAttribute("open", /.*/);
});
