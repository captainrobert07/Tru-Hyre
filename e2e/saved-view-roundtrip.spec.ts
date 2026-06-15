import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * The first WRITE round-trip in the suite. Every other spec is read-only (by
 * design — they run against prod). Saved views are the one mutation that's
 * cleanly self-disposable: scoped to the logged-in admin, trivial data, with
 * both a create and a delete affordance — so this creates one, verifies it
 * PERSISTED (survives a reload, proving the server action wrote it), then
 * deletes it, leaving prod exactly as it was.
 *
 * This is what catches a regression in the create/delete server actions +
 * revalidation that no read-only test can. Uses a distinctive name and always
 * attempts cleanup so a mid-test failure doesn't leave litter.
 */

const VIEW_NAME = "e2e-roundtrip-tmp-view";

test.describe.configure({ mode: "serial" });

test("create → persist (reload) → delete a saved view", async ({ page }) => {
  await login(page, SEEDS.admin);
  // A filter must be active for the "Save view" affordance to appear.
  await page.goto("/candidates?q=zzdistinctfilter");

  // Defensive: if a prior failed run left this view, remove it first.
  const stale = page.getByRole("button", { name: new RegExp(`Delete view ${VIEW_NAME}`, "i") });
  if (await stale.count()) {
    await stale.first().click();
    await page.getByRole("button", { name: /delete view/i }).click();
    await expect(page.getByText(VIEW_NAME)).toHaveCount(0, { timeout: 10_000 });
  }

  // CREATE
  await page.getByRole("button", { name: /save view/i }).click();
  await page.getByPlaceholder("View name").fill(VIEW_NAME);
  await page.getByRole("button", { name: /^save$/i }).click();
  await expect(page.getByText(VIEW_NAME)).toBeVisible({ timeout: 15_000 });

  // PERSIST: reload and confirm the server actually stored it.
  await page.goto("/candidates");
  await expect(page.getByText(VIEW_NAME)).toBeVisible({ timeout: 15_000 });

  // DELETE (self-cleanup) — goes through the confirm dialog.
  await page.getByRole("button", { name: new RegExp(`Delete view ${VIEW_NAME}`, "i") }).first().click();
  await page.getByRole("button", { name: /delete view/i }).click();
  await expect(page.getByText(VIEW_NAME)).toHaveCount(0, { timeout: 15_000 });

  // PERSIST the deletion: reload, confirm it's truly gone (not just hidden).
  await page.goto("/candidates");
  await expect(page.getByText(VIEW_NAME)).toHaveCount(0);
});
