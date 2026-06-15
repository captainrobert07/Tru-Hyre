import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Portal render net — the external-facing portals (client, vendor) must render
 * for their own role without a 5xx or the error boundary. The iter-37 smoke net
 * covers the 32 STAFF routes; the portal-isolation spec proves cross-tenant
 * guards but only opens the landing + a foreign id. This catches the other
 * class for external users: a portal page that simply throws on render.
 *
 * Seed-safe: client + vendor users exist; there is no seeded candidate user
 * (the candidate portal needs an invited self-service login the seed doesn't
 * create), so /portal/candidate is intentionally out of scope here.
 * Read-only — navigations only.
 */

async function expectRenders(page: import("@playwright/test").Page, path: string) {
  const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(resp?.status() ?? 0, `${path} must not 5xx`).toBeLessThan(500);
  await expect(
    page.getByText(/something went wrong/i),
    `${path} must not hit the error boundary`,
  ).toHaveCount(0);
}

test("client portal renders for a client", async ({ page }) => {
  await login(page, SEEDS.client);
  await expect(page).toHaveURL(/\/portal\/client/);
  await expectRenders(page, "/portal/client");
});

test("vendor portal + upload render for a vendor", async ({ page }) => {
  await login(page, SEEDS.vendor);
  await expect(page).toHaveURL(/\/portal\/vendor/);
  await expectRenders(page, "/portal/vendor");
  await expectRenders(page, "/portal/vendor/upload");
});
