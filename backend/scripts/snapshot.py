#!/usr/bin/env python3
"""Snapshot every API response to static JSON for the public demo.

Why this exists
---------------
The application is a normal Flask + PostgreSQL service and still runs that way;
see the README. The hosted demo is a *build artifact* of it. Serving the demo
from a live database would mean paying for Postgres, waiting through a cold
start while two models train, and running a cron to stop the seeded window
drifting into the past. None of that teaches a visitor anything the JSON does
not.

So the pipeline runs for real at build time — real Postgres, real queries, real
scikit-learn fits on a holdout — and its output is frozen to disk. Every number
in the static demo was produced by the code in this repo. Nothing is hand-written.

Keying
------
Presets like "last 90 days" resolve to dates, and dates move. A snapshot keyed
by date would miss the moment the clock rolled past midnight.

So the snapshot records the date it was taken, and the frontend in static mode
resolves its presets against *that* date rather than today's. The two sides then
always agree, and the request path can be used directly as the cache key with no
separate mapping to drift.

Usage
-----
    DATABASE_URL=postgresql://... python scripts/snapshot.py

Writes frontend/public/data/*.json plus manifest.json.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

BACKEND = Path(__file__).resolve().parent.parent
OUT_DIR = BACKEND.parent / "frontend" / "public" / "data"

#: Must match `getDateRangeFromPreset` in frontend/src/hooks/useFilters.tsx.
#: frontend/src/services/staticData.test.ts drives the real API layer against a
#: real manifest and fails on any request this list did not produce, so a
#: mismatch here breaks a test rather than a page.
def _year_before(t: date) -> date:
    """The same day a year earlier, with February 29 falling back to the 28th as date-fns does."""
    try:
        return t.replace(year=t.year - 1)
    except ValueError:
        return t.replace(year=t.year - 1, day=28)


#: Both ends of a window are inclusive, so "last 7 days" starts six days back.
PRESETS = {
    "last7d": lambda t: t - timedelta(days=6),
    "last30d": lambda t: t - timedelta(days=29),
    "last90d": lambda t: t - timedelta(days=89),
    "ytd": lambda t: date(t.year, 1, 1),
    "lastYear": lambda t: _year_before(t) + timedelta(days=1),
}

#: Granularity per preset, mirroring `getGranularity` on the Dashboard page.
GRANULARITY = {
    "last7d": "day",
    "last30d": "day",
    "last90d": "week",
    "ytd": "month",
    "lastYear": "month",
}


def slugify(path: str) -> str:
    """Turn a request path into a filename.

    Deliberately a plain character substitution rather than a hash: the
    frontend has to compute the identical key, and a readable slug makes a
    mismatch obvious in the network tab instead of opaque.
    """
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", path.strip("/")).strip("-").lower()
    return slug or "index"


#: Row limits the pages actually ask for.
LIMITS = {
    "top_products": (10,),     # Revenue
    "at_risk": (10,),          # Customers
}


def endpoints_for(start: str, end: str, granularity: str) -> list[str]:
    """Every request the UI makes for one preset.

    Mirrors the call sites in frontend/src/services/api.ts exactly, including
    parameter order, because the query string is the cache key. Several views
    don't depend on the window's start and send only `end_date` (the calendar,
    the cohort table, the pipeline flow, and stage durations), and two send
    nothing at all (lifetime value and the risk scatter). Those collapse to one
    file shared by every preset.

    Requests are listed here rather than discovered, so a frontend test drives
    the real API layer against the generated manifest and fails on anything the
    UI asks for that this list did not produce.
    """
    dr = f"start_date={start}&end_date={end}"
    g = f"granularity={granularity}"
    paths = [
        # Executive
        f"/api/dashboard/summary?{dr}",
        f"/api/revenue/comparison?{dr}&{g}",
        f"/api/revenue/by-category?{dr}",
        f"/api/revenue/calendar?end_date={end}",
        f"/api/operations/pipeline?{dr}",
        # Revenue
        f"/api/revenue/category-trends?{dr}&{g}",
        f"/api/revenue/region-trends?{dr}&{g}",
        f"/api/revenue/by-channel?{dr}",
        f"/api/revenue/order-sizes?{dr}",
        # Customers
        f"/api/customers/overview?{dr}",
        f"/api/customers/cohorts?end_date={end}",
        f"/api/customers/acquisition?{dr}",
        f"/api/customers/segments?{dr}",
        "/api/customers/lifetime-value",
        # Operations
        f"/api/operations/pipeline-kpis?{dr}",
        f"/api/operations/pipeline-flow?end_date={end}",
        f"/api/operations/sales-performance?{dr}",
        f"/api/operations/cycle-time?end_date={end}",
        f"/api/forecasting/pipeline?{dr}",
        # Forecasting
        f"/api/forecasting/kpis?{dr}",
        f"/api/forecasting/model-performance?{dr}",
        f"/api/forecasting/revenue?periods=6&{dr}",
        f"/api/forecasting/seasonality?{dr}",
        f"/api/forecasting/revenue-at-risk?{dr}",
        "/api/customers/risk-value",
        "/api/health",
    ]
    for n in LIMITS["top_products"]:
        paths.append(f"/api/revenue/top-products?{dr}&limit={n}")
    for n in LIMITS["at_risk"]:
        paths.append(f"/api/customers/at-risk?limit={n}&{dr}")
    return paths


def main() -> int:
    from app import create_app

    app = create_app("development")
    client = app.test_client()

    with app.app_context():
        from app.ml import registry
        from app.models import Transaction
        from app import db

        rows = db.session.query(db.func.count(Transaction.id)).scalar() or 0
        if rows == 0:
            print("ERROR: database is empty. Run `python reseed.py` first.", file=sys.stderr)
            return 1

        # Train once up front so the first snapshotted request is not the one
        # paying for it, and so a training failure stops the build loudly.
        registry.reset()
        if registry.get_churn_model() is None:
            print(f"ERROR: churn model unavailable: {registry.get_churn_error()}", file=sys.stderr)
            return 1
        if registry.get_revenue_forecast() is None:
            print(f"ERROR: revenue model unavailable: {registry.get_revenue_error()}", file=sys.stderr)
            return 1

    taken_on = date.today()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for stale in OUT_DIR.glob("*.json"):
        stale.unlink()

    written, failed = {}, []
    for preset, start_of in PRESETS.items():
        start = start_of(taken_on).isoformat()
        end = taken_on.isoformat()
        for path in endpoints_for(start, end, GRANULARITY[preset]):
            if path in written:
                continue  # shared by every preset and already taken
            response = client.get(path)
            if response.status_code != 200:
                failed.append((path, response.status_code))
                continue
            name = f"{slugify(path)}.json"
            (OUT_DIR / name).write_text(json.dumps(response.get_json(), separators=(",", ":")))
            written[path] = name

    manifest = {
        "snapshotDate": taken_on.isoformat(),
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "presets": {p: {"startDate": PRESETS[p](taken_on).isoformat(),
                        "endDate": taken_on.isoformat(),
                        "granularity": GRANULARITY[p]} for p in PRESETS},
        "files": written,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))

    size = sum(f.stat().st_size for f in OUT_DIR.glob("*.json"))
    print(f"snapshot date : {taken_on}")
    print(f"files written : {len(written)}  ({size / 1024:.0f} KB total)")
    if failed:
        print(f"FAILED        : {len(failed)}", file=sys.stderr)
        for path, code in failed[:10]:
            print(f"  {code}  {path}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
