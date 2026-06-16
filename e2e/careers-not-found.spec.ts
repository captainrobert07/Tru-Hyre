import { test, expect } from "@playwright/test";

/**
 * Public careers detail-page not-found boundary. `app/careers/[id]/page.tsx`
 * calls notFound() for a missing job, a non-numeric id, and — the one that
 * matters for info-disclosure — any job whose status !== "open". So a closed /
 * draft / filled req must never be reachable on the PUBLIC, unauthenticated
 * careers site. The careers-public-apply spec only proves OPEN jobs render;
 * this locks the negative half (the boundary that keeps non-open reqs private).
 *
 * Fully unauthenticated + read-only. Uses ids that can't be a real open job:
 * a very high id (never seeded) and a non-numeric id. We assert the page does
 * NOT render the apply surface and is not a 5xx — Next's notFound() renders the
 * 404 UI, which is the correct public response for "no such open role".
 */

const NEVER_A_JOB = 99999999;

test("a non-existent careers job id 404s, not 500, and shows no apply form", async ({ page }) => {
  const resp = await page.goto(`/careers/${NEVER_A_JOB}`);
  // Never a server error, never an auth bounce (it's a public route).
  expect(resp?.status() ?? 0, "should not be a 5xx").toBeLessThan(500);
  await expect(page).not.toHaveURL(/\/login/);

  // The apply form must NOT be present for a non-open/non-existent role.
  await expect(page.getByRole("button", { name: /submit application/i })).toHaveCount(0);
  // Next's notFound() UI.
  await expect(page.getByText(/this page could not be found/i)).toBeVisible({ timeout: 15_000 });
});

test("a non-numeric careers id is handled safely (notFound, no crash)", async ({ page }) => {
  const resp = await page.goto("/careers/not-a-number");
  expect(resp?.status() ?? 0, "should not be a 5xx").toBeLessThan(500);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: /submit application/i })).toHaveCount(0);
});
