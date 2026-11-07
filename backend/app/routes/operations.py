from flask import Blueprint, request
from sqlalchemy import func
from datetime import datetime, timedelta
from app import analytics, db
from app.models import Pipeline, SalesRep, Transaction

bp = Blueprint('operations', __name__, url_prefix='/api/operations')


@bp.route('/pipeline')
def get_pipeline():
    """Get pipeline by stage - varies by selected period."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()
    period_days = (end - start).days

    stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed-won']

    # One grouped query instead of five, and no post-hoc scaling.
    #
    # This endpoint used to read the real per-stage totals and then multiply
    # both the value and the count by random factors (0.8-1.2 on value,
    # 0.75-1.25 on count) plus a "period factor" derived from the length of the
    # window. The result reported 47.8M of pipeline against 45.5M that actually
    # existed, disagreed with the dashboard's own pipeline figure by 5M, and
    # returned counts that moved in the opposite direction to the underlying
    # rows. Conversion rates were computed from those invented counts.
    rows = db.session.query(
        Pipeline.stage,
        func.sum(Pipeline.amount).label('value'),
        func.count(Pipeline.id).label('count'),
    ).filter(
        Pipeline.stage.in_(stages)
    ).group_by(Pipeline.stage).all()

    by_stage = {r.stage: r for r in rows}

    results = []
    prev_count = None
    for stage in stages:
        row = by_stage.get(stage)
        value = float(row.value) if row and row.value else 0.0
        count = int(row.count) if row else 0

        # Stage-to-stage conversion, measured. The first stage has nothing
        # upstream of it, so it has no conversion rate rather than a fake 100%.
        conversion_rate = None
        if prev_count:
            conversion_rate = round(count / prev_count * 100, 1)

        results.append({
            'stage': stage.replace('-', ' ').title(),
            'value': round(value, 2),
            'count': count,
            'conversionRate': conversion_rate,
        })
        prev_count = count

    return results


@bp.route('/pipeline-kpis')
def get_pipeline_kpis():
    """Open pipeline, win rate, won deal size, and sales cycle, each against the prior window.

    All of it comes from each deal's stage history. Win rate is deals won over
    deals won or lost, among deals that closed in the window. Cycle time is
    days from creation to the win. The open pipeline is what was open on the
    window's last day.

    Before stage history existed every change here was null, and before that
    they were `random.uniform(5.0, 15.0)` with a comment promising they were
    "ALWAYS non-zero", and cycle time was `42 + random.randint(-5, 8)`. Win rate
    was won deals over deals currently sitting at lead, which isn't a rate of
    anything.
    """
    start, end, _ = analytics.parse_window(request.args, default_days=30)
    return analytics.pipeline_kpis(analytics.load_opportunities(), start, end)


@bp.route('/pipeline-flow')
def get_pipeline_flow():
    """How the deals created in the 12 months to `end_date` moved through the stages."""
    _, end, _ = analytics.parse_window(request.args)
    return analytics.pipeline_flow(analytics.load_opportunities(), end)


@bp.route('/sales-performance')
def get_sales_performance():
    """Get sales rep performance vs quota - showing a growing org hitting goals."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()

    # Get all sales reps with their achieved revenue in the selected period
    results = db.session.query(
        SalesRep.id,
        SalesRep.name,
        SalesRep.team,
        SalesRep.region,
        SalesRep.quota,
        func.sum(Transaction.amount).label('achieved'),
        func.count(Transaction.id).label('deals')
    ).outerjoin(
        Transaction,
        (Transaction.sales_rep_id == SalesRep.id) &
        (Transaction.transaction_date >= start) &
        (Transaction.transaction_date <= end) &
        (Transaction.status == 'completed')
    ).group_by(
        SalesRep.id, SalesRep.name, SalesRep.team, SalesRep.region, SalesRep.quota
    ).all()

    reps_data = []
    for row in results:
        achieved = float(row.achieved) if row.achieved else 0
        quota = float(row.quota) if row.quota else 0
        # Quotas are annual. Attainment compares the window's bookings with the
        # share of the year the window covers. Against the full annual figure a
        # 90-day window put every rep near 25%, and a 7-day one near 2%.
        period_quota = analytics.prorated(quota, start, end)
        attainment = round(achieved / period_quota * 100, 1) if period_quota > 0 else None

        reps_data.append({
            'id': row.id,
            'name': row.name,
            'team': row.team,
            'region': row.region,
            'quota': quota,
            'periodQuota': round(period_quota, 2),
            'achieved': achieved,
            'deals': row.deals or 0,
            'attainment': attainment,
        })

    # Sort by attainment descending
    reps_data.sort(key=lambda x: x['attainment'] if x['attainment'] is not None else -1, reverse=True)

    # Attainment above is measured: achieved revenue over assigned quota.
    #
    # It used to be discarded here. The block that stood in this place sorted
    # the reps, then overwrote the top six with 145/139/133/127/121/115 percent,
    # the middle six with 105 down to 85, and the rest with 82 down to 61, each
    # plus a random jitter - and then back-solved `achieved` from the invented
    # attainment so the two columns would agree. Its own comment read "Ensure we
    # show a growing organization hitting goals."
    #
    # The leaderboard now shows how the reps actually did, all of them.
    return reps_data


@bp.route('/conversion-rates')
def get_conversion_rates():
    """Stage-to-stage conversion over the 12 months to `end_date`, from stage history.

    This used to divide the number of deals currently sitting in one stage by
    the number currently sitting in the next, which measures nothing about how
    deals move.
    """
    _, end, _ = analytics.parse_window(request.args)
    return analytics.stage_conversion(analytics.load_opportunities(), end)


@bp.route('/cycle-time')
def get_cycle_time():
    """Average days deals spent in each stage, for stage exits in the 12 months to `end_date`.

    Measured from stage history. Before that history existed this endpoint
    reported expected end-to-end close time by current stage, which was the
    closest real figure the schema allowed, and before that a hardcoded
    [8, 12, 15, 7] with jitter.
    """
    _, end, _ = analytics.parse_window(request.args)
    return analytics.stage_durations(analytics.load_opportunities(), end)


@bp.route('/opportunities')
def get_opportunities():
    """Get pipeline opportunities."""
    stage = request.args.get('stage')
    limit = request.args.get('limit', 20, type=int)

    query = db.session.query(Pipeline)

    if stage:
        query = query.filter(Pipeline.stage == stage)

    results = query.order_by(
        Pipeline.amount.desc()
    ).limit(limit).all()

    return [opp.to_dict() for opp in results]


@bp.route('/deal-size-distribution')
def get_deal_size_distribution():
    """Get distribution of deals by size buckets."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date:
        start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()

    # Define size buckets
    buckets = [
        (0, 10000, '$0-10K'),
        (10000, 25000, '$10-25K'),
        (25000, 50000, '$25-50K'),
        (50000, 100000, '$50-100K'),
        (100000, 250000, '$100-250K'),
        (250000, float('inf'), '$250K+'),
    ]

    results = []
    for min_val, max_val, label in buckets:
        query = db.session.query(
            func.count(Transaction.id).label('count'),
            func.sum(Transaction.amount).label('value')
        ).filter(
            Transaction.transaction_date >= start,
            Transaction.transaction_date <= end,
            Transaction.status == 'completed',
            Transaction.amount >= min_val
        )

        if max_val != float('inf'):
            query = query.filter(Transaction.amount < max_val)

        result = query.first()

        results.append({
            'bucket': label,
            'count': result.count or 0,
            'value': float(result.value) if result.value else 0,
        })

    return results
