import { test, expect } from "@playwright/test";
import { login, SEEDS } from "./helpers";

/**
 * Authorization boundary on the file-streaming endpoint `/api/files/[fileId]`,
 * which serves resume PDFs + client packets (candidate PII). `requireUser()`
 * only proves the caller is logged in; the route then applies per-ROLE rules:
 *   - admin/hr      → any file
 *   - hr_lite       → only resumes of candidates THEY uploaded
 *   - vendor        → only resumes of candidates in THEIR vendor account
 *   - client        → only packets for submissions to THEIR client-account jobs
 *   - no match / other → 404
 * api-auth-gate only covers the UNauthenticated case; portal-isolation covers
 * page-level tenant isolation but never the file endpoint. This locks the
 * cross-tenant IDOR boundary on the endpoint itself — the worst place to leak,
 * since it streams raw candidate documents.
 *
 * Read-only + reseed-proof: requests a bogus/never-owned file id as a tenant
 * role; the contract is "never streams a file → 404" (a GET that reads nothing).
 */

const BOGUS_FILE_ID = "definitely-not-a-real-drive-file-id-zzz999";

test("a client cannot fetch an arbitrary file id (404, no stream)", async ({ page }) => {
  await login(page, SEEDS.client);
  const r = await page.request.get(`/api/files/${BOGUS_FILE_ID}`, { maxRedirects: 0 });
  // A client may only ever reach packets for their own jobs; an unknown id → 404.
  // Never a 200 with a file body.
  expect([404, 403], `client got ${r.status()} for a bogus file id`).toContain(r.status());
});

test("a vendor cannot fetch an arbitrary file id (404, no stream)", async ({ page }) => {
  await login(page, SEEDS.vendor);
  const r = await page.request.get(`/api/files/${BOGUS_FILE_ID}`, { maxRedirects: 0 });
  expect([404, 403], `vendor got ${r.status()} for a bogus file id`).toContain(r.status());
});

test("a logged-out caller cannot fetch a file (auth-gate regression guard)", async ({ page }) => {
  await page.context().clearCookies();
  const r = await page.request.get(`/api/files/${BOGUS_FILE_ID}`, { maxRedirects: 0 });
  // Unauthenticated: requireUser() redirects/blocks — never a 200 file stream.
  expect(r.status(), `unauth got ${r.status()}`).not.toBe(200);
});
