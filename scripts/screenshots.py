#!/usr/bin/env python3
"""Screenshots of the built demo in real Chrome, with the checks that catch a broken page.

    ./scripts/refresh-demo.sh --no-deploy --yes      (or: cd frontend && npm run build:static)
    backend/venv/bin/python scripts/screenshots.py

It serves frontend/dist on 127.0.0.1 with the same single-page fallback Cloudflare Pages uses, opens it in headless
Chrome with a fresh profile, and drives Chrome over its DevTools pipe. Nothing leaves the machine. Chrome is told
the visitor prefers reduced motion, which the charts honour by drawing without animation, so every frame is settled.

It writes
    docs/screenshots/<page>.png            the README's pictures, a 1600 by 1000 window at 2x, light theme
    docs/screenshots/executive-dark.png    the README hero in the dark theme
    scripts/out/card-light.png             the portfolio card, 1600 by 1000, from a 1440 by 900 window
    scripts/out/card-dark.png              the same in the dark theme
    scripts/out/review/                    every page in both themes at desktop, tablet, and phone width, full length
    scripts/out/report.json                what the checks found

The checks, any of which fails the run: an uncaught exception or console error, a request that failed or returned
400 or worse, a page wider than its window, a card showing its error panel, a card still loading after ten seconds,
and a card whose body drew nothing.

    --chrome PATH     the Chrome program, when it isn't in /Applications
    --range PRESET    the date range to show: last7d, last30d, last90d, ytd, or lastYear (default lastYear)
    --only NAME       just one page, for a quick look: executive, revenue, customers, operations, or forecasting
"""

from __future__ import annotations

import argparse
import base64
import functools
import http.server
import json
import shutil
import struct
import subprocess
import sys
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DIST = ROOT.joinpath("frontend", "dist")
README_SHOTS = ROOT.joinpath("docs", "screenshots")
OUT = HERE.joinpath("out")
REVIEW = OUT.joinpath("review")
APPS = Path("/").joinpath("Applications")
CHROMES = (APPS.joinpath("Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
           APPS.joinpath("Chromium.app", "Contents", "MacOS", "Chromium"))
TRAMPOLINE = 'exec "$@" 3<&0 4>&1 0</dev/null 1>&2'

PAGES = (("executive", "/"), ("revenue", "/revenue"), ("customers", "/customers"),
         ("operations", "/operations"), ("forecasting", "/forecasting"))
# name, width, height, scale, mobile
REVIEW_VIEWS = (("desktop", 1440, 900, 1, False), ("tablet", 834, 1194, 1, True), ("phone", 390, 844, 2, True))

READY_JS = """(function () {
  if (document.querySelector('[data-testid="kpi-skeleton"]')) { return false; }
  var ps = document.querySelectorAll('p');
  for (var i = 0; i < ps.length; i++) { if (ps[i].textContent.trim() === 'Loading...') { return false; } }
  return document.querySelectorAll('section').length > 0;
})()"""

CHECK_JS = """(function () {
  var W = window.innerWidth;
  var name = function (el) { var s = el.closest('section'); return s ? s.getAttribute('aria-label') : 'page'; };
  var bodies = Array.prototype.slice.call(document.querySelectorAll('section[data-card] > div:last-child'));
  return {
    wider: document.documentElement.scrollWidth > W + 1,
    scrollWidth: document.documentElement.scrollWidth,
    errors: Array.prototype.map.call(document.querySelectorAll('[data-chart-error]'), name),
    loading: Array.prototype.filter.call(document.querySelectorAll('p'),
      function (p) { return p.textContent.trim() === 'Loading...'; }).map(name),
    empty: bodies.filter(function (b) {
      return !b.querySelector('svg.recharts-surface, svg[role="img"], table, ul, figure, dl');
    }).map(name),
    flat: Array.prototype.filter.call(document.querySelectorAll('.recharts-wrapper > svg.recharts-surface'),
      function (s) { return s.getBoundingClientRect().height < 24; }).map(name)
  };
})()"""


def find_chrome(given=None):
    if given:
        return str(given)
    for p in CHROMES:
        if p.exists():
            return str(p)
    for n in ("google-chrome", "chromium"):
        if shutil.which(n):
            return shutil.which(n)
    raise SystemExit("Chrome wasn't found. Run again with --chrome and the path to the Chrome program.")


# ----------------------------------------------------------------------------- the site


class SpaHandler(http.server.SimpleHTTPRequestHandler):
    """Static files, and index.html for any path that isn't one, as the Pages fallback does."""

    def send_head(self):
        path = self.translate_path(self.path)
        if not Path(path).exists() and "." not in Path(self.path.split("?", 1)[0]).name:
            self.path = "/index.html"
        return super().send_head()

    def log_message(self, *args):
        pass


def serve(port):
    handler = functools.partial(SpaHandler, directory=str(DIST))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


# ----------------------------------------------------------------------------- chrome


class CDP:
    """The DevTools protocol over Chrome's pipe: JSON messages, each ended by a zero byte."""

    def __init__(self, proc, on_event=None):
        self.proc, self.on_event = proc, on_event
        self.next_id, self.responses, self.events = 0, {}, []
        self.cond, self.wlock = threading.Condition(), threading.Lock()
        threading.Thread(target=self._read, daemon=True).start()

    def _read(self):
        buf = b""
        while True:
            chunk = self.proc.stdout.read1(1 << 16)
            if not chunk:
                break
            buf += chunk
            while b"\0" in buf:
                raw, buf = buf.split(b"\0", 1)
                msg = json.loads(raw)
                with self.cond:
                    if "id" in msg:
                        self.responses[msg["id"]] = msg
                    else:
                        self.events.append(msg)
                    self.cond.notify_all()
                if "id" not in msg and self.on_event:
                    self.on_event(msg)

    def send(self, method, params=None, session=None, timeout=60):
        with self.cond:
            self.next_id += 1
            mid = self.next_id
        msg = {"id": mid, "method": method, "params": params or {}}
        if session:
            msg["sessionId"] = session
        with self.wlock:
            self.proc.stdin.write(json.dumps(msg).encode() + b"\0")
            self.proc.stdin.flush()
        deadline = time.time() + timeout
        with self.cond:
            while mid not in self.responses:
                left = deadline - time.time()
                if left <= 0:
                    raise TimeoutError(method)
                self.cond.wait(left)
            reply = self.responses.pop(mid)
        if "error" in reply:
            raise RuntimeError(f"{method}: {reply['error'].get('message')}")
        return reply.get("result", {})

    def mark(self):
        with self.cond:
            return len(self.events)

    def wait_event(self, method, session, since, timeout=60):
        deadline = time.time() + timeout
        with self.cond:
            while True:
                for e in self.events[since:]:
                    if e.get("method") == method and e.get("sessionId") == session:
                        return e
                left = deadline - time.time()
                if left <= 0:
                    raise TimeoutError(method)
                self.cond.wait(left)


class Browser:
    def __init__(self, chrome):
        self.problems = []
        profile = OUT.joinpath("chrome-profile")
        shutil.rmtree(profile, ignore_errors=True)
        flags = ["--headless=new", "--remote-debugging-pipe", f"--user-data-dir={profile}", "--no-first-run",
                 "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars", "--mute-audio",
                 "--disable-background-networking", "--disable-sync", "--disable-component-update"]
        self.log = OUT.joinpath("chrome.log").open("wb")
        self.proc = subprocess.Popen(["bash", "-c", TRAMPOLINE, "chrome", chrome, *flags], stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, stderr=self.log)
        self.cdp = CDP(self.proc, self.event)
        target = self.cdp.send("Target.createTarget", {"url": "about:blank"})["targetId"]
        self.s = self.cdp.send("Target.attachToTarget", {"targetId": target, "flatten": True})["sessionId"]
        for m in ("Page.enable", "Runtime.enable", "Network.enable", "Log.enable"):
            self.cdp.send(m, session=self.s)
        self.cdp.send("Emulation.setEmulatedMedia",
                      {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]}, self.s)

    def event(self, e):
        m, p = e.get("method"), e.get("params", {})
        if m == "Runtime.exceptionThrown":
            d = p["exceptionDetails"]
            self.problems.append(f"exception: {(d.get('exception') or {}).get('description') or d.get('text')}")
        elif m == "Runtime.consoleAPICalled" and p.get("type") in ("error", "assert"):
            text = " ".join(str(a.get("value", a.get("description"))) for a in p.get("args", []))
            self.problems.append(f"console.error: {text[:300]}")
        elif m == "Log.entryAdded" and p["entry"].get("level") == "error":
            self.problems.append(f"log: {p['entry'].get('text')} {p['entry'].get('url', '')}".strip())
        elif m == "Network.loadingFailed" and not p.get("canceled"):
            self.problems.append(f"request failed: {p.get('errorText')}")
        elif m == "Network.responseReceived" and p["response"].get("status", 200) >= 400:
            self.problems.append(f"HTTP {p['response']['status']}: {p['response']['url']}")

    def close(self):
        try:
            self.cdp.send("Browser.close", timeout=10)
        except Exception:  # noqa: BLE001 - closing is best effort
            pass
        self.proc.wait(timeout=20)
        self.log.close()

    def view(self, width, height, scale=1.0, mobile=False):
        self.cdp.send("Emulation.setDeviceMetricsOverride",
                      {"width": width, "height": height, "deviceScaleFactor": scale, "mobile": mobile}, self.s)

    def js(self, expr, wait=False):
        r = self.cdp.send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": wait}, self.s)
        if "exceptionDetails" in r:
            raise RuntimeError(f"{expr[:60]}: {r['exceptionDetails'].get('text')}")
        return r.get("result", {}).get("value")

    def load(self, url, timeout=10.0):
        """Open url and wait until every card has its data. False if one never did."""
        since = self.cdp.mark()
        self.cdp.send("Page.navigate", {"url": url}, self.s)
        self.cdp.wait_event("Page.loadEventFired", self.s, since)
        deadline = time.time() + timeout
        while time.time() < deadline:
            if self.js(READY_JS):
                self.js("new Promise(r => requestAnimationFrame(() => setTimeout(r, 350)))", wait=True)
                return True
            time.sleep(0.15)
        return False

    def page_height(self):
        size = self.cdp.send("Page.getLayoutMetrics", session=self.s)["cssContentSize"]
        return min(int(size["height"] + 0.999), 12000)

    def settle(self, ms=500):
        self.js(f"new Promise(r => requestAnimationFrame(() => setTimeout(r, {ms})))", wait=True)

    def capture(self, path, full=False, view=None):
        """What the window shows, saved to path. With full, the window first grows to the page's length.

        Growing the window and letting the page settle replaced Chrome's capture-beyond-viewport mode,
        which re-laid the page out mid-capture while the charts were still sized for the old layout,
        so they came out clipped or shrunken in the picture and nowhere else.
        """
        if full:
            width, height, scale, mobile = view
            for _ in range(3):
                tall = self.page_height()
                self.view(width, max(height, tall), scale, mobile)
                self.settle()
                if self.page_height() <= max(height, tall):
                    break
        data = self.cdp.send("Page.captureScreenshot", {"format": "png"}, self.s, timeout=120)["data"]
        if full:
            self.view(*view)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(base64.b64decode(data))
        return path


def png_size(path):
    with open(path, "rb") as f:
        head = f.read(24)
    return struct.unpack(">II", head[16:24])


# ----------------------------------------------------------------------------- the run


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--chrome")
    parser.add_argument("--port", type=int, default=4466)
    parser.add_argument("--range", default="lastYear",
                        choices=("last7d", "last30d", "last90d", "ytd", "lastYear"))
    parser.add_argument("--only", choices=[p for p, _ in PAGES])
    args = parser.parse_args()

    if not DIST.joinpath("index.html").exists() or not DIST.joinpath("data", "manifest.json").exists():
        raise SystemExit("No static build at frontend/dist. Run: cd frontend && npm run build:static")

    OUT.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(REVIEW, ignore_errors=True)
    server = serve(args.port)
    base = f"http://127.0.0.1:{server.server_address[1]}"
    browser = Browser(find_chrome(args.chrome))
    pages = [p for p in PAGES if not args.only or p[0] == args.only]
    report = {"range": args.range, "shots": []}

    def shoot(label, page, path, theme, path_out, width, height, scale, mobile, full):
        browser.view(width, height, scale, mobile)
        before = len(browser.problems)
        ready = browser.load(f"{base}{path}?theme={theme}&range={args.range}")
        found = browser.js(CHECK_JS)
        issues = list(browser.problems[before:])
        if not ready:
            issues.append("still loading after ten seconds")
        if found["wider"]:
            issues.append(f"page is {found['scrollWidth']}px wide in a {width}px window")
        issues += [f"error panel in {n}" for n in found["errors"]]
        issues += [f"empty card: {n}" for n in found["empty"]]
        issues += [f"chart drew flat: {n}" for n in found["flat"]]
        browser.capture(path_out, full=full, view=(width, height, scale, mobile))
        w, h = png_size(path_out)
        report["shots"].append({"shot": label, "page": page, "file": str(path_out.relative_to(ROOT)),
                                "pixels": [w, h], "issues": issues})
        print(f"  {'ok  ' if not issues else 'FAIL'} {label:<34} {w}x{h}")
        for i in issues:
            print(f"         {i}")

    try:
        print("README pictures")
        for page, path in pages:
            shoot(f"readme {page}", page, path, "light", README_SHOTS.joinpath(f"{page}.png"),
                  1600, 1000, 2, False, False)
        if not args.only or args.only == "executive":
            shoot("readme executive dark", "executive", "/", "dark",
                  README_SHOTS.joinpath("executive-dark.png"), 1600, 1000, 2, False, False)

            print("Portfolio card")
            for theme in ("light", "dark"):
                shoot(f"card {theme}", "executive", "/", theme, OUT.joinpath(f"card-{theme}.png"),
                      1440, 900, 1600 / 1440, False, False)

        print("Review set")
        for page, path in pages:
            for view, w, h, scale, mobile in REVIEW_VIEWS:
                for theme in ("light", "dark"):
                    if view == "tablet" and theme == "dark":
                        continue
                    shoot(f"{page} {view} {theme}", page, path, theme,
                          REVIEW.joinpath(f"{page}-{view}-{theme}.png"), w, h, scale, mobile, True)
    finally:
        browser.close()
        server.shutdown()

    OUT.joinpath("report.json").write_text(json.dumps(report, indent=2))
    failed = [s for s in report["shots"] if s["issues"]]
    cards = [s for s in report["shots"] if s["shot"].startswith("card")]
    for c in cards:
        if c["pixels"] != [1600, 1000]:
            print(f"  note: {c['file']} came out {c['pixels'][0]}x{c['pixels'][1]}, not 1600x1000")
    print(f"\n{len(report['shots'])} screenshots, {len(failed)} with problems. Report: scripts/out/report.json")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
