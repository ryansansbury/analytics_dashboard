"""Print the generated dataset's shape without a database.

    backend/venv/bin/python backend/scripts/inspect_seed.py

Runs the generator in memory and reports what the charts will show: yearly
growth, seasonality, the weekday pattern, regional and category trends, quota
attainment, and how the pipeline's deals moved. A quick check after changing
the generator, before reseeding anything.
"""

import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data import seed_data as seed  # noqa: E402


def main():
    seed.END_DATE = datetime.now()
    seed.START_DATE = seed.END_DATE - timedelta(days=730)
    data = seed.generate_all()
    txns = [t for t in data['transactions'] if t['status'] == 'completed']
    end = seed.END_DATE.date()

    def window(days_back_from, days_back_to):
        lo, hi = end - timedelta(days=days_back_from), end - timedelta(days=days_back_to)
        return [t for t in txns if lo < t['transaction_date'] <= hi]

    year1, year2 = window(730, 365), window(365, 0)
    rev1, rev2 = sum(t['amount'] for t in year1), sum(t['amount'] for t in year2)
    print(f"orders {len(data['transactions'])}, completed {len(txns)}")
    print(f"revenue year 1 ${rev1 / 1e6:.1f}M, year 2 ${rev2 / 1e6:.1f}M, growth {100 * (rev2 / rev1 - 1):.1f}%")
    print(f"average order ${sum(t['amount'] for t in txns) / len(txns):,.0f}")

    by_month = defaultdict(float)
    for t in year2:
        by_month[t['transaction_date'].month] += t['amount']
    peak = max(by_month, key=by_month.get)
    low = min(by_month, key=by_month.get)
    print(f"last year's peak month {peak}, low month {low}, ratio {by_month[peak] / by_month[low]:.2f}")

    by_dow = Counter(t['transaction_date'].weekday() for t in year2)
    print("orders by weekday (Mon..Sun):", [by_dow[d] for d in range(7)])

    products = {p['id']: p for p in data['products']}
    for label, rows in (("year 1", year1), ("year 2", year2)):
        regions = defaultdict(float)
        cats = defaultdict(float)
        for t in rows:
            regions[t['region']] += t['amount']
            cats[products[t['product_id']]['category']] += t['amount']
        total = sum(regions.values())
        print(f"{label} region share:", {r: f"{100 * v / total:.0f}%" for r, v in sorted(regions.items(), key=lambda x: -x[1])})
        print(f"{label} category share:", {c: f"{100 * v / total:.0f}%" for c, v in sorted(cats.items(), key=lambda x: -x[1])})

    booked = defaultdict(float)
    for t in window(90, 0):
        booked[t['sales_rep_id']] += t['amount']
    attain = sorted(100 * booked[r['id']] / (r['quota'] * 90 / 365) for r in data['sales_reps'])
    print(f"90-day attainment against prorated quota: min {attain[0]:.0f}%, median {attain[len(attain) // 2]:.0f}%, max {attain[-1]:.0f}%")

    stages = Counter(p['stage'] for p in data['pipeline'])
    won, lost = stages['closed-won'], stages['closed-lost']
    print("pipeline stages:", dict(stages), f"win rate {100 * won / max(1, won + lost):.0f}%")
    opens = [p for p in data['pipeline'] if p['closed_at'] is None]
    print(f"open pipeline ${sum(p['amount'] for p in opens) / 1e6:.1f}M across {len(opens)} deals")
    print(f"stage changes {len(data['stage_changes'])}")

    ltv = sorted(c['lifetime_value'] for c in data['customers'])
    print(f"lifetime value: median ${ltv[len(ltv) // 2]:,.0f}, p90 ${ltv[int(len(ltv) * 0.9)]:,.0f}, max ${ltv[-1]:,.0f}")
    print("customer status:", dict(Counter(c['status'] for c in data['customers'])))


if __name__ == '__main__':
    main()
