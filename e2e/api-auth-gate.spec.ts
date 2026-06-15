import { test, expect } from "@playwright/test";

/**
 * Internal API auth gate — none of the authenticated API routes may return data
 * to an UNAUTHENTICATED caller. The feature-gating spec covers the public
 * /api/v1 surface; this covers the internal routes (export, preview, reports,
 * audit, search, file serving), which enforce auth in DIFFERENT ways (some 401
 * JSON, some requireStaff→redirect, some delegate to the action).
 *
 * So we assert the INVARIANT that holds across all of them rather than a single
 * status code: a logged-out request must never be a 200 carrying a data
 * payload. 401 / 403 / 404 / a 3xx redirect to /login are all acceptable; a 200
 * with candidate/report data is the bug.
 *
 * No login here — a fresh context is unauthenticated. Read-only.
 */

const PROTECTED_GET = [
  "/api/candidates/1/export",
  "/api/candidates/1/preview",
  "/api/reports/export",
  "/api/settings/audit-export",
  "/api/search?q=test",
  "/api/files/some-file-id",
  "/api/offers/1/letter",
];

test("no internal API route serves data to an unauthenticated caller", async ({ request }) => {
  const leaks: string[] = [];
  for (const path of PROTECTED_GET) {
    const r = await request.get(path, { maxRedirects: 0, failOnStatusCode: false });
    const status = r.status();
    // A redirect (to /login) or any 4xx is a correct gate. A 200 is only OK if
    // it carries no data payload (it shouldn't for these routes at all).
    if (status === 200) {
      const body = await r.text();
      // Heuristic: a real data payload for these routes contains candidate /
      // report / audit fields. Any non-trivial JSON body on a 200 is a leak.
      if (/"(candidate|results|refId|rows|data|email|fullName)"/i.test(body)) {
        leaks.push(`${path} → 200 with data`);
      }
    }
  }
  expect(leaks, `unauthenticated data leaks:\n${leaks.join("\n")}`).toEqual([]);
});

test("the public /api/v1/candidates stays sealed unauthenticated (regression guard)", async ({ request }) => {
  // Mirrors feature-gating intent at the suite's API boundary: never 200+data.
  const r = await request.get("/api/v1/candidates", { failOnStatusCode: false });
  expect(r.status()).not.toBe(200);
});
