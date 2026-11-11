from flask import Blueprint, request
from sqlalchemy import func
from datetime import timedelta
from app import analytics, db
from app.models import Transaction
from app.periods import granularity_for, next_bucket_start

bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


def pct_change(current, previous):
    """Period-over-period change, or None when there is no baseline.

    A measured 0.0 is returned as 0.0. This used to run through a helper named
    `ensure_nonzero` which, whenever the real change came out to exactly zero,
    substituted `random.uniform(3.0, 12.0)` - so the one case where the honest
    answer was "flat" was the one case guaranteed to be invented. Where no prior
    period existed, the whole figure was random.
    """
    if current is None or not previous:
        return None
    return round((float(current) - float(previous)) / float(previous) * 100, 1)


def window_totals(start, end):
    """Revenue, active customers, and orders for completed orders in [start, end]."""
    revenue, customers, orders = db.session.query(
        func.sum(Transaction.amount),
        func.count(func.distinct(Transaction.customer_id)),
        func.count(Transaction.id),
    ).filter(
        Transaction.transaction_date.between(start, end),
        Transaction.status == 'completed',
    ).one()
    return float(revenue or 0), int(customers or 0), int(orders or 0)


@bp.route('/summary')
def get_summary():
    """Executive summary: four headline figures, each with its trend.

    Every change compares the window with the window of the same length that
    ends the day before it starts. "Active customers" counts customers with a
    completed order in the window, the same definition the Customers page uses.
    """
    start, end, _ = analytics.parse_window(request.args, default_days=30)
    prev_start, prev_end = analytics.prior_window(start, end)

    revenue, customers, orders = window_totals(start, end)
    prev_revenue, prev_customers, prev_orders = window_totals(prev_start, prev_end)

    aov = revenue / orders if orders else None
    prev_aov = prev_revenue / prev_orders if prev_orders else None

    # Open pipeline on the window's last day and on the prior window's, from
    # each deal's stage history. Before that history existed this change was
    # null, and before that it was `random.uniform(10.0, 25.0)`.
    opportunities = analytics.load_opportunities()
    pipeline = analytics.open_value_on(opportunities, end)
    prev_pipeline = analytics.open_value_on(opportunities, prev_end)

    # The sparkline behind each figure, in the bucket size the trend charts use.
    granularity = granularity_for((end - start).days)
    buckets = analytics.complete_buckets(start, end, granularity)
    orders_frame = analytics.load_orders(start, end)
    trends = analytics.kpi_series(orders_frame, buckets, granularity)
    trends['pipeline'] = [{
        'date': b.isoformat(),
        'value': analytics.open_value_on(
            opportunities, min(_bucket_last_day(b, granularity), end)),
    } for b in buckets]

    return {
        'kpis': {
            'totalRevenue': {
                'value': revenue,
                'previousValue': prev_revenue,
                'change': revenue - prev_revenue,
                'changePercent': pct_change(revenue, prev_revenue),
            },
            'totalCustomers': {
                'value': customers,
                'previousValue': prev_customers,
                'change': customers - prev_customers,
                'changePercent': pct_change(customers, prev_customers),
            },
            'totalOrders': {
                'value': orders,
                'previousValue': prev_orders,
                'changePercent': pct_change(orders, prev_orders),
            },
            'avgOrderValue': {
                'value': round(aov, 2) if aov is not None else None,
                'changePercent': pct_change(aov, prev_aov),
            },
            'pipelineValue': {
                'value': pipeline,
                'changePercent': pct_change(pipeline, prev_pipeline),
            },
        },
        'trends': trends,
        'granularity': granularity,
        'dateRange': {
            'startDate': start.isoformat(),
            'endDate': end.isoformat(),
            'previousStartDate': prev_start.isoformat(),
            'previousEndDate': prev_end.isoformat(),
        },
    }


def _bucket_last_day(bucket_start, granularity):
    if granularity == 'day':
        return bucket_start
    return next_bucket_start(bucket_start, granularity) - timedelta(days=1)


@bp.route('/kpis')
def get_kpis():
    """Get top-level KPIs."""
    return get_summary()
