"""
Revenue API Routes

Provides endpoints for revenue analytics including:
- Time-series revenue trends (daily, weekly, monthly)
- Revenue breakdown by product category
- Revenue breakdown by geographic region
- Revenue breakdown by sales channel
- Top performing products

All endpoints support date range filtering via query parameters:
- start_date: Beginning of the period (YYYY-MM-DD)
- end_date: End of the period (YYYY-MM-DD)

Data is aggregated from the transactions table, filtered to completed transactions only.
"""

from flask import Blueprint, request
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from app import analytics, db
from app.periods import drop_incomplete_tail, next_bucket_start
from app.models import Transaction, Product

bp = Blueprint('revenue', __name__, url_prefix='/api/revenue')


@bp.route('/trends')
def get_trends():
    """
    Get revenue trends over time with configurable granularity.

    Query Parameters:
        start_date (str): Start of date range (default: 365 days ago)
        end_date (str): End of date range (default: today)
        granularity (str): Aggregation level - 'day', 'week', or 'month'

    Returns:
        List of objects with 'date', 'revenue', and 'orders' for each period.
        Used to render the Revenue Trend area chart on the dashboard.
    """
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    granularity = request.args.get('granularity', 'day')

    if not start_date:
        start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()

    if granularity == 'month':
        date_group = func.date_trunc('month', Transaction.transaction_date)
    elif granularity == 'week':
        date_group = func.date_trunc('week', Transaction.transaction_date)
    else:
        date_group = Transaction.transaction_date

    results = db.session.query(
        date_group.label('date'),
        func.sum(Transaction.amount).label('revenue'),
        func.count(Transaction.id).label('orders')
    ).filter(
        Transaction.transaction_date.between(start, end),
        Transaction.status == 'completed'
    ).group_by(date_group).order_by(date_group).all()

    rows = [
        {
            'date': row.date.strftime('%Y-%m-%d') if hasattr(row.date, 'strftime') else str(row.date),
            'revenue': float(row.revenue) if row.revenue else 0,
            'orders': row.orders,
        }
        for row in results
    ]

    return drop_incomplete_tail(rows, granularity, end)


@bp.route('/by-category')
def get_by_category():
    """Get revenue breakdown by product category."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()

    results = db.session.query(
        Product.category,
        func.sum(Transaction.amount).label('value')
    ).join(
        Transaction, Transaction.product_id == Product.id
    ).filter(
        Transaction.transaction_date.between(start, end),
        Transaction.status == 'completed'
    ).group_by(Product.category).order_by(func.sum(Transaction.amount).desc()).all()

    total = sum(float(r.value) for r in results if r.value)

    return [
        {
            'category': row.category or 'Other',
            'value': float(row.value) if row.value else 0,
            'percentage': round((float(row.value) / total * 100), 1) if total else 0,
        }
        for row in results
    ]


@bp.route('/by-region')
def get_by_region():
    """Get revenue breakdown by region."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()

    results = db.session.query(
        Transaction.region,
        func.sum(Transaction.amount).label('revenue'),
        func.count(func.distinct(Transaction.customer_id)).label('customers')
    ).filter(
        Transaction.transaction_date.between(start, end),
        Transaction.status == 'completed'
    ).group_by(Transaction.region).order_by(func.sum(Transaction.amount).desc()).all()

    return [
        {
            'region': row.region or 'Other',
            'revenue': float(row.revenue) if row.revenue else 0,
            'customers': row.customers,
            # Period-over-period growth per region needs a prior-window
            # comparison this query does not run. It reported a constant 0 for
            # every region, which reads as "flat" rather than "not computed".
            # Null until it is measured; nothing in the UI consumes it today.
            'growth': None,
        }
        for row in results
    ]


@bp.route('/by-channel')
def get_by_channel():
    """Get revenue breakdown by sales channel."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()

    results = db.session.query(
        Transaction.channel,
        func.sum(Transaction.amount).label('value')
    ).filter(
        Transaction.transaction_date.between(start, end),
        Transaction.status == 'completed'
    ).group_by(Transaction.channel).order_by(func.sum(Transaction.amount).desc()).all()

    total = sum(float(r.value) for r in results if r.value)

    return [
        {
            'channel': row.channel or 'Other',
            'value': float(row.value) if row.value else 0,
            'percentage': round((float(row.value) / total * 100), 1) if total else 0,
        }
        for row in results
    ]


@bp.route('/top-products')
def get_top_products():
    """Get top products by revenue."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    limit = request.args.get('limit', 10, type=int)

    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()

    results = db.session.query(
        Product.id,
        Product.name,
        Product.category,
        func.sum(Transaction.amount).label('revenue'),
        func.sum(Transaction.quantity).label('units'),
    ).join(
        Transaction, Transaction.product_id == Product.id
    ).filter(
        Transaction.transaction_date.between(start, end),
        Transaction.status == 'completed'
    ).group_by(
        Product.id, Product.name, Product.category
    ).order_by(func.sum(Transaction.amount).desc()).limit(limit).all()

    return [
        {
            'id': row.id,
            'name': row.name,
            'category': row.category,
            'revenue': float(row.revenue) if row.revenue else 0,
            'unitsSold': row.units or 0,
            # Period-over-period growth per region needs a prior-window
            # comparison this query does not run. It reported a constant 0 for
            # every region, which reads as "flat" rather than "not computed".
            # Null until it is measured; nothing in the UI consumes it today.
            'growth': None,
            'avgPrice': float(row.revenue) / row.units if row.units else 0,
        }
        for row in results
    ]


def _last_day(bucket, granularity):
    if granularity == 'day':
        return bucket
    return next_bucket_start(bucket, granularity) - timedelta(days=1)


def _change(current, previous):
    if not previous:
        return None
    return round((current - previous) / previous * 100, 1)


@bp.route('/comparison')
def get_comparison():
    """Revenue in each bucket of the window beside the same bucket a year earlier.

    Year over year rather than against the window just before, because the
    business is seasonal: a quarter-end spike lines up with last year's spike,
    so the gap between the two lines is growth and not the calendar.
    Only whole buckets are compared, at both ends of the window.
    """
    start, end, granularity = analytics.parse_window(request.args)
    buckets = analytics.complete_buckets(start, end, granularity)
    prior = analytics.year_earlier(buckets, granularity)

    current = analytics.load_orders(start, end)
    previous = analytics.load_orders(prior[0], _last_day(prior[-1], granularity))
    points = analytics.revenue_comparison(current, previous, buckets, prior, granularity)

    total = round(sum(p['current'] for p in points), 2)
    total_prior = round(sum(p['previous'] for p in points), 2)
    return {
        'granularity': granularity,
        'points': points,
        'current': total,
        'previous': total_prior,
        'change': _change(total, total_prior),
        'startDate': buckets[0].isoformat(),
        'endDate': _last_day(buckets[-1], granularity).isoformat(),
    }


@bp.route('/category-trends')
def get_category_trends():
    """Revenue per bucket for the five largest categories, the rest as Other."""
    start, end, granularity = analytics.parse_window(request.args)
    buckets = analytics.complete_buckets(start, end, granularity)
    orders = analytics.load_orders(start, end)
    return {'granularity': granularity,
            **analytics.split_series(orders, buckets, granularity, 'category', top=5)}


@bp.route('/region-trends')
def get_region_trends():
    """Revenue per bucket for every region, and each region's change on a year earlier."""
    start, end, granularity = analytics.parse_window(request.args)
    buckets = analytics.complete_buckets(start, end, granularity)
    prior = analytics.year_earlier(buckets, granularity)
    orders = analytics.load_orders(start, end)
    previous = analytics.load_orders(prior[0], _last_day(prior[-1], granularity))
    series = analytics.split_series(orders, buckets, granularity, 'region')

    window_end = _last_day(buckets[-1], granularity)
    prior_end = _last_day(prior[-1], granularity)
    now = orders[(orders['day'] >= buckets[0]) & (orders['day'] <= window_end)] if not orders.empty else orders
    before = previous[(previous['day'] >= prior[0]) & (previous['day'] <= prior_end)] \
        if not previous.empty else previous
    now_by = now.groupby('region')['amount'].sum().to_dict() if not now.empty else {}
    before_by = before.groupby('region')['amount'].sum().to_dict() if not before.empty else {}

    totals = [{
        'region': region,
        'revenue': round(float(now_by.get(region, 0.0)), 2),
        'previous': round(float(before_by.get(region, 0.0)), 2),
        'change': _change(float(now_by.get(region, 0.0)), float(before_by.get(region, 0.0))),
    } for region in series['keys']]
    return {'granularity': granularity, **series, 'totals': totals}


@bp.route('/calendar')
def get_calendar():
    """Daily revenue for the 53 calendar weeks ending with `end_date`."""
    _, end, _ = analytics.parse_window(request.args)
    start = analytics.calendar_start(end)
    days = analytics.daily_calendar(analytics.load_orders(start, end), end)
    return {
        'startDate': start.isoformat(),
        'endDate': end.isoformat(),
        'days': days,
        'max': max((d['revenue'] for d in days), default=0),
    }


@bp.route('/order-sizes')
def get_order_sizes():
    """How orders and revenue spread across order sizes in the window."""
    start, end, _ = analytics.parse_window(request.args)
    orders = analytics.load_orders(start, end)
    amounts = orders['amount'].tolist() if not orders.empty else []
    return analytics.size_distribution(amounts)
