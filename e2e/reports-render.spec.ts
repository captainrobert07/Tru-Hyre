import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Content contract for /reports — the heaviest aggregate page after the
 * dashboard. It runs many lib/metrics.ts queries (coverage ratio, submission
 * forecast, funnel/bottlenecks, source-of-hire, vendor SLA, recruiter
 * scoreboard, cycle time). Until now it was only covered by the route-render
 * smoke net ("doesn't 5xx") + RBAC negatives — nothing asserted it actually
 * renders its metric sections. A metrics edge case (empty pipeline, a division)
 * that blanks a section would slip past a pure 5xx check.
 *
 * Asserts the page loads as admin and its real section headers render — i.e.
 * the aggregate data resolved, not just the chrome. Read-only (GET /reports).
 */

test("the reports page renders its metric sections (not a blank/crashed shell)", async ({ page }) => {
  await login(page, SEEDS.admin);
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/reports/);

  // PageHeader <h1>.
  await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible({ timeout: 15_000 });

  // Distinctive metric section headers — each is driven by a separate
  // lib/metrics.ts query, so seeing them means the aggregate data resolved.
  await expect(page.getByRole("heading", { name: /Pipeline bottlenecks/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Submission forecast/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Vendor SLA compliance/i })).toBeVisible();

  // A KPI value that exercises the forecast/coverage math (iter-133 touched this):
  // the "Coverage ratio" stat label is present and the page didn't error out.
  await expect(page.getByText(/Coverage ratio/i)).toBeVisible();
});
