#!/usr/bin/env python3
"""E2E for hr_lite role + dark mode. Logs in as the seeded hr_lite user and
verifies: can reach /candidates + /candidates/upload, is redirected away from
full-staff areas (/jobs, /reports, /settings, /inbox), and dashboard bounces
to /candidates. Also confirms the theme script + manifest are present.
"""
import sys, json, http.cookiejar, urllib.request, urllib.parse, urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://tru-hyre-rho.vercel.app"
EMAIL = "hrlite@truhyre.app"
PASSWORD = "Kris@35193"

cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.addheaders = [("User-Agent", "e2e-hrlite/1.0")]

def get(path):
    try:
        r = op.open(BASE + path, timeout=30)
        return r.status, r.read().decode("utf-8", "replace"), r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), BASE + path

results = []
def check(name, ok, detail=""):
    results.append((ok, name, detail))
    print(f"{'PASS' if ok else 'FAIL'} | {name} | {detail}")

# Login as hr_lite
csrf = json.loads(op.open(BASE + "/api/auth/csrf", timeout=30).read()).get("csrfToken", "")
data = urllib.parse.urlencode({
    "csrfToken": csrf, "email": EMAIL, "password": PASSWORD,
    "callbackUrl": BASE + "/dashboard", "json": "true",
}).encode()
try:
    op.open(urllib.request.Request(BASE + "/api/auth/callback/credentials", data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}), timeout=30)
except urllib.error.HTTPError:
    pass
has_session = any("session-token" in c.name for c in cj)
check("hr_lite login session", has_session, f"cookies={[c.name for c in cj]}")

if not has_session:
    print("\nNo hr_lite session — seed may not have run yet on prod. (Seed adds hrlite@truhyre.app.)")
    passed = sum(1 for ok, _, _ in results if ok)
    print(f"\nRESULT: {passed}/{len(results)} passed")
    sys.exit(1)

# Allowed: candidates list + upload
s, b, final = get("/candidates")
check("hr_lite can see /candidates", s == 200 and "/login" not in final and "Candidates" in b, f"status={s}")

s, b, final = get("/candidates/upload")
check("hr_lite can reach /candidates/upload", s == 200 and "/login" not in final, f"status={s} final={final[-30:]}")

# Dashboard should bounce hr_lite to /candidates (now enforced at middleware)
s, b, final = get("/dashboard")
check("hr_lite /dashboard → /candidates", final.rstrip("/").endswith("/candidates"), f"final={final[-30:]}")

# Blocked: full-staff areas should redirect to /candidates (hr_lite home)
for path in ["/jobs", "/reports", "/settings/features", "/inbox", "/activity"]:
    s, b, final = get(path)
    blocked = final.rstrip("/").endswith("/candidates")
    check(f"hr_lite blocked from {path} → candidates", blocked, f"final={final[-32:]}")

# Theme + manifest present (dark mode infra)
s, b, _ = get("/login")
check("theme no-FOUC script present", "classList.add('dark')" in b, f"status={s}")
s, b, _ = get("/manifest.webmanifest")
check("PWA manifest served", s == 200 and "Tru Hyre" in b, f"status={s}")

print("\n" + "=" * 50)
passed = sum(1 for ok, _, _ in results if ok)
print(f"RESULT: {passed}/{len(results)} passed")
sys.exit(0 if passed == len(results) else 1)
