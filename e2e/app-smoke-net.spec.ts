import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Broad render smoke net — every non-param staff route loads without a 5xx or
 * the error boundary, logged in as admin (who can reach all of them). The
 * targeted specs cover security boundaries; this catches the OTHER regression
 * class: a Server Component that simply throws on one page (exactly the failure
 * shape of the original digest:3495001251 crash) slipping through because no
 * test ever opened that page.
 *
 * Read-only — just navigations, writes nothing. Flag-gated routes (ai-search,
 * interview-kits, duplicates, …) 404 or redirect when their flag is off; that's
 * fine — we assert "no error boundary + no 5xx", which a clean redirect/404
 * also satisfies. We are catching CRASHES, not asserting reachability.
 */

const ROUTES = [
  "/dashboard",
  "/candidates",
  "/candidates/ai-search",
  "/candidates/compare",
  "/candidates/duplicates",
  "/candidates/import",
  "/candidates/upload",
  "/clients",
  "/clients/new",
  "/jobs",
  "/jobs/new",
  "/vendors",
  "/vendors/new",
  "/submissions",
  "/reports",
  "/reports/custom",
  "/inbox",
  "/activity",
  "/notifications",
  "/interview-kits",
  "/settings",
  "/settings/audit",
  "/settings/company",
  "/settings/email-templates",
  "/settings/features",
  "/settings/integrations",
  "/settings/invitations",
  "/settings/invitations/new",
  "/settings/invitations/bulk",
  "/settings/users",
  "/settings/users/new",
  "/settings/platform",
];

test("every staff route renders without a 5xx or error boundary", async ({ page }) => {
  await login(page, SEEDS.admin);

  const broken: string[] = [];
  for (const route of ROUTES) {
    const resp = await page.goto(route, { waitUntil: "domcontentloaded" });
    const status = resp?.status() ?? 0;
    // The error boundary renders "Something went wrong"; the route should never
    // surface it (a redirect/404 for a flag-off route is acceptable).
    const errored = await page.getByText(/something went wrong/i).count();
    if (status >= 500 || errored > 0) {
      broken.push(`${route} (status ${status}${errored ? ", error boundary" : ""})`);
    }
  }

  expect(broken, `routes that 5xx'd or hit the error boundary:\n${broken.join("\n")}`).toEqual([]);
});
