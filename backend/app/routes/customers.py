from flask import Blueprint, request
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from app import analytics, db
from app.periods import drop_incomplete_tail, granularity_for
from app.models import Customer, Transaction
from app.routes.forecasting import get_at_risk_customers_with_scores

bp = Blueprint('customers', __name__, url_prefix='/api/customers')


@bp.route('/overview')
def get_overview():
    """Get customer overview metrics."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()

    # The prior window has the same number of days as this one.
    prev_start, prev_end = analytics.prior_window(start, end)

    # Active means a completed order in the window, the definition the
    # Executive page uses, so the two pages report the same count.
    current_active = db.session.query(
        func.count(func.distinct(Transaction.customer_id))
    ).filter(
        Transaction.transaction_date.between(start, end),
        Transaction.status == 'completed',
    ).scalar() or 0

    prev_active = db.session.query(
        func.count(func.distinct(Transaction.customer_id))
    ).filter(
        Transaction.transaction_date.between(prev_start, prev_end),
        Transaction.status == 'completed',
    ).scalar() or 0

    # New customers acquired in this period
    new_customers = db.session.query(
        func.count(Customer.id)
    ).filter(
        Customer.acquisition_date.between(start, end)
    ).scalar() or 0

    # Previous period new customers
    prev_new = db.session.query(
        func.count(Customer.id)
    ).filter(
        Customer.acquisition_date.between(prev_start, prev_end)
    ).scalar() or 0

    # Total churned accounts. Deliberately NOT apportioned to the window.
    #
    # This used to report `total_churned * (period_days / 730)`, spreading the
    # lifetime churn count evenly across two years and calling the slice
    # "churned this period". Churn is not uniform in time and the model does not
    # persist a churn date, so the figure cannot be scoped to a window from this
    # schema. Reporting the real total is honest; inventing an allocation is not.
    total_churned = db.session.query(
        func.count(Customer.id)
    ).filter(
        Customer.status == 'churned'
    ).scalar() or 0

    # Customers the churn model puts at 50% or higher, the same count the
    # Forecasting page reports. This used to be the length of the whole scored
    # list, which is every live customer, so the card read 1.6K "at risk".
    at_risk = analytics.at_risk_count(get_at_risk_customers_with_scores(start_date, end_date))

    def pct_change(current, previous):
        """Period-over-period change, or None when there is no baseline."""
        if not previous:
            return None
        return round((current - previous) / previous * 100, 1)

    # `prev_active` and `prev_new` were already being queried above and then
    # discarded: every change figure here was `random.uniform(...)`, with the
    # ranges hand-picked so the cards always read as growth. These two are real.
    total_change = pct_change(current_active, prev_active)
    new_change = pct_change(new_customers, prev_new)

    return {
        'total': current_active,
        'totalChange': total_change,
        'new': new_customers,
        'newChange': new_change,
        'churned': total_churned,
        'churnedScope': 'all time',
        # No churn date is persisted and no prior at-risk snapshot exists, so
        # neither of these can be differenced. Null lets the UI omit the arrow.
        'churnedChange': None,
        'atRisk': at_risk,
        'atRiskThreshold': analytics.RISK_THRESHOLD,
        'atRiskChange': None,
    }


@bp.route('/segments')
def get_segments():
    """Get customer breakdown by segment - customers active in period."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()

    # Get customers who had transactions in this period, grouped by segment
    results = db.session.query(
        Customer.segment,
        func.count(func.distinct(Customer.id)).label('count'),
        func.sum(Transaction.amount).label('revenue')
    ).join(
        Transaction, Transaction.customer_id == Customer.id
    ).filter(
        Transaction.transaction_date.between(start, end),
        Transaction.status == 'completed'
    ).group_by(Customer.segment).all()

    total = sum(r.count for r in results)

    return [
        {
            'segment': row.segment or 'Other',
            'count': row.count,
            'revenue': float(row.revenue) if row.revenue else 0,
            'percentage': round((row.count / total * 100), 1) if total else 0,
        }
        for row in results
    ]


@bp.route('/cohorts')
def get_cohorts():
    """Monthly retention for the twelve most recent first-purchase cohorts.

    A customer belongs to the month of their first completed order, so month 0
    is 100% by definition. Month k is the share of the cohort with a completed
    order k months later. Only whole months count, and cells a cohort hasn't
    reached yet are null.

    Cohorts used to be keyed on acquisition month while month 0 counted orders,
    so a customer acquired late in a month and buying early in the next made
    month 0 read 30% and month 1 read higher, which no retention curve does.

    Cohorts end at `end_date`. `start_date` is accepted and ignored, because a
    cohort table needs a year of months whatever the page's filter is.
    """
    _, end, _ = analytics.parse_window(request.args)
    return analytics.cohort_retention(analytics.load_cohort_purchases(), end)


@bp.route('/risk-value')
def get_risk_value():
    """Every live customer's churn probability against their last year's revenue."""
    scored = get_at_risk_customers_with_scores()
    annual = analytics.trailing_revenue()
    points = analytics.risk_points(scored, annual)
    return {
        'points': points,
        'threshold': analytics.RISK_THRESHOLD,
        'scored': len(scored),
        'withoutRevenue': len(scored) - len(points),
    }


@bp.route('/lifetime-value')
def get_lifetime_value():
    """Get lifetime value distribution filtered by customer acquisition date."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Bands roughly logarithmic, because lifetime value is heavily skewed. The
    # old top band started at $100K and held more than half of all customers.
    ranges = [
        (0, 25000, 'Under $25K'),
        (25000, 50000, '$25K to $50K'),
        (50000, 100000, '$50K to $100K'),
        (100000, 250000, '$100K to $250K'),
        (250000, 500000, '$250K to $500K'),
        (500000, 1000000, '$500K to $1M'),
        (1000000, float('inf'), '$1M and up'),
    ]

    # Build base query with date filter
    base_query = db.session.query(Customer)
    if start_date:
        base_query = base_query.filter(Customer.acquisition_date >= start_date)
    if end_date:
        base_query = base_query.filter(Customer.acquisition_date <= end_date)

    total = base_query.count() or 1
    results = []

    for min_val, max_val, label in ranges:
        query = base_query.filter(Customer.lifetime_value >= min_val)
        if max_val != float('inf'):
            query = query.filter(Customer.lifetime_value < max_val)
        count = query.count()

        results.append({
            'range': label,
            'count': count,
            'percentage': round((count / total * 100), 1),
        })

    return results


@bp.route('/acquisition')
def get_acquisition():
    """New customers per bucket, split by acquisition channel.

    Grouped in pandas rather than with date_trunc, so it runs on any database,
    and only whole buckets are returned, at both ends of the window. A partial
    bucket split across five channels drops every channel at once, which reads
    as acquisition collapsing.
    """
    import pandas as pd

    start, end, granularity = analytics.parse_window(request.args, default_days=365)
    buckets = analytics.complete_buckets(start, end, granularity)
    rows = db.session.query(Customer.acquisition_date, Customer.acquisition_channel).filter(
        Customer.acquisition_date.between(start, end)
    ).all()
    frame = pd.DataFrame(
        [(d, 1.0, c or 'Other') for d, c in rows], columns=['day', 'amount', 'channel'])
    series = analytics.split_series(frame, buckets, granularity, 'channel')
    for point in series['points']:
        for key in series['keys']:
            point[key] = int(point[key])
    return {'granularity': granularity, **series}


@bp.route('/at-risk')
def get_at_risk():
    """Get at-risk customers with consistent risk scores."""
    limit = request.args.get('limit', 10, type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Use shared function for consistent risk scores with Forecasting page
    return get_at_risk_customers_with_scores(start_date, end_date, limit)
