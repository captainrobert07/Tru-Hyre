#!/usr/bin/env python3
"""Reusable READ-ONLY probe helper for live RBAC / route-gating / IDOR tests.

NEVER mutates data: only GETs and the NextAuth login POST (which creates a
session, not app data). Login: GET /api/auth/csrf -> POST callback/credentials
-> session cookie in the jar.

CLI:
  python e2e/_probe.py login  <email>
      -> prints "LOGIN ok|fail <email>"
  python e2e/_probe.py route  <email|anon> <path> [<path> ...]
      -> for each path prints: "<path> STATUS <code> FINAL <final_path> LOGIN <bool>"
         (redirects NOT followed past the first hop so 302->/login is visible)

Roles (seeded): admin@truhyre.app hr@truhyre.app hrlite@truhyre.app
                client@truhyre.app vendor@truhyre.app   (pwd Kris@35193)
"""
import sys, json, http.cookiejar, urllib.request, urllib.parse, urllib.error

BASE = "https://tru-hyre-rho.vercel.app"
PASSWORD = "Kris@35193"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # surface the 3xx instead of following it


def make_opener(follow=True):
    cj = http.cookiejar.CookieJar()
    handlers = [urllib.request.HTTPCookieProcessor(cj)]
    if not follow:
        handlers.append(NoRedirect())
    return urllib.request.build_opener(*handlers), cj


def login(email, password=PASSWORD):
    """Return (opener, cookiejar) with an authed session, or (None, cj) on fail."""
    opener, cj = make_opener(follow=True)
    try:
        r = opener.open(BASE + "/api/auth/csrf", timeout=30)
        csrf = json.loads(r.read().decode("utf-8", "replace")).get("csrfToken", "")
    except Exception:
        return None, cj
    data = urllib.parse.urlencode({
        "csrfToken": csrf, "email": email, "password": password,
        "callbackUrl": BASE + "/dashboard", "json": "true",
    }).encode()
    try:
        opener.open(BASE + "/api/auth/callback/credentials", data=data, timeout=30)
    except urllib.error.HTTPError:
        pass  # NextAuth often 302s; cookie still set
    except Exception:
        return None, cj
    has_session = any("session-token" in c.name for c in cj)
    return (opener if has_session else None), cj


def probe(email, paths):
    if email == "anon":
        opener, _ = make_opener(follow=False)
        authed = False
    else:
        # log in (following redirects), then reuse the SAME cookie jar with a
        # non-following opener so route 302s are visible.
        a_opener, cj = login(email)
        authed = a_opener is not None
        handlers = [urllib.request.HTTPCookieProcessor(cj), NoRedirect()]
        opener = urllib.request.build_opener(*handlers)
    for path in paths:
        try:
            r = opener.open(BASE + path, timeout=30)
            code, final = r.status, r.geturl()
        except urllib.error.HTTPError as e:
            code, final = e.code, getattr(e, "url", path)
            loc = e.headers.get("Location", "")
            if loc:
                final = loc
        except Exception as e:
            print(f"{path} ERROR {type(e).__name__}:{str(e)[:60]}")
            continue
        fp = final.replace(BASE, "") or "/"
        print(f"{path} STATUS {code} FINAL {fp} LOGIN {authed}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("usage: _probe.py login|route <email> [paths...]"); sys.exit(2)
    cmd, email = sys.argv[1], sys.argv[2]
    if cmd == "login":
        op, cj = login(email)
        print(f"LOGIN {'ok' if op else 'fail'} {email}")
    elif cmd == "route":
        probe(email, sys.argv[3:])
    else:
        print("unknown cmd"); sys.exit(2)
