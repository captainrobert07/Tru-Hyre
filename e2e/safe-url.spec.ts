import { test, expect } from "@playwright/test";
import { safeExternalUrl } from "../lib/utils";

/**
 * Regression lock for the iteration-51 stored-XSS fix. safeExternalUrl() gates
 * user-supplied URLs (candidate linkedinUrl/githubUrl, client website) before
 * they become an href. A regression here re-opens script execution in the
 * viewer's authenticated session, so these assertions must not be loosened.
 *
 * Pure-function test — imports the helper directly, no browser needed (the
 * Playwright runner is just the harness we already have).
 */

test("rejects dangerous URI schemes (the XSS vectors)", () => {
  expect(safeExternalUrl("javascript:alert(document.cookie)")).toBeUndefined();
  expect(safeExternalUrl("JAVASCRIPT:alert(1)")).toBeUndefined(); // case-insensitive
  expect(safeExternalUrl("  javascript:alert(1)  ")).toBeUndefined(); // whitespace-padded
  expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
  expect(safeExternalUrl("vbscript:msgbox(1)")).toBeUndefined();
  expect(safeExternalUrl("file:///etc/passwd")).toBeUndefined();
});

test("passes through safe http(s) URLs unchanged", () => {
  expect(safeExternalUrl("https://linkedin.com/in/jane")).toBe("https://linkedin.com/in/jane");
  expect(safeExternalUrl("http://example.com")).toBe("http://example.com");
});

test("prefixes a bare host with https:// (the common paste case)", () => {
  expect(safeExternalUrl("linkedin.com/in/jane")).toBe("https://linkedin.com/in/jane");
  expect(safeExternalUrl("github.com/jane")).toBe("https://github.com/jane");
});

test("treats empty / null / undefined as no link", () => {
  expect(safeExternalUrl(null)).toBeUndefined();
  expect(safeExternalUrl(undefined)).toBeUndefined();
  expect(safeExternalUrl("")).toBeUndefined();
});
