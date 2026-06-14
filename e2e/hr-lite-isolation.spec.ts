import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * hr_lite ownership isolation — the "sacred" cross-tenant invariant.
 *
 * hr_lite users may ONLY ever see candidates they uploaded themselves
 * (candidates.uploadedById === self). Enforcement is defense-in-depth:
 *   - list:   app/(app)/candidates/page.tsx filters uploadedById = self
 *   - detail: app/(app)/candidates/[id]/page.tsx calls notFound() when
 *             a lite user opens a candidate they don't own
 *   - actions: every mutating action runs authorizeCandidate()
 *
 * The seed makes this directly testable: all demo candidates
 * (TH-DEMO-001/002/003) are owned by hr@truhyre.app, and the seeded
 * hrlite@truhyre.app user uploads nothing. So hr_lite must see an EMPTY
 * candidate list, and a direct hit on an hr-owned id must 404.
 *
 * The owned id is discovered at runtime (read off an hr list row link)
 * rather than hardcoded, so the test survives reseeds that renumber ids.
 */

test.describe.configure({ mode: "serial" });

let ownedCandidateId: string | null = null;

test("hr owns at least one candidate (discover a real id)", async ({ page }) => {
  await login(page, SEEDS.hr);
  await page.goto("/candidates");
  await expect(page.getByRole("heading", { name: "Candidates" })).toBeVisible();

  const firstRow = page.locator("a[href^='/candidates/']").first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  const href = await firstRow.getAttribute("href");
  const m = href?.match(/\/candidates\/(\d+)/);
  expect(m, `expected an /candidates/<id> link, got ${href}`).toBeTruthy();
  ownedCandidateId = m![1];

  // Sanity: hr can actually open it.
  await page.goto(`/candidates/${ownedCandidateId}`);
  await expect(page.getByText(/Experience/i)).toBeVisible({ timeout: 15_000 });
});

test("hr_lite sees NONE of hr's candidates in the list", async ({ page }) => {
  await login(page, SEEDS.hrLite);
  await page.goto("/candidates");
  await expect(page.getByRole("heading", { name: "Candidates" })).toBeVisible();

  // The seeded hr_lite user uploaded nothing → list must contain no
  // candidate detail links at all.
  await expect(page.locator("a[href^='/candidates/']")).toHaveCount(0);
});

test("hr_lite gets 404 opening an hr-owned candidate directly", async ({ page }) => {
  expect(ownedCandidateId, "owned id was not discovered in the first test").toBeTruthy();
  await login(page, SEEDS.hrLite);

  await page.goto(`/candidates/${ownedCandidateId}`);

  // notFound() renders Next's default 404. The candidate's working surface
  // (the Experience KPI / packet actions) must NOT be present.
  await expect(page.getByText(/this page could not be found/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Generate packet|Regenerate packet/i)).toHaveCount(0);
});
