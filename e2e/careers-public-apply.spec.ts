import { test, expect } from "@playwright/test";

/**
 * Public careers / self-apply flow — the top-of-funnel, fully UNAUTHENTICATED
 * path that feeds candidates into the pipeline. If it silently breaks,
 * applications vanish with no error anyone sees, so it's worth a guard.
 *
 * Coverage is deliberately NON-POLLUTING: it asserts the public pages render
 * and the apply form is present + validates, but never submits a real
 * application (that would write a candidate row + upload a file to prod on
 * every CI run). The negative check relies on the native `required` fields
 * blocking submission, so no data is created.
 *
 * `careers_page` is a default-ON feature flag; if an admin turns it off the
 * routes 404 by design. These tests assume the default (on).
 *
 * Job id is discovered at runtime off a /careers listing card, so the suite
 * survives reseeds that renumber ids.
 */

test.describe.configure({ mode: "serial" });

let jobHref: string | null = null;

test("/careers is public and lists open roles", async ({ page }) => {
  await page.goto("/careers");
  // No auth wall — we must NOT be bounced to /login.
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /open roles/i })).toBeVisible();

  // Seed publishes 2 open jobs → at least one /careers/<id> card link.
  const firstJob = page.locator("a[href^='/careers/']").first();
  await expect(firstJob).toBeVisible({ timeout: 15_000 });
  jobHref = await firstJob.getAttribute("href");
  expect(jobHref, `expected a /careers/<id> link, got ${jobHref}`).toMatch(/\/careers\/\d+/);
});

test("a job detail page renders the public apply form", async ({ page }) => {
  expect(jobHref, "no job link discovered in the first test").toBeTruthy();
  await page.goto(jobHref!);
  await expect(page).not.toHaveURL(/\/login/);

  // The apply form's required + key fields are present.
  await expect(page.getByLabel(/full name/i)).toBeVisible();
  await expect(page.getByLabel(/^email/i)).toBeVisible();
  await expect(page.getByLabel(/resume/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /submit application/i })).toBeVisible();
});

test("empty submission is blocked client-side (no data written)", async ({ page }) => {
  expect(jobHref, "no job link discovered in the first test").toBeTruthy();
  await page.goto(jobHref!);

  // Submitting with the required fields empty must NOT navigate away or
  // create anything — native validation keeps us on the job page.
  await page.getByRole("button", { name: /submit application/i }).click();

  await expect(page).toHaveURL(new RegExp(jobHref!.replace(/[/]/g, "\\/")));
  // The required full-name field should be flagged invalid by the browser.
  const fullName = page.getByLabel(/full name/i);
  const valid = await fullName.evaluate((el: HTMLInputElement) => el.checkValidity());
  expect(valid, "empty required full-name should be invalid").toBe(false);
});
