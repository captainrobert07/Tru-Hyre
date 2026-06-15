import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Candidate quick-preview slide-over + its focus management (iter-71 useFocusTrap).
 * Two untested things in one read-only flow: the preview panel opens and shows
 * the candidate, AND opening it moves focus INTO the dialog / Escape restores
 * focus to the trigger (WCAG 2.4.3, the iter-71 fix). Read-only — preview is a GET.
 */

test("opening a candidate preview traps focus, and Escape restores it", async ({ page }) => {
  await login(page, SEEDS.hr);
  await page.goto("/candidates");

  // Find a preview trigger (per-row "Preview {name}" button). Use the first one
  // present rather than a specific seeded name, so it's robust to list contents.
  const trigger = page.getByRole("button", { name: /^preview /i }).first();
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.focus();
  await trigger.click();

  // The slide-over dialog opens.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Focus moved INTO the dialog (the iter-71 focus-trap), not left on the row.
  const focusInside = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return !!dlg && !!document.activeElement && dlg.contains(document.activeElement);
  });
  expect(focusInside, "focus should move into the opened dialog").toBe(true);

  // Escape closes it (SlideOver's own handler) and focus is restored to the
  // trigger (useFocusTrap restore).
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0, { timeout: 10_000 });
  const focusRestored = await page.evaluate(
    () => document.activeElement?.getAttribute("aria-label")?.toLowerCase().startsWith("preview") ?? false,
  );
  expect(focusRestored, "focus should return to the Preview trigger on close").toBe(true);
});
