import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Locks the iter-111 BRANDED 404 (app/not-found.tsx). The other specs that hit
 * notFound() (hr-lite-isolation, careers-not-found) only assert the text "could
 * not be found" — which Next's BARE default 404 also shows, so a revert to the
 * default would leave them green while silently losing the brand + the way back.
 * This asserts the part that's actually custom: the recovery links, and that
 * one of them navigates to a real app route. A non-existent candidate id
 * (99999999, never seeded) triggers notFound() in candidates/[id]/page.tsx.
 *
 * Read-only navigation.
 */

test("a missing record renders the branded 404 with a working way back", async ({ page }) => {
  await login(page, SEEDS.admin);
  await page.goto("/candidates/99999999");

  // The shared notFound() UI: keeps the contract text...
  await expect(page.getByText(/this page could not be found/i)).toBeVisible({ timeout: 15_000 });

  // ...AND the branded recovery affordances Next's default 404 does NOT have.
  const backLink = page.getByRole("link", { name: /back to/i });
  await expect(backLink).toBeVisible();
  await expect(page.getByRole("link", { name: /^candidates$/i })).toBeVisible();

  // The primary "back" link is a real, working route (not a dead affordance).
  await expect(backLink).toHaveAttribute("href", "/dashboard");
  await backLink.click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
});
