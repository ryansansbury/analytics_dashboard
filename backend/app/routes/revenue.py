from flask import Blueprint, request
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from app import db
from app.models import Transaction, Product

bp = Blueprint('revenue', __name__, url_prefix='/api/revenue')


@bp.route('/trends')
def get_trends():
    """Get revenue trends over time."""
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

    return [
        {
            'date': row.date.strftime('%Y-%m-%d') if hasattr(row.date, 'strftime') else str(row.date),
            'revenue': float(row.revenue) if row.revenue else 0,
            'orders': row.orders,
        }
        for row in results
    ]


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
            'growth': 0,  # Would need historical data
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
            'growth': 0,  # Would need historical data
            'avgPrice': float(row.revenue) / row.units if row.units else 0,
        }
        for row in results
    ]
