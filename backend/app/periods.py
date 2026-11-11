"""Period bucketing rules shared by every time-series endpoint.

One rule, defined once: **a bucket the window only partly covers is not
plotted.**

A month nine days old holds nine days of revenue. Placed beside twelve complete
months it reads as demand collapsing, when nothing has happened except the month
not being over. The same series bucketed weekly looks fine, because a part-week
is a small shortfall where a part-month is a large one — which is exactly how
this surfaced: identical data trended upward under a 90-day filter and appeared
to fall off a cliff under Year to Date, and the only difference was bucket size.

Endpoints that bucket by time must call `drop_incomplete_tail` so the pages
cannot disagree with each other or with the forecasting model, whose input is
governed by the same rule in `app.ml.features.monthly_revenue`.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

#: Granularities that aggregate several days into one point. A daily bucket is
#: either inside the window or outside it, so it is never partial.
BUCKETED = ('month', 'week')


def next_bucket_start(bucket_start: date, granularity: str) -> date:
    """First day of the bucket after the one beginning at `bucket_start`."""
    if granularity == 'month':
        if bucket_start.month == 12:
            return bucket_start.replace(year=bucket_start.year + 1, month=1, day=1)
        return bucket_start.replace(month=bucket_start.month + 1, day=1)
    return bucket_start + timedelta(days=7)


def is_complete(bucket_start: date, granularity: str, window_end: date) -> bool:
    """Does `window_end` reach the final day of this bucket?"""
    if granularity not in BUCKETED:
        return True
    return window_end >= next_bucket_start(bucket_start, granularity) - timedelta(days=1)


def drop_incomplete_tail(rows, granularity, window_end, key='date'):
    """Remove trailing rows whose bucket the window only partly covers.

    Rows must be ordered oldest first and carry an ISO date under `key`.
    Handles shapes with several rows per bucket (a series split by channel or
    segment, say) by dropping every row sharing the incomplete bucket's date.

    Never returns an empty list when it was given data: a single partial bucket
    is better than a blank chart, and callers have no way to distinguish "no
    data" from "everything was trimmed".
    """
    if granularity not in BUCKETED or not rows:
        return rows

    last_key = rows[-1].get(key)
    if not last_key:
        return rows

    try:
        bucket_start = datetime.strptime(last_key, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        return rows

    if is_complete(bucket_start, granularity, window_end):
        return rows

    kept = [r for r in rows if r.get(key) != last_key]
    return kept or rows


def granularity_for(period_days: int) -> str:
    """Bucket size for a window of `period_days`.

    Shared so that a page's chart and its underlying query cannot disagree about
    what a point represents.
    """
    if period_days <= 31:
        return 'day'
    if period_days <= 92:
        return 'week'
    return 'month'
