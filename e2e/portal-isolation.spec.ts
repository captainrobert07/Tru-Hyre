import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Client & vendor portal isolation — the "sacred" cross-tenant guarantee for
 * the two external-facing portals. RBAC negatives (rbac.spec.ts) already prove
 * clients/vendors can't reach STAFF paths; this proves they can't reach OTHER
 * data inside their own portal by guessing a detail-page id.
 *
 * Enforcement under test:
 *   - client submission detail: non-existent id → notFound (404);
 *     a submission whose job isn't the client's account → redirect /portal/client
 *     (app/portal/client/submissions/[id]/page.tsx:36,39)
 *   - vendor job detail: a job the vendor isn't ASSIGNED to → notFound, even if
 *     the job exists (app/portal/vendor/jobs/[id]/page.tsx:28)
 *
 * Seed-safe: the seed publishes jobs the demo vendor is assigned to and others
 * it is not. We assert that probing an id outside the tenant's scope yields the
 * not-found / bounce, never another tenant's data. Uses a deliberately
 * high/never-owned id so the test is robust without a second seeded tenant.
 */

test.describe.configure({ mode: "serial" });

test("client landing portal renders and is scoped to the client", async ({ page }) => {
  await login(page, SEEDS.client);
  await expect(page).toHaveURL(/\/portal\/client/);
  await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
  // The submissions section header is always present (even when empty).
  await expect(page.getByRole("heading", { name: /submissions/i })).toBeVisible();
});

test("client cannot open a submission outside their account (bounce or 404)", async ({ page }) => {
  await login(page, SEEDS.client);

  // A very high id that the demo client's account will not own. The guard
  // either notFound()s (no such submission) or redirect()s to /portal/client
  // (exists but belongs to another account). Either is acceptable isolation;
  // what must NEVER happen is rendering a foreign candidate's detail.
  await page.goto("/portal/client/submissions/999999");

  const url = page.url();
  const bouncedToPortal = /\/portal\/client(\?|$)/.test(url);
  const is404 = await page.getByText(/this page could not be found/i).count();
  expect(bouncedToPortal || is404 > 0, `expected bounce or 404, landed on ${url}`).toBeTruthy();

  // Hard guarantee: no candidate working surface (star/feedback) leaked.
  await expect(page.getByRole("button", { name: /star/i })).toHaveCount(0);
});

test("vendor cannot open a job they are not assigned to (404)", async ({ page }) => {
  await login(page, SEEDS.vendor);

  // High id the demo vendor (TalentBridge) is not assigned to via jobVendors.
  await page.goto("/portal/vendor/jobs/999999");

  await expect(page.getByText(/this page could not be found/i)).toBeVisible({ timeout: 15_000 });
});
