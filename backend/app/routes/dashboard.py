from flask import Blueprint, request
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from app import db
from app.models import Transaction, Customer, Pipeline, Product

bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


@bp.route('/summary')
def get_summary():
    """Get executive dashboard summary."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    if not start_date:
        start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
    if not end_date:
        end_date = datetime.now().strftime('%Y-%m-%d')

    start = datetime.strptime(start_date, '%Y-%m-%d').date()
    end = datetime.strptime(end_date, '%Y-%m-%d').date()

    # Calculate date range for previous period
    period_days = (end - start).days
    prev_start = start - timedelta(days=period_days)
    prev_end = start - timedelta(days=1)

    # Current period metrics
    current_revenue = db.session.query(
        func.sum(Transaction.amount)
    ).filter(
        Transaction.transaction_date.between(start, end),
        Transaction.status == 'completed'
    ).scalar() or 0

    current_customers = db.session.query(
        func.count(func.distinct(Transaction.customer_id))
    ).filter(
        Transaction.transaction_date.between(start, end)
    ).scalar() or 0

    current_orders = db.session.query(
        func.count(Transaction.id)
    ).filter(
        Transaction.transaction_date.between(start, end),
        Transaction.status == 'completed'
    ).scalar() or 0

    # Previous period metrics
    prev_revenue = db.session.query(
        func.sum(Transaction.amount)
    ).filter(
        Transaction.transaction_date.between(prev_start, prev_end),
        Transaction.status == 'completed'
    ).scalar() or 0

    prev_customers = db.session.query(
        func.count(func.distinct(Transaction.customer_id))
    ).filter(
        Transaction.transaction_date.between(prev_start, prev_end)
    ).scalar() or 0

    # Pipeline value
    pipeline_value = db.session.query(
        func.sum(Pipeline.amount)
    ).filter(
        Pipeline.stage.notin_(['closed-won', 'closed-lost'])
    ).scalar() or 0

    # Calculate changes
    revenue_change = ((float(current_revenue) - float(prev_revenue)) / float(prev_revenue) * 100) if prev_revenue else 0
    customer_change = ((current_customers - prev_customers) / prev_customers * 100) if prev_customers else 0
    avg_order_value = float(current_revenue) / current_orders if current_orders else 0

    return {
        'kpis': {
            'totalRevenue': {
                'value': float(current_revenue),
                'previousValue': float(prev_revenue),
                'change': float(current_revenue) - float(prev_revenue),
                'changePercent': round(revenue_change, 1),
            },
            'totalCustomers': {
                'value': current_customers,
                'previousValue': prev_customers,
                'change': current_customers - prev_customers,
                'changePercent': round(customer_change, 1),
            },
            'avgOrderValue': {
                'value': round(avg_order_value, 2),
                'changePercent': 0,
            },
            'pipelineValue': {
                'value': float(pipeline_value),
                'changePercent': 0,
            },
        },
        'dateRange': {
            'startDate': start_date,
            'endDate': end_date,
        }
    }


@bp.route('/kpis')
def get_kpis():
    """Get top-level KPIs."""
    return get_summary()
