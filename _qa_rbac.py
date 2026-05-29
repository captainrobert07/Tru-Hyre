"""RBAC negative checks: forbidden URLs return 403/302, never 200."""
import re
import sys
import urllib.request
import urllib.parse
import urllib.error
import http.cookiejar
from collections import defaultdict

BASE = "http://127.0.0.1:8765"
SEEDS = {
    "client": "client@truhyre.app",
    "vendor": "vendor@truhyre.app",
}
PW = "Kris@35193"

FORBIDDEN_FOR = {
    "client": [
        "/dashboard/admin/", "/dashboard/hr/",
        "/jobs/new/", "/clients/new/", "/vendors/", "/vendors/new/",
        "/settings/", "/settings/users/", "/settings/audit/", "/reports/",
        "/candidates/new/",
    ],
    "vendor": [
        "/dashboard/admin/", "/dashboard/hr/",
        "/jobs/new/", "/clients/", "/clients/new/", "/vendors/new/",
        "/settings/", "/settings/users/", "/settings/audit/", "/reports/",
    ],
}


def csrf(html):
    m = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', html)
    return m.group(1) if m else None


def make_session():
    cj = http.cookiejar.CookieJar()
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cj),
        urllib.request.HTTPRedirectHandler(),
    ), cj


def login(opener, email):
    r = opener.open(f"{BASE}/auth/login/")
    body = r.read().decode("utf-8", "ignore")
    token = csrf(body)
    data = urllib.parse.urlencode({
        "csrfmiddlewaretoken": token,
        "username": email,
        "password": PW,
    }).encode()
    req = urllib.request.Request(f"{BASE}/auth/login/", data=data, method="POST")
    req.add_header("Referer", f"{BASE}/auth/login/")
    return opener.open(req).geturl()


def fetch(opener, url):
    try:
        r = opener.open(BASE + url)
        return r.status, r.geturl(), r.read().decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore") if e.fp else ""
        return e.code, url, body


def main():
    results = defaultdict(list)
    for role, email in SEEDS.items():
        op, _ = make_session()
        login(op, email)
        for url in FORBIDDEN_FOR[role]:
            status, final, body = fetch(op, url)
            # The role's own portal redirect or a 302/403/404 are acceptable lockouts.
            blocked = status in (302, 403, 404) or (
                status == 200
                and (final.endswith("/portal/") or "/portal/" in final or final.endswith("/login/"))
            )
            results[role].append((url, status, final, blocked))

    failed = []
    print(f"\n{'='*70}\nRBAC NEGATIVE CHECK — these URLs MUST be blocked\n{'='*70}")
    for role, rows in results.items():
        print(f"\n--- {role} ---")
        for url, code, final, blocked in rows:
            mark = "OK" if blocked else "LEAK"
            redir = "" if final == BASE + url else f" -> {final.replace(BASE,'')}"
            print(f"  [{mark}] {code} {url}{redir}")
            if not blocked:
                failed.append((role, url, code, final))

    print(f"\n{'='*70}\nTOTAL: {sum(len(v) for v in results.values())} checks, {len(failed)} leaks\n{'='*70}")
    if failed:
        for role, url, code, final in failed:
            print(f"  - {role} {url} -> {code} {final}")
        sys.exit(1)


if __name__ == "__main__":
    main()
