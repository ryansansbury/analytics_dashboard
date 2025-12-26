from flask import Blueprint, request
from sqlalchemy import func
from datetime import datetime, timedelta
import numpy as np
from app import db
from app.models import Transaction, Customer, Pipeline

bp = Blueprint('forecasting', __name__, url_prefix='/api/forecasting')


@bp.route('/revenue')
def get_revenue_forecast():
    """Get revenue forecast using simple time series."""
    periods = request.args.get('periods', 6, type=int)

    # Get historical monthly revenue
    historical = db.session.query(
        func.date_trunc('month', Transaction.transaction_date).label('date'),
        func.sum(Transaction.amount).label('revenue')
    ).filter(
        Transaction.status == 'completed'
    ).group_by(
        func.date_trunc('month', Transaction.transaction_date)
    ).order_by(
        func.date_trunc('month', Transaction.transaction_date)
    ).all()

    # Convert to arrays for forecasting
    revenues = [float(h.revenue) for h in historical if h.revenue]

    if len(revenues) < 3:
        # Not enough data, return empty forecast
        return []

    # Simple linear regression forecast
    x = np.arange(len(revenues))
    y = np.array(revenues)

    # Calculate trend
    slope = np.polyfit(x, y, 1)[0]
    last_value = revenues[-1]

    # Generate forecast
    result = []
    last_date = historical[-1].date if historical else datetime.now()

    # Add last few months of actual data
    for i, h in enumerate(historical[-6:]):
        is_last = (i == len(historical[-6:]) - 1)
        actual_value = float(h.revenue) if h.revenue else 0
        result.append({
            'date': h.date.strftime('%Y-%m-%d'),
            'actual': actual_value,
            # Bridge point: last actual also has predicted value to connect the lines
            'predicted': actual_value if is_last else None,
            'lowerBound': None,
            'upperBound': None,
        })

    # Add forecast periods
    for i in range(1, periods + 1):
        forecast_date = last_date + timedelta(days=30 * i)
        predicted = last_value + (slope * i)

        # Add some variance for confidence interval
        variance = predicted * 0.1

        result.append({
            'date': forecast_date.strftime('%Y-%m-%d'),
            'actual': None,
            'predicted': round(predicted, 2),
            'lowerBound': round(predicted - variance, 2),
            'upperBound': round(predicted + variance, 2),
        })

    return result


@bp.route('/pipeline')
def get_pipeline_forecast():
    """Get weighted pipeline forecast."""
    # Get pipeline by expected close month
    results = db.session.query(
        func.date_trunc('month', Pipeline.expected_close_date).label('month'),
        func.sum(Pipeline.amount).label('total'),
        func.sum(Pipeline.amount * Pipeline.probability / 100).label('weighted')
    ).filter(
        Pipeline.stage.notin_(['closed-won', 'closed-lost']),
        Pipeline.expected_close_date >= datetime.now().date()
    ).group_by(
        func.date_trunc('month', Pipeline.expected_close_date)
    ).order_by(
        func.date_trunc('month', Pipeline.expected_close_date)
    ).limit(6).all()

    return [
        {
            'month': row.month.strftime('%b %Y') if row.month else 'Unknown',
            'weighted': round(float(row.weighted), 2) if row.weighted else 0,
            'best': round(float(row.total), 2) if row.total else 0,
            'worst': round(float(row.weighted) * 0.5, 2) if row.weighted else 0,
        }
        for row in results
    ]


@bp.route('/churn-risk')
def get_churn_risk():
    """Get customers at risk of churning."""
    limit = request.args.get('limit', 10, type=int)

    # Get at-risk customers
    results = db.session.query(Customer).filter(
        Customer.status == 'at-risk'
    ).order_by(
        Customer.lifetime_value.desc()
    ).limit(limit).all()

    # Calculate risk scores based on available data
    churn_data = []
    for customer in results:
        # Simple risk score calculation
        risk_score = 0.7  # Base risk for at-risk customers

        churn_data.append({
            'id': customer.id,
            'name': customer.name,
            'company': customer.company,
            'segment': customer.segment,
            'lifetimeValue': float(customer.lifetime_value) if customer.lifetime_value else 0,
            'riskScore': round(risk_score, 2),
            'daysSinceActivity': 30,  # Would calculate from actual activity
            'recommendation': 'Executive outreach' if risk_score > 0.7 else 'Success check-in',
        })

    return churn_data


@bp.route('/seasonality')
def get_seasonality():
    """Get seasonal revenue patterns."""
    # Get monthly averages by month of year
    results = db.session.query(
        extract('month', Transaction.transaction_date).label('month'),
        func.avg(Transaction.amount).label('avg_revenue')
    ).filter(
        Transaction.status == 'completed'
    ).group_by(
        extract('month', Transaction.transaction_date)
    ).order_by(
        extract('month', Transaction.transaction_date)
    ).all()

    if not results:
        return []

    # Calculate overall average
    overall_avg = sum(float(r.avg_revenue) for r in results if r.avg_revenue) / len(results)

    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    return [
        {
            'month': month_names[int(row.month) - 1],
            'index': round(float(row.avg_revenue) / overall_avg, 2) if overall_avg and row.avg_revenue else 1.0,
            'trend': 0,
        }
        for row in results
    ]
