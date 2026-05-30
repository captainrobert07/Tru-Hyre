import { test, expect } from "@playwright/test";

test("health endpoint reports ok", async ({ request }) => {
  const r = await request.get("/api/health");
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.status).toBe("ok");
  expect(body.name).toMatch(/Tru Hyre/i);
  expect(body.timestamp).toBeTruthy();
});

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /tru hyre/i })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("invalid credentials rejected", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10_000 });
});
