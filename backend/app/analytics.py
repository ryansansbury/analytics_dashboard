"""The calculations behind the newer charts, written to run on any database.

The original endpoints group with PostgreSQL's `date_trunc`. These load plain
rows and aggregate them with pandas instead, so the same code runs against
PostgreSQL in production and SQLite in the test suite, and each calculation is
a pure function that a test can call with a handful of rows.

Two rules hold everywhere in this module:

- **A bucket the window only partly covers is not plotted.** That applies to the
  first bucket as well as the last. A window opening on a Thursday would
  otherwise start the chart with a three-day "week" that reads as a dip.
- **A figure that can't be measured is None.** Nothing here estimates,
  smooths, or pads.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

import pandas as pd

from app.periods import granularity_for, next_bucket_start

GRANULARITIES = ('day', 'week', 'month')
PIPELINE_STAGES = ['lead', 'qualified', 'proposal', 'negotiation']
WON, LOST = 'closed-won', 'closed-lost'
RISK_THRESHOLD = 0.5


# --------------------------------------------------------------------------- windows and buckets


def parse_window(args, default_days: int = 90):
    """(start, end, granularity) from request args, with safe defaults."""
    end = _parse_date(args.get('end_date')) or date.today()
    start = _parse_date(args.get('start_date')) or end - timedelta(days=default_days)
    if start > end:
        start, end = end, start
    granularity = args.get('granularity')
    if granularity not in GRANULARITIES:
        granularity = granularity_for((end - start).days)
    return start, end, granularity


def prior_window(start: date, end: date) -> tuple[date, date]:
    """The window of the same length that ends the day before `start`.

    Both ends are inclusive, so a window from day 0 to day 90 holds 91 days and
    so does its prior. Comparing 91 days against 90 overstated every change by
    about one percent.
    """
    length = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    return prev_end - timedelta(days=length - 1), prev_end


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        return None


def bucket_start(d: date, granularity: str) -> date:
    if granularity == 'month':
        return d.replace(day=1)
    if granularity == 'week':
        return d - timedelta(days=d.weekday())  # Monday, as date_trunc('week') does
    return d


def _next(b: date, granularity: str) -> date:
    return b + timedelta(days=1) if granularity == 'day' else next_bucket_start(b, granularity)


def complete_buckets(start: date, end: date, granularity: str) -> list[date]:
    """Start dates of the buckets the window covers from first day to last.

    When the window is shorter than one bucket, its one partial bucket is
    returned, since a single honest point beats a blank chart.
    """
    first = bucket_start(start, granularity)
    if first < start:
        first = _next(first, granularity)
    buckets, b = [], first
    while _next(b, granularity) - timedelta(days=1) <= end:
        buckets.append(b)
        b = _next(b, granularity)
    return buckets or [bucket_start(start, granularity)]


def year_earlier(buckets: list[date], granularity: str) -> list[date]:
    """The matching buckets one year before.

    Months shift by twelve. Days and weeks shift by 364 days, which is 52 whole
    weeks, so a Monday lines up with a Monday and the weekly rhythm of the two
    lines matches instead of drifting by a day.
    """
    if granularity == 'month':
        return [b.replace(year=b.year - 1) for b in buckets]
    return [b - timedelta(days=364) for b in buckets]


def label_bucket(b: date, granularity: str) -> str:
    """Words for a bucket: "Mar 2026" for a month, "Mar 2" for a day or week."""
    if granularity == 'month':
        return b.strftime('%b %Y')
    return f"{b.strftime('%b')} {b.day}"


def _assign(df: pd.DataFrame, buckets: list[date], granularity: str, column: str = 'day') -> pd.Series:
    """Each row's bucket start, or NaT when it falls outside every bucket."""
    if df.empty:
        return pd.Series([], dtype='object')
    keys = df[column].map(lambda d: bucket_start(d, granularity))
    allowed = set(buckets)
    return keys.where(keys.isin(allowed))


# --------------------------------------------------------------------------- orders


def load_orders(start: date, end: date) -> pd.DataFrame:
    """Completed orders in [start, end] with their product's category."""
    from app import db
    from app.models import Product, Transaction

    rows = db.session.query(
        Transaction.transaction_date, Transaction.amount, Transaction.customer_id,
        Transaction.region, Transaction.channel, Product.category,
    ).join(Product, Product.id == Transaction.product_id).filter(
        Transaction.transaction_date.between(start, end),
        Transaction.status == 'completed',
    ).all()
    return orders_frame(rows)


def orders_frame(rows) -> pd.DataFrame:
    """Rows of (date, amount, customer, region, channel, category) as a frame."""
    df = pd.DataFrame(rows, columns=['day', 'amount', 'customer_id', 'region', 'channel', 'category'])
    if not df.empty:
        df['day'] = df['day'].map(lambda d: d.date() if isinstance(d, datetime) else d)
        df['amount'] = df['amount'].astype(float)
    return df


def kpi_series(orders: pd.DataFrame, buckets: list[date], granularity: str) -> dict:
    """Revenue, active customers, and average order value for each bucket."""
    out = {'revenue': [], 'customers': [], 'aov': []}
    keyed = orders.assign(bucket=_assign(orders, buckets, granularity)) if not orders.empty else orders
    for b in buckets:
        rows = keyed[keyed['bucket'] == b] if not keyed.empty else keyed
        revenue = float(rows['amount'].sum()) if not rows.empty else 0.0
        count = int(len(rows))
        out['revenue'].append({'date': b.isoformat(), 'value': round(revenue, 2)})
        out['customers'].append({'date': b.isoformat(), 'value': int(rows['customer_id'].nunique()) if count else 0})
        out['aov'].append({'date': b.isoformat(), 'value': round(revenue / count, 2) if count else None})
    return out


def revenue_comparison(current: pd.DataFrame, previous: pd.DataFrame, buckets: list[date],
                       prior_buckets: list[date], granularity: str) -> list[dict]:
    """This window's revenue beside the prior window's, bucket for bucket."""
    cur = _sum_by(current, buckets, granularity)
    prev = _sum_by(previous, prior_buckets, granularity)
    return [{
        'date': b.isoformat(),
        'label': label_bucket(b, granularity),
        'previousDate': p.isoformat(),
        'previousLabel': label_bucket(p, granularity),
        'current': round(cur.get(b, 0.0), 2),
        'previous': round(prev.get(p, 0.0), 2),
    } for b, p in zip(buckets, prior_buckets)]


def _sum_by(orders: pd.DataFrame, buckets: list[date], granularity: str, by: str | None = None) -> dict:
    if orders.empty:
        return {}
    keyed = orders.assign(bucket=_assign(orders, buckets, granularity)).dropna(subset=['bucket'])
    if by is None:
        return keyed.groupby('bucket')['amount'].sum().to_dict()
    return keyed.groupby(['bucket', by])['amount'].sum().to_dict()


def split_series(orders: pd.DataFrame, buckets: list[date], granularity: str, by: str,
                 top: int | None = None, other_label: str = 'Other') -> dict:
    """Revenue per bucket split by a column, the largest `top` named and the rest as Other.

    Returns {"keys": [...], "points": [{"date", "label", <key>: value, ...}]}.
    Keys are ordered largest first over the whole window, so a chart can stack
    them with the biggest at the base and keep each one's color as the filter
    changes.
    """
    if orders.empty:
        return {'keys': [], 'points': [{'date': b.isoformat(), 'label': label_bucket(b, granularity)} for b in buckets]}
    keyed = orders.assign(bucket=_assign(orders, buckets, granularity)).dropna(subset=['bucket'])
    totals = keyed.groupby(by)['amount'].sum().sort_values(ascending=False)
    names = list(totals.index)
    keys = names if top is None or len(names) <= top + 1 else names[:top] + [other_label]
    named = set(keys) - {other_label}
    grouped = keyed.assign(key=keyed[by].where(keyed[by].isin(named), other_label)) \
        .groupby(['bucket', 'key'])['amount'].sum().to_dict()
    points = []
    for b in buckets:
        point = {'date': b.isoformat(), 'label': label_bucket(b, granularity)}
        for k in keys:
            point[k] = round(float(grouped.get((b, k), 0.0)), 2)
        points.append(point)
    return {'keys': keys, 'points': points}


def calendar_start(end: date, weeks: int = 53) -> date:
    """The Monday that opens a calendar of `weeks` week columns ending with `end`'s week."""
    return bucket_start(end, 'week') - timedelta(weeks=weeks - 1)


def daily_calendar(orders: pd.DataFrame, end: date, weeks: int = 53) -> list[dict]:
    """Revenue for every day from `calendar_start` through `end`, zero days included.

    The calendar opens on a Monday so each column is one whole week, and it
    stops at `end` rather than padding the final week with days that haven't
    happened.
    """
    start = calendar_start(end, weeks)
    totals = orders.groupby('day')['amount'].sum().to_dict() if not orders.empty else {}
    out = []
    d = start
    while d <= end:
        out.append({
            'date': d.isoformat(),
            'week': (d - start).days // 7,
            'weekday': d.weekday(),
            'revenue': round(float(totals.get(d, 0.0)), 2),
        })
        d += timedelta(days=1)
    return out


ORDER_SIZE_EDGES = [0, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000]


def _money(v: float) -> str:
    if v >= 1_000_000:
        return f'${v / 1_000_000:g}M'
    return f'${v / 1000:g}K'


def size_distribution(amounts: list[float], edges: list[float] = ORDER_SIZE_EDGES) -> list[dict]:
    """Orders and revenue in each size band, as counts and as shares.

    Bands are roughly logarithmic because order values are heavily skewed. Equal
    bands would put nearly every order in the first two.
    """
    total_n = len(amounts)
    total_v = float(sum(amounts))
    out = []
    for i, lo in enumerate(edges):
        hi = edges[i + 1] if i + 1 < len(edges) else None
        inside = [a for a in amounts if a >= lo and (hi is None or a < hi)]
        if lo == 0:
            label = f'Under {_money(hi)}'
        elif hi is None:
            label = f'{_money(lo)} and up'
        else:
            label = f'{_money(lo)} to {_money(hi)}'
        value = float(sum(inside))
        out.append({
            'band': label,
            'min': lo,
            'max': hi,
            'orders': len(inside),
            'revenue': round(value, 2),
            'orderShare': round(100.0 * len(inside) / total_n, 1) if total_n else None,
            'revenueShare': round(100.0 * value / total_v, 1) if total_v else None,
        })
    return out


# --------------------------------------------------------------------------- customers


def load_cohort_purchases() -> pd.DataFrame:
    """(customer_id, day) for every completed order by a customer acquired inside the history.

    Customers acquired before the first recorded order made their first
    purchase before the data begins, so their cohort can't be known. Leaving
    them in would file each one under whichever month they next happened to
    buy in.
    """
    from sqlalchemy import func
    from app import db
    from app.models import Customer, Transaction

    first_day = db.session.query(func.min(Transaction.transaction_date)).scalar()
    if first_day is None:
        return pd.DataFrame(columns=['customer_id', 'day'])
    rows = db.session.query(Transaction.customer_id, Transaction.transaction_date) \
        .join(Customer, Customer.id == Transaction.customer_id) \
        .filter(Transaction.status == 'completed', Customer.acquisition_date >= first_day).all()
    df = pd.DataFrame(rows, columns=['customer_id', 'day'])
    if not df.empty:
        df['day'] = df['day'].map(lambda d: d.date() if isinstance(d, datetime) else d)
    return df


def trailing_revenue(end: date | None = None, days: int = 365) -> dict[int, float]:
    """Each customer's completed revenue over the `days` ending on `end`.

    `end` defaults to the latest order on record, the same as-of date the churn
    model scores from.
    """
    from sqlalchemy import func
    from app import db
    from app.models import Transaction

    if end is None:
        end = db.session.query(func.max(Transaction.transaction_date)).scalar()
        if end is None:
            return {}
    start = end - timedelta(days=days - 1)
    rows = db.session.query(Transaction.customer_id, func.sum(Transaction.amount)).filter(
        Transaction.status == 'completed',
        Transaction.transaction_date.between(start, end),
    ).group_by(Transaction.customer_id).all()
    return {cid: round(float(total or 0), 2) for cid, total in rows}


def cohort_retention(purchases: pd.DataFrame, end: date, cohorts: int = 12) -> list[dict]:
    """Monthly retention by first-purchase cohort.

    A customer's cohort is the month of their first completed order, so month 0
    is 100% by definition. Month k is the share of the cohort with a completed
    order in the k-th month after it. Only complete months are measured, so the
    current partial month never reads as a drop. Cells past the last complete
    month are None, which draws as an empty cell, not a zero.

    `purchases` holds every completed order's (customer_id, day), all time.
    """
    last_complete = end.replace(day=1) - timedelta(days=1) if end != _month_end(end) else end
    last_month = last_complete.replace(day=1)
    if purchases.empty:
        return []
    df = purchases.assign(month=purchases['day'].map(lambda d: d.replace(day=1)))
    df = df[df['month'] <= last_month]
    first = df.groupby('customer_id')['month'].min().rename('cohort')
    df = df.join(first, on='customer_id')
    active = set(zip(df['customer_id'], df['month']))
    members = first.groupby(first).groups

    cohort_months = sorted(m for m in members if m <= last_month)[-cohorts:]
    out = []
    for m in cohort_months:
        ids = list(members[m])
        size = len(ids)
        row = []
        for k in range(cohorts):
            month = _add_months(m, k)
            if month > last_month:
                row.append(None)
            elif k == 0:
                row.append(100.0)
            else:
                kept = sum(1 for c in ids if (c, month) in active)
                row.append(round(100.0 * kept / size, 1) if size else None)
        out.append({'cohort': m.isoformat(), 'label': m.strftime('%b %Y'), 'size': size, 'retention': row})
    return out


def _month_end(d: date) -> date:
    return _add_months(d.replace(day=1), 1) - timedelta(days=1)


def _add_months(d: date, n: int) -> date:
    month = d.month - 1 + n
    return date(d.year + month // 12, month % 12 + 1, 1)


def risk_points(scored: list[dict], annual: dict[int, float]) -> list[dict]:
    """Churn probability against the last year's revenue, one point per live customer.

    A customer with no revenue in the year is left off rather than drawn at
    zero, since the value axis is logarithmic. Their count is still reported.
    """
    return [{
        'id': c['id'],
        'company': c['company'],
        'segment': c['segment'],
        'riskScore': c['riskScore'],
        'annualRevenue': annual[c['id']],
    } for c in scored if annual.get(c['id'], 0) > 0]


def at_risk_count(scored: list[dict], threshold: float = RISK_THRESHOLD) -> int:
    """Live customers the model puts at or above `threshold`."""
    return sum(1 for c in scored if c['riskScore'] >= threshold)


# --------------------------------------------------------------------------- pipeline


def load_opportunities() -> list[dict]:
    """Every opportunity with its stage history, oldest stage first."""
    from app import db
    from app.models import Pipeline, StageChange

    opps = {o.id: {
        'id': o.id,
        'amount': float(o.amount or 0),
        'stage': o.stage,
        'created': o.created_at.date() if isinstance(o.created_at, datetime) else o.created_at,
        'closed': o.closed_at,
        'history': [],
    } for o in db.session.query(Pipeline).all()}
    for change in db.session.query(StageChange).order_by(StageChange.opportunity_id, StageChange.entered_on).all():
        if change.opportunity_id in opps:
            opps[change.opportunity_id]['history'].append((change.stage, change.entered_on))
    return list(opps.values())


def open_value_on(opps: list[dict], day: date) -> float:
    """Value of the deals open at the end of `day`."""
    return round(sum(o['amount'] for o in opps
                     if o['created'] and o['created'] <= day and (o['closed'] is None or o['closed'] > day)), 2)


def closed_between(opps: list[dict], start: date, end: date) -> tuple[list[dict], list[dict]]:
    """(won, lost) deals that closed inside [start, end]."""
    won = [o for o in opps if o['closed'] and start <= o['closed'] <= end and o['stage'] == WON]
    lost = [o for o in opps if o['closed'] and start <= o['closed'] <= end and o['stage'] == LOST]
    return won, lost


def pipeline_kpis(opps: list[dict], start: date, end: date) -> dict:
    """Open value, win rate, won deal size, and cycle time, each against the prior window.

    Win rate is won over won plus lost, for deals that closed in the window.
    Cycle time is days from creation to the win, for deals won in the window.
    """
    prev_start, prev_end = prior_window(start, end)

    def summary(lo, hi):
        won, lost = closed_between(opps, lo, hi)
        closed = len(won) + len(lost)
        return {
            'win_rate': 100.0 * len(won) / closed if closed else None,
            'deal_size': sum(o['amount'] for o in won) / len(won) if won else None,
            'cycle': sum((o['closed'] - o['created']).days for o in won) / len(won) if won else None,
            'won': len(won),
            'lost': len(lost),
        }

    now, before = summary(start, end), summary(prev_start, prev_end)
    open_now, open_before = open_value_on(opps, end), open_value_on(opps, prev_end)

    def change(a, b):
        if a is None or b in (None, 0):
            return None
        return round((a - b) / b * 100, 1)

    def points(a, b):
        return None if a is None or b is None else round(a - b, 1)

    return {
        'pipelineValue': open_now,
        'pipelineChange': change(open_now, open_before),
        'openDeals': sum(1 for o in opps if o['created'] and o['created'] <= end
                         and (o['closed'] is None or o['closed'] > end)),
        'winRate': None if now['win_rate'] is None else round(now['win_rate'], 1),
        # Win rate is already a percentage, so its change is in percentage points.
        'winRateChange': points(now['win_rate'], before['win_rate']),
        'avgDealSize': None if now['deal_size'] is None else round(now['deal_size'], 2),
        'dealSizeChange': change(now['deal_size'], before['deal_size']),
        'avgCycleTime': None if now['cycle'] is None else round(now['cycle'], 1),
        'cycleTimeChange': change(now['cycle'], before['cycle']),
        'dealsWon': now['won'],
        'dealsLost': now['lost'],
    }


def pipeline_flow(opps: list[dict], end: date, days: int = 365) -> dict:
    """How the deals created in the `days` to `end` moved through the stages.

    Nodes are the four stages plus Won, Lost, and Open. A deal contributes one
    unit to each stage-to-stage link it crossed, and one to the link from the
    stage it stopped in to its outcome. Values count deals, and the totals out
    of Lead equal the number of deals created.
    """
    start = end - timedelta(days=days - 1)
    names = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Open']
    index = {s: i for i, s in enumerate(PIPELINE_STAGES)}
    won_i, lost_i, open_i = 4, 5, 6
    links = {}

    def add(a, b, amount):
        count, value = links.get((a, b), (0, 0.0))
        links[(a, b)] = (count + 1, value + amount)

    created = 0
    for o in opps:
        if not o['created'] or not (start <= o['created'] <= end):
            continue
        created += 1
        reached = [s for s, d in o['history'] if s in index and d <= end]
        outcome_row = next(((s, d) for s, d in o['history'] if s in (WON, LOST) and d <= end), None)
        for a, b in zip(reached, reached[1:]):
            add(index[a], index[b], o['amount'])
        last = index[reached[-1]] if reached else 0
        if outcome_row is None:
            add(last, open_i, o['amount'])
        else:
            add(last, won_i if outcome_row[0] == WON else lost_i, o['amount'])

    return {
        'nodes': [{'name': n} for n in names],
        'links': [{'source': a, 'target': b, 'value': c, 'amount': round(v, 2)}
                  for (a, b), (c, v) in sorted(links.items())],
        'created': created,
        'startDate': start.isoformat(),
        'endDate': end.isoformat(),
    }


def stage_durations(opps: list[dict], end: date, days: int = 365) -> list[dict]:
    """Average days spent in each stage, for stage exits in the `days` to `end`."""
    start = end - timedelta(days=days - 1)
    spent = {s: [] for s in PIPELINE_STAGES}
    for o in opps:
        history = [(s, d) for s, d in o['history'] if d <= end]
        for (stage, entered), (_, left) in zip(history, history[1:]):
            if stage in spent and start <= left <= end:
                spent[stage].append((left - entered).days)
    return [{
        'stage': s.title(),
        'avgDays': round(sum(v) / len(v), 1) if v else None,
        'count': len(v),
    } for s, v in spent.items()]


def stage_conversion(opps: list[dict], end: date, days: int = 365) -> list[dict]:
    """Share of deals leaving each stage that moved forward, for exits in the `days` to `end`.

    A deal still sitting in a stage hasn't converted or failed yet, so it is
    left out of that stage's rate instead of counting as a loss.
    """
    start = end - timedelta(days=days - 1)
    forward = {stage: nxt for stage, nxt in zip(PIPELINE_STAGES, PIPELINE_STAGES[1:] + [WON])}
    moved = {s: 0 for s in PIPELINE_STAGES}
    left = {s: 0 for s in PIPELINE_STAGES}
    for o in opps:
        history = [(s, d) for s, d in o['history'] if d <= end]
        for (stage, _), (nxt, when) in zip(history, history[1:]):
            if stage in left and start <= when <= end:
                left[stage] += 1
                if nxt == forward[stage]:
                    moved[stage] += 1
    return [{
        'fromStage': s.title(),
        'toStage': 'Won' if forward[s] == WON else forward[s].title(),
        'rate': round(100.0 * moved[s] / left[s], 1) if left[s] else None,
        'exits': left[s],
    } for s in PIPELINE_STAGES]


def prorated(quota: float, start: date, end: date) -> float:
    """An annual quota scaled to the days in the window."""
    days = (end - start).days + 1
    return quota * days / 365.0
