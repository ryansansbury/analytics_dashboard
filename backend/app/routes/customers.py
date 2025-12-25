from flask import Blueprint, request
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from app import db
from app.models import Customer, Transaction

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

    total = db.session.query(func.count(Customer.id)).scalar() or 0

    new_customers = db.session.query(
        func.count(Customer.id)
    ).filter(
        Customer.acquisition_date.between(start, end)
    ).scalar() or 0

    churned = db.session.query(
        func.count(Customer.id)
    ).filter(
        Customer.status == 'churned'
    ).scalar() or 0

    at_risk = db.session.query(
        func.count(Customer.id)
    ).filter(
        Customer.status == 'at-risk'
    ).scalar() or 0

    return {
        'total': total,
        'new': new_customers,
        'churned': churned,
        'atRisk': at_risk,
    }


@bp.route('/segments')
def get_segments():
    """Get customer breakdown by segment."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    results = db.session.query(
        Customer.segment,
        func.count(Customer.id).label('count'),
        func.sum(Customer.lifetime_value).label('revenue')
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
    """Get cohort retention analysis."""
    # Get customers grouped by acquisition month
    cohorts = db.session.query(
        func.date_trunc('month', Customer.acquisition_date).label('cohort'),
        func.count(Customer.id).label('initial_count')
    ).filter(
        Customer.acquisition_date.isnot(None)
    ).group_by(
        func.date_trunc('month', Customer.acquisition_date)
    ).order_by(
        func.date_trunc('month', Customer.acquisition_date).desc()
    ).limit(12).all()

    # For simplicity, return mock retention rates
    # In production, you'd calculate actual retention per month
    result = []
    for cohort in cohorts:
        cohort_date = cohort.cohort
        if cohort_date:
            retention = {
                'cohort': cohort_date.strftime('%b %Y'),
                'month0': 100,
                'month1': 92,
                'month2': 88,
                'month3': 85,
                'month4': 82,
                'month5': 80,
                'month6': 78,
            }
            result.append(retention)

    return result


@bp.route('/lifetime-value')
def get_lifetime_value():
    """Get lifetime value distribution."""
    # Define LTV ranges
    ranges = [
        (0, 1000, '$0 - $1K'),
        (1000, 5000, '$1K - $5K'),
        (5000, 10000, '$5K - $10K'),
        (10000, 50000, '$10K - $50K'),
        (50000, 100000, '$50K - $100K'),
        (100000, float('inf'), '$100K+'),
    ]

    results = []
    total = db.session.query(func.count(Customer.id)).scalar() or 1

    for min_val, max_val, label in ranges:
        if max_val == float('inf'):
            count = db.session.query(
                func.count(Customer.id)
            ).filter(
                Customer.lifetime_value >= min_val
            ).scalar() or 0
        else:
            count = db.session.query(
                func.count(Customer.id)
            ).filter(
                Customer.lifetime_value >= min_val,
                Customer.lifetime_value < max_val
            ).scalar() or 0

        results.append({
            'range': label,
            'count': count,
            'percentage': round((count / total * 100), 1),
        })

    return results


@bp.route('/acquisition')
def get_acquisition():
    """Get customer acquisition by channel over time."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date:
        start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()

    results = db.session.query(
        func.date_trunc('month', Customer.acquisition_date).label('date'),
        Customer.acquisition_channel,
        func.count(Customer.id).label('count')
    ).filter(
        Customer.acquisition_date.between(start, end)
    ).group_by(
        func.date_trunc('month', Customer.acquisition_date),
        Customer.acquisition_channel
    ).order_by(
        func.date_trunc('month', Customer.acquisition_date)
    ).all()

    return [
        {
            'date': row.date.strftime('%Y-%m-%d') if row.date else None,
            'channel': row.acquisition_channel or 'Other',
            'count': row.count,
        }
        for row in results
    ]


@bp.route('/at-risk')
def get_at_risk():
    """Get at-risk customers."""
    limit = request.args.get('limit', 10, type=int)

    results = db.session.query(Customer).filter(
        Customer.status == 'at-risk'
    ).order_by(
        Customer.lifetime_value.desc()
    ).limit(limit).all()

    return [customer.to_dict() for customer in results]
