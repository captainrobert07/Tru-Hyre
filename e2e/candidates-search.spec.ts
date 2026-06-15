import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Candidate search/filter flow — the single most-used recruiter interaction
 * (type a query → results filter → filter chip appears → Clear resets). The
 * golden-path spec opens the list but never searches, so the ?q= plumbing
 * (ListToolbar → router.replace → server re-query → FilterChip) was untested.
 *
 * Asserts BEHAVIOR, not counts, so it holds against real prod data on top of
 * the seed: a distinctive seeded name surfaces that candidate + a filter chip;
 * a gibberish query shows the "No matches" empty state; Clear removes the
 * filter. Read-only.
 */

test.describe.configure({ mode: "serial" });

test("searching a seeded name filters to it and shows a filter chip", async ({ page }) => {
  await login(page, SEEDS.hr);
  await page.goto("/candidates");

  const box = page.getByRole("searchbox").first();
  await box.fill("Priya Raman");
  await box.press("Enter");

  // URL reflects the query, the candidate is shown, and a filter chip appears.
  await expect(page).toHaveURL(/[?&]q=Priya/i, { timeout: 15_000 });
  await expect(page.getByText("Priya Raman").first()).toBeVisible();
  await expect(page.getByText(/Filters:/i)).toBeVisible();
});

test("a no-match query shows the 'No matches' empty state", async ({ page }) => {
  await login(page, SEEDS.hr);
  await page.goto("/candidates?q=zzzznotarealcandidatename9999");

  await expect(page.getByText(/no matches/i)).toBeVisible({ timeout: 15_000 });
  // No candidate row links rendered for a no-match query.
  await expect(page.locator("a[href^='/candidates/']")).toHaveCount(0);
});

test("'Clear all' removes the active filter", async ({ page }) => {
  await login(page, SEEDS.hr);
  await page.goto("/candidates?q=Priya");
  await expect(page.getByText(/Filters:/i)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: /clear all/i }).click();
  await expect(page).toHaveURL(/\/candidates$/);
  await expect(page.getByText(/Filters:/i)).toHaveCount(0);
});
