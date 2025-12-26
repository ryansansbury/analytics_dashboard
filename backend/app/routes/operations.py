from flask import Blueprint, request
from sqlalchemy import func
from datetime import datetime, timedelta
from app import db
from app.models import Pipeline, SalesRep, Transaction

bp = Blueprint('operations', __name__, url_prefix='/api/operations')


@bp.route('/pipeline')
def get_pipeline():
    """Get pipeline by stage."""
    stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed-won']

    results = []
    prev_count = None

    for stage in stages:
        stage_data = db.session.query(
            func.sum(Pipeline.amount).label('value'),
            func.count(Pipeline.id).label('count')
        ).filter(
            Pipeline.stage == stage
        ).first()

        value = float(stage_data.value) if stage_data.value else 0
        count = stage_data.count or 0

        conversion_rate = 100
        if prev_count and prev_count > 0:
            conversion_rate = round((count / prev_count) * 100, 1)

        results.append({
            'stage': stage.replace('-', ' ').title(),
            'value': value,
            'count': count,
            'conversionRate': conversion_rate,
        })

        prev_count = count

    return results


@bp.route('/sales-performance')
def get_sales_performance():
    """Get sales rep performance vs quota (YTD for proper quota comparison)."""
    # Calculate YTD date range for proper quota comparison
    today = datetime.now().date()
    year_start = datetime(today.year, 1, 1).date()

    # Calculate what fraction of the year has passed for pro-rated quota
    days_in_year = 366 if today.year % 4 == 0 else 365
    days_elapsed = (today - year_start).days + 1
    year_fraction = days_elapsed / days_in_year

    # Get all sales reps with their YTD achieved revenue
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
        (Transaction.transaction_date >= year_start) &
        (Transaction.transaction_date <= today) &
        (Transaction.status == 'completed')
    ).group_by(
        SalesRep.id, SalesRep.name, SalesRep.team, SalesRep.region, SalesRep.quota
    ).all()

    reps_data = []
    for row in results:
        achieved = float(row.achieved) if row.achieved else 0
        quota = float(row.quota) if row.quota else 0
        # Pro-rate quota based on time elapsed in year
        prorated_quota = quota * year_fraction
        # Calculate attainment against pro-rated quota
        attainment = round((achieved / prorated_quota * 100), 1) if prorated_quota > 0 else 0

        reps_data.append({
            'id': row.id,
            'name': row.name,
            'team': row.team,
            'region': row.region,
            'quota': quota,
            'achieved': achieved,
            'deals': row.deals or 0,
            'attainment': attainment,
        })

    # Sort by attainment descending
    reps_data.sort(key=lambda x: x['attainment'], reverse=True)
    return reps_data


@bp.route('/conversion-rates')
def get_conversion_rates():
    """Get stage-to-stage conversion rates."""
    stages = ['lead', 'qualified', 'proposal', 'negotiation', 'closed-won']

    results = []
    counts = {}

    # Get counts for each stage
    for stage in stages:
        count = db.session.query(
            func.count(Pipeline.id)
        ).filter(
            Pipeline.stage == stage
        ).scalar() or 0
        counts[stage] = count

    # Calculate conversion rates
    for i in range(len(stages) - 1):
        from_stage = stages[i]
        to_stage = stages[i + 1]

        rate = 0
        if counts[from_stage] > 0:
            rate = round((counts[to_stage] / counts[from_stage]) * 100, 1)

        results.append({
            'fromStage': f"{from_stage.title()} → {to_stage.title()}",
            'rate': rate,
        })

    return results


@bp.route('/cycle-time')
def get_cycle_time():
    """Get average deal cycle time by stage."""
    # In a real implementation, you'd track timestamps for stage transitions
    # For now, return estimated cycle times
    return [
        {'stage': 'Lead to Qualified', 'avgDays': 8},
        {'stage': 'Qualified to Proposal', 'avgDays': 12},
        {'stage': 'Proposal to Negotiation', 'avgDays': 15},
        {'stage': 'Negotiation to Close', 'avgDays': 7},
    ]


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
