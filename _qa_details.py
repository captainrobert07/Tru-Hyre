"""Detail-page crawl: every detail/edit URL × every authorized role."""
import re
import sys
import urllib.request
import urllib.parse
import urllib.error
import http.cookiejar
from collections import defaultdict

BASE = "http://127.0.0.1:8765"
SEEDS = {
    "admin": "admin@truhyre.app",
    "hr": "hr@truhyre.app",
}
PW = "Kris@35193"


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
        r = opener.open(BASE + url if url.startswith("/") else url)
        body = r.read().decode("utf-8", "ignore")
        is_tb = "<title>" in body and "at /" in body and "Traceback" in body
        return r.status, r.geturl(), is_tb
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore") if e.fp else ""
        is_tb = "Traceback" in body
        return e.code, url, is_tb


def main():
    paths = [
        "/candidates/1/", "/candidates/1/edit/", "/candidates/1/submit/",
        "/jobs/1/", "/jobs/1/edit/",
        "/clients/1/", "/clients/1/edit/", "/clients/1/contact/",
        "/vendors/2/", "/vendors/2/edit/",
        "/auth/password/",
    ]
    results = defaultdict(list)
    for role, email in SEEDS.items():
        op, _ = make_session()
        login(op, email)
        for url in paths:
            status, final, tb = fetch(op, url)
            ok = status in (200, 302) and not tb
            results[role].append((url, status, final, ok, tb))

    failed = []
    print(f"\n{'='*70}\nDETAIL CRAWL — every detail/edit URL × admin & hr\n{'='*70}")
    for role, rows in results.items():
        print(f"\n--- {role} ---")
        for url, code, final, ok, tb in rows:
            mark = "OK" if ok else "FAIL"
            note = " [traceback]" if tb else ""
            redir = "" if final == BASE + url else f" -> {final.replace(BASE,'')}"
            print(f"  [{mark}] {code} {url}{redir}{note}")
            if not ok:
                failed.append((role, url, code, tb))

    print(f"\n{'='*70}\nTOTAL: {sum(len(v) for v in results.values())} GETs, {len(failed)} failures\n{'='*70}")
    if failed:
        for role, url, code, tb in failed:
            print(f"  - {role} {url} -> {code}{' (TRACE)' if tb else ''}")
        sys.exit(1)


if __name__ == "__main__":
    main()
