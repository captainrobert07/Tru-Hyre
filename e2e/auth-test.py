#!/usr/bin/env python3
"""Authenticated E2E: log in as seeded admin, hit new feature pages, confirm 200s.

Uses NextAuth credentials flow: GET csrf -> POST callback -> follow session cookie.
"""
import sys, json, re, http.cookiejar, urllib.request, urllib.parse, urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://tru-hyre-rho.vercel.app"
EMAIL = "admin@truhyre.app"
PASSWORD = "Kris@35193"

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
opener.addheaders = [("User-Agent", "truhyre-e2e/1.0")]

def get(path):
    try:
        r = opener.open(BASE + path, timeout=30)
        return r.status, r.read().decode("utf-8", "replace"), r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), BASE + path

results = []
def check(name, ok, detail=""):
    results.append((ok, name, detail))
    print(f"{'PASS' if ok else 'FAIL'} | {name} | {detail}")

# 1. Get CSRF token
s, body, _ = get("/api/auth/csrf")
csrf = ""
try:
    csrf = json.loads(body).get("csrfToken", "")
except Exception:
    pass
check("fetched CSRF token", bool(csrf), f"len={len(csrf)}")

# 2. POST credentials to callback
data = urllib.parse.urlencode({
    "csrfToken": csrf,
    "email": EMAIL,
    "password": PASSWORD,
    "callbackUrl": BASE + "/dashboard",
    "json": "true",
}).encode()
login_status = None
try:
    r = opener.open(urllib.request.Request(
        BASE + "/api/auth/callback/credentials",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    ), timeout=30)
    login_status = r.status
except urllib.error.HTTPError as e:
    login_status = e.code

has_session = any("session-token" in c.name for c in cj)
check("login established session cookie", has_session, f"login_status={login_status} cookies={[c.name for c in cj]}")

if not has_session:
    print("\nCannot continue authed checks without a session. (Seed creds may differ in prod.)")
    passed = sum(1 for ok, _, _ in results if ok)
    print(f"\nRESULT: {passed}/{len(results)} passed")
    sys.exit(1)

# 3. Authenticated pages should now return 200 (not redirect to login)
AUTHED = [
    ("/dashboard", ["Hi,", "Pipeline", "candidates"]),
    ("/candidates", ["Candidates"]),
    ("/jobs", ["Jobs"]),
    ("/inbox", ["Inbox"]),
    ("/activity", ["Activity"]),
    ("/reports", ["Reports", "funnel", "Source"]),
    ("/settings/features", ["Features", "Interview"]),
    ("/settings/platform", ["Platform", "API"]),
    ("/candidates/ai-search", ["AI", "search"]),
    ("/candidates/duplicates", ["duplicate", "Duplicates", "Possible"]),
]
for path, needles in AUTHED:
    s, b, final = get(path)
    landed_login = "/login" in final
    found = any(n.lower() in b.lower() for n in needles)
    ok = s == 200 and not landed_login and found
    check(f"authed {path}", ok, f"status={s} login={landed_login} content={'y' if found else 'n'}")

print("\n" + "=" * 50)
passed = sum(1 for ok, _, _ in results if ok)
print(f"RESULT: {passed}/{len(results)} passed")
sys.exit(0 if passed == len(results) else 1)
