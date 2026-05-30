import { type Page, expect } from "@playwright/test";

export const SEED_PASSWORD = "Kris@35193";

export const SEEDS = {
  admin: "admin@truhyre.app",
  hr: "hr@truhyre.app",
  client: "client@truhyre.app",
  vendor: "vendor@truhyre.app",
} as const;

export async function login(page: Page, email: string, password: string = SEED_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

export async function expectStatus(page: Page, path: string, expected: number[]) {
  const r = await page.request.get(path, { maxRedirects: 0 });
  expect(expected, `${path} expected ${expected.join("/")} got ${r.status()}`).toContain(r.status());
}
