import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Access boundary on the CANDIDATE portal (`/portal/candidate`). The
 * auth.config `authorized` callback enforces `candidateOnly`: only role
 * `candidate` (and `admin`) may enter; every other role is redirected to its
 * own home. The other two portals (client/vendor) have isolation specs and the
 * rbac spec covers staff/admin paths — but NOTHING tested the candidate-portal
 * boundary (and the render path can't be: candidate logins are invite-only, not
 * seeded — see portal-render-net). This locks the negative half: non-candidate
 * staff/portal roles must be bounced, never shown the candidate portal.
 *
 * Seed-safe + read-only: it only navigates as existing seed roles.
 */

const NON_CANDIDATE = [
  { role: "hr", seed: SEEDS.hr, home: /\/dashboard|\/candidates/ },
  { role: "client", seed: SEEDS.client, home: /\/portal\/client|\/login/ },
  { role: "vendor", seed: SEEDS.vendor, home: /\/portal\/vendor|\/login/ },
];

for (const { role, seed, home } of NON_CANDIDATE) {
  test(`${role} is bounced from /portal/candidate (never shown it)`, async ({ page }) => {
    await login(page, seed);
    await page.goto("/portal/candidate");
    // Redirected to the role's own home — never left sitting on the candidate portal.
    await expect(page, `${role} should be bounced from /portal/candidate`).not.toHaveURL(/\/portal\/candidate(\/|$)/, { timeout: 15_000 });
    await expect(page).toHaveURL(home);
  });
}

test("a logged-out caller is sent to /login from the candidate portal", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/portal/candidate");
  await expect(page).toHaveURL(/\/login/);
});
