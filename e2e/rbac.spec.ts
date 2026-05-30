import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

const FORBIDDEN_FOR_CLIENT = [
  "/",
  "/candidates",
  "/jobs",
  "/clients",
  "/vendors",
  "/submissions",
  "/reports",
  "/settings",
  "/settings/users",
  "/settings/audit",
];

const FORBIDDEN_FOR_VENDOR = [
  "/",
  "/candidates",
  "/jobs",
  "/clients",
  "/vendors",
  "/submissions",
  "/reports",
  "/settings",
];

const FORBIDDEN_FOR_HR = [
  "/settings",
  "/settings/users",
  "/settings/users/new",
  "/settings/invitations",
  "/settings/audit",
  "/settings/company",
];

async function assertBlocked(page: import("@playwright/test").Page, url: string, allowedDest: RegExp) {
  await page.goto(url);
  await expect(page).toHaveURL(allowedDest, { timeout: 15_000 });
}

test.describe("RBAC negative checks", () => {
  test("client cannot reach staff/admin paths", async ({ page }) => {
    await login(page, SEEDS.client);
    for (const path of FORBIDDEN_FOR_CLIENT) {
      await assertBlocked(page, path, /\/portal\/client|\/login/);
    }
  });

  test("vendor cannot reach staff/admin paths", async ({ page }) => {
    await login(page, SEEDS.vendor);
    for (const path of FORBIDDEN_FOR_VENDOR) {
      await assertBlocked(page, path, /\/portal\/vendor|\/login/);
    }
  });

  test("hr cannot reach admin-only settings", async ({ page }) => {
    await login(page, SEEDS.hr);
    for (const path of FORBIDDEN_FOR_HR) {
      await page.goto(path);
      // hr gets redirected to "/" (dashboard) per requireAdmin().
      await expect(page).toHaveURL(/\/(\?.*)?$|\/login/, { timeout: 15_000 });
    }
  });

  test("logged-out user is sent to /login from any protected path", async ({ page }) => {
    await page.context().clearCookies();
    for (const path of ["/", "/candidates", "/jobs", "/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
