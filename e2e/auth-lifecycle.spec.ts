import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Auth session lifecycle — the login→logout→session-gone boundary. Existing
 * specs cover login render + invalid creds (smoke) and role landing
 * (golden-path), and rbac.spec proves a cookie-cleared user is bounced. The
 * missing piece: the ACTUAL sign-out action. If signOut() regressed (didn't
 * clear the session cookie), a "logged out" user could still reach protected
 * pages — a real auth hole the cookie-clear test can't catch.
 *
 * Uses a mobile viewport so the always-visible top-bar "Sign out" button is
 * directly clickable (the desktop control is nested in a <details> menu).
 */

test.use({ viewport: { width: 390, height: 844 } });

test("login → logout clears the session and re-protects routes", async ({ page }) => {
  await login(page, SEEDS.admin);
  await expect(page).toHaveURL(/\/dashboard/);

  // Sign out via the real action (mobile top-bar button).
  await page.getByRole("button", { name: /sign out/i }).filter({ visible: true }).first().click();
  await page.waitForURL(/\/login/, { timeout: 30_000 });
  await expect(page.getByLabel("Email")).toBeVisible();

  // Session must be gone: a protected route now bounces back to /login.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("after logout, a protected API route no longer authorizes", async ({ page }) => {
  await login(page, SEEDS.admin);
  await page.getByRole("button", { name: /sign out/i }).filter({ visible: true }).first().click();
  await page.waitForURL(/\/login/, { timeout: 30_000 });

  // The page request context shares the (now-cleared) cookie jar. A protected
  // app page must redirect to /login rather than render its content.
  const resp = await page.goto("/candidates");
  expect(resp?.status() ?? 0).toBeLessThan(500);
  await expect(page).toHaveURL(/\/login/);
});
