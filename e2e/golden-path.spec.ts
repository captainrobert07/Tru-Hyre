import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

test.describe.configure({ mode: "serial" });

test("admin lands on dashboard and its KPI cards render", async ({ page }) => {
  await login(page, SEEDS.admin);
  await expect(page).toHaveURL(/\/dashboard/);
  // The PageHeader <h1> is a personalized greeting ("Hi, {firstName}"), not a
  // literal "Dashboard" — the old assertions ("Dashboard" heading + "Pipeline
  // at a glance") were stale and tested copy that no longer exists.
  await expect(page.getByRole("heading", { name: /^Hi,/ })).toBeVisible({ timeout: 15_000 });
  // Contract for the heaviest aggregate page (~12 queries): its KPI cards
  // actually render, not a blank/crashed shell. "Coverage ratio" is a stable,
  // distinctive dashboard stat (active candidates ÷ open positions).
  await expect(page.getByText(/Coverage ratio/i)).toBeVisible();
  await expect(page.getByText(/Offer acceptance/i)).toBeVisible();
});

test("hr can browse candidates list", async ({ page }) => {
  await login(page, SEEDS.hr);
  await page.goto("/candidates");
  await expect(page.getByRole("heading", { name: "Candidates" })).toBeVisible();
});

test("hr can open a candidate and see KPIs", async ({ page }) => {
  await login(page, SEEDS.hr);
  await page.goto("/candidates");
  // Take any candidate row's link.
  const firstRow = page.locator("a[href^='/candidates/']").first();
  if (await firstRow.count()) {
    await firstRow.click();
    await expect(page.getByText(/Experience/i)).toBeVisible();
    await expect(page.getByText(/Generate packet|Regenerate packet/i)).toBeVisible();
  }
});

test("client lands on portal, NOT admin shell", async ({ page }) => {
  await login(page, SEEDS.client);
  await expect(page).toHaveURL(/\/portal\/client/);
  await expect(page.getByRole("heading", { name: /Welcome/i })).toBeVisible();
});

test("vendor lands on vendor portal", async ({ page }) => {
  await login(page, SEEDS.vendor);
  await expect(page).toHaveURL(/\/portal\/vendor/);
});
