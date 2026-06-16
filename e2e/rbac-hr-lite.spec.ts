import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * RBAC negative checks for hr_lite — the most-restricted STAFF role. The main
 * rbac.spec covers client/vendor/hr/logged-out but never hr_lite, and hr_lite
 * has the tightest route matrix of any staff login, enforced in
 * auth.config.ts's `authorized` callback:
 *   - adminOnly (/settings, /admin) and fullStaffOnly (/jobs, /clients,
 *     /vendors, /submissions, /reports, /activity, /inbox) → redirect to
 *     /candidates (hr_lite's home)
 *   - /dashboard is explicitly bounced to /candidates (no org-wide dashboard)
 *   - /candidates IS allowed (scoped to its own uploads — see hr-lite-isolation)
 *
 * Locks the boundary so a future change to the role matrix can't silently grant
 * hr_lite access to org-wide or admin surfaces. Read-only (navigation only).
 */

const FORBIDDEN_FOR_HR_LITE = [
  "/dashboard",
  "/jobs",
  "/clients",
  "/vendors",
  "/submissions",
  "/reports",
  "/activity",
  "/inbox",
  "/settings",
  "/settings/users",
  "/settings/audit",
];

test.describe("RBAC negative checks — hr_lite", () => {
  test("hr_lite is bounced to /candidates from every org-wide / admin path", async ({ page }) => {
    await login(page, SEEDS.hrLite);
    for (const path of FORBIDDEN_FOR_HR_LITE) {
      await page.goto(path);
      // The authorized callback redirects hr_lite to its home (/candidates).
      // (/login is tolerated only if the session somehow lapsed.)
      await expect(page, `hr_lite should be bounced from ${path}`).toHaveURL(
        /\/candidates|\/login/,
        { timeout: 15_000 },
      );
    }
  });

  test("hr_lite CAN reach its own candidates list (the redirect isn't vacuous)", async ({ page }) => {
    await login(page, SEEDS.hrLite);
    await page.goto("/candidates");
    await expect(page).toHaveURL(/\/candidates/);
    await expect(page.getByRole("heading", { name: "Candidates" })).toBeVisible({ timeout: 15_000 });
  });
});
