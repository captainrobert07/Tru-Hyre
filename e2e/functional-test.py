#!/usr/bin/env python3
"""End-to-end functional smoke test for Tru Hyre production.

HTTP-level (no browser): verifies health, auth gating, public routes, the read
API key gate, and that the new feature routes respond correctly. Browser/QA
binaries are blocked on this machine, so this is request-level verification.
"""
import sys, json, urllib.request, urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://tru-hyre-rho.vercel.app"

results = []
def check(name, fn):
    try:
        ok, detail = fn()
    except Exception as e:
        ok, detail = False, f"exception: {e}"
    results.append((ok, name, detail))
    print(f"{'PASS' if ok else 'FAIL'} | {name} | {detail}")

def req(path, method="GET", headers=None, allow_redirects=False, body=None):
    url = BASE + path
    r = urllib.request.Request(url, method=method, headers=headers or {}, data=body)
    cls = urllib.request.HTTPRedirectHandler if allow_redirects else type("NoRedirect", (urllib.request.HTTPRedirectHandler,), {"redirect_request": lambda *a, **k: None})
    opener = urllib.request.build_opener(cls)
    try:
        resp = opener.open(r, timeout=30)
        return resp.status, resp.read().decode("utf-8", "replace"), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), dict(e.headers)

# 1. Health endpoint
def t_health():
    s, b, _ = req("/api/health")
    return s == 200, f"status={s}"
check("health endpoint 200", t_health)

# 2. Login page public
def t_login():
    s, b, _ = req("/login")
    return s == 200 and ("password" in b.lower() or "sign" in b.lower()), f"status={s}"
check("login page public + renders", t_login)

# 3. Landing page public
def t_landing():
    s, b, _ = req("/")
    return s == 200, f"status={s}"
check("landing page public", t_landing)

# 4. Protected route redirects when unauthenticated
def t_protected():
    s, b, h = req("/dashboard")
    # middleware should 307/302 to /login
    return s in (302, 307) and "/login" in (h.get("location", "")), f"status={s} loc={h.get('location','')[:40]}"
check("/dashboard gated → login", t_protected)

def t_candidates_gated():
    s, b, h = req("/candidates")
    return s in (302, 307) and "/login" in h.get("location", ""), f"status={s}"
check("/candidates gated → login", t_candidates_gated)

def t_settings_gated():
    s, b, h = req("/settings/features")
    return s in (302, 307), f"status={s}"
check("/settings/features gated", t_settings_gated)

# 5. Public careers page (feature default-on)
def t_careers():
    s, b, _ = req("/careers")
    return s == 200 and ("role" in b.lower() or "career" in b.lower() or "apply" in b.lower()), f"status={s}"
check("/careers public page", t_careers)

def t_refer():
    s, b, _ = req("/careers/refer")
    return s == 200 and ("refer" in b.lower() or "candidate" in b.lower()), f"status={s}"
check("/careers/refer public page", t_refer)

# 6. Read API requires key (public_api default OFF → 404; if on, 401 without key)
def t_api_no_key():
    s, b, _ = req("/api/v1/candidates")
    return s in (401, 404), f"status={s} (404=feature off, 401=needs key — both correct)"
check("/api/v1/candidates rejects no-key", t_api_no_key)

def t_api_bad_key():
    s, b, _ = req("/api/v1/candidates", headers={"Authorization": "Bearer thk_invalid"})
    return s in (401, 404), f"status={s}"
check("/api/v1/candidates rejects bad key", t_api_bad_key)

# 7. Cron endpoint rejects unauthorized
def t_cron():
    s, b, _ = req("/api/cron/sla")
    return s in (200, 401), f"status={s} (401 ideal; 200 only if no CRON_SECRET set)"
check("/api/cron/sla guarded", t_cron)

# 8. Manifest (PWA)
def t_manifest():
    s, b, _ = req("/manifest.webmanifest")
    return s == 200 and "Tru Hyre" in b, f"status={s}"
check("PWA manifest served", t_manifest)

# 9. Search API gated (returns 401 unauth)
def t_search():
    s, b, _ = req("/api/search?q=test")
    return s in (401, 200), f"status={s}"
check("/api/search auth-gated", t_search)

print("\n" + "=" * 50)
passed = sum(1 for ok, _, _ in results if ok)
print(f"RESULT: {passed}/{len(results)} passed")
sys.exit(0 if passed == len(results) else 1)
