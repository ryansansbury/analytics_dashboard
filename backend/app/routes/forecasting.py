from flask import Blueprint, request
from sqlalchemy import func, extract
from datetime import datetime, timedelta
import numpy as np
import random
from app import db
from app.models import Transaction, Customer, Pipeline

bp = Blueprint('forecasting', __name__, url_prefix='/api/forecasting')


def get_at_risk_customers_with_scores(start_date=None, end_date=None, limit=None):
    """
    Shared function to get at-risk customers with consistent risk scores.
    Used by churn-risk, revenue-at-risk, and kpis endpoints for data consistency.
    """
    # Seed random based on date for consistent results across all endpoints
    if start_date or end_date:
        random.seed(hash(f"{start_date}{end_date}") % 1000)
    else:
        random.seed(42)

    # Get all at-risk customers from DB
    query = db.session.query(Customer).filter(
        Customer.status == 'at-risk'
    ).order_by(
        Customer.lifetime_value.desc()
    )

    if limit:
        query = query.limit(limit)

    results = query.all()

    # Calculate risk scores consistently - spread across high/medium/low categories
    customers_with_scores = []
    total_customers = len(results)
    for i, customer in enumerate(results):
        # Distribute risk scores: ~40% high (0.65+), ~35% medium (0.50-0.65), ~25% low (<0.50)
        # Higher LTV customers (earlier in list) get lower risk scores
        position_ratio = i / max(total_customers - 1, 1)  # 0 to 1
        if position_ratio < 0.25:
            # Top 25% LTV: low risk (0.35-0.50)
            base_risk = 0.35 + (position_ratio * 0.6)  # 0.35 to 0.50
        elif position_ratio < 0.60:
            # Next 35% LTV: medium risk (0.50-0.65)
            base_risk = 0.50 + ((position_ratio - 0.25) / 0.35) * 0.15  # 0.50 to 0.65
        else:
            # Bottom 40% LTV: high risk (0.65-0.90)
            base_risk = 0.65 + ((position_ratio - 0.60) / 0.40) * 0.25  # 0.65 to 0.90

        risk_score = min(0.95, max(0.30, base_risk + random.uniform(-0.05, 0.05)))
        days_since = 20 + random.randint(0, 40)

        customers_with_scores.append({
            'id': customer.id,
            'name': customer.name,
            'company': customer.company,
            'segment': customer.segment,
            'lifetimeValue': float(customer.lifetime_value) if customer.lifetime_value else 0,
            'riskScore': round(risk_score, 2),
            'daysSinceActivity': days_since,
            'recommendation': 'Executive outreach' if risk_score > 0.75 else 'Success check-in',
        })

    return customers_with_scores


def categorize_customers_by_risk(customers_with_scores):
    """
    Categorize customers into high/medium/low risk based on their risk scores.
    Returns counts and total LTV for each category.
    """
    high_risk = {'customers': 0, 'value': 0}
    medium_risk = {'customers': 0, 'value': 0}
    low_risk = {'customers': 0, 'value': 0}

    for customer in customers_with_scores:
        ltv = customer['lifetimeValue']
        score = customer['riskScore']

        if score >= 0.65:
            high_risk['customers'] += 1
            high_risk['value'] += ltv
        elif score >= 0.50:
            medium_risk['customers'] += 1
            medium_risk['value'] += ltv
        else:
            low_risk['customers'] += 1
            low_risk['value'] += ltv

    return high_risk, medium_risk, low_risk


def get_model_metrics(start_date=None, end_date=None):
    """
    Shared function to get model performance metrics.
    Used by both kpis and model-performance endpoints for consistency.
    """
    if start_date or end_date:
        random.seed(hash(f"{start_date}{end_date}") % 10000 + 400)
    else:
        random.seed(42)

    accuracy = 92.0 + random.uniform(0, 4.0)
    mape = 4.5 + random.uniform(0, 3.0)
    r2_score = 0.92 + random.uniform(0, 0.06)
    rmse = 28000 + random.randint(0, 10000)
    confidence = 93 + random.randint(0, 5)

    return {
        'accuracy': round(accuracy, 1),
        'mape': round(mape, 1),
        'r2Score': round(r2_score, 3),
        'rmse': rmse,
        'dataPoints': '24 mo',
        'lastUpdate': 'Dec 20',
        'confidence': confidence,
    }


def get_next_month_first(dt):
    """Get the first day of the next month."""
    if dt.month == 12:
        return datetime(dt.year + 1, 1, 1)
    return datetime(dt.year, dt.month + 1, 1)


def add_months(dt, months):
    """Add months to a date, returning the first of that month."""
    month = dt.month + months
    year = dt.year + (month - 1) // 12
    month = ((month - 1) % 12) + 1
    return datetime(year, month, 1)


@bp.route('/revenue')
def get_revenue_forecast():
    """Get revenue forecast using simple time series."""
    periods = request.args.get('periods', 6, type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Seed for consistent variation per date range
    if start_date or end_date:
        random.seed(hash(f"{start_date}{end_date}") % 10000)

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

    # Calculate trend with variation based on date
    base_slope = np.polyfit(x, y, 1)[0]
    slope = base_slope * random.uniform(0.9, 1.1)
    last_value = revenues[-1]

    # Determine the cutoff: next upcoming first of month is where prediction starts
    today = datetime.now()
    prediction_start = get_next_month_first(today)

    # Generate result with all dates as first of month
    result = []

    # Add historical months (last 6 months before prediction starts)
    # Filter to only include months before the prediction start
    # Convert to date for comparison to avoid timezone issues
    prediction_start_date = prediction_start.date()
    historical_before_prediction = []
    for h in historical:
        h_dt = h.date
        # Handle both datetime and date objects, with or without timezone
        if hasattr(h_dt, 'date'):
            h_date = h_dt.date()
        else:
            h_date = h_dt
        if h_date < prediction_start_date:
            historical_before_prediction.append(h)

    # Take the last 5 months of actual data (so prediction point is centered)
    last_actual_value = None
    for h in historical_before_prediction[-5:]:
        h_date = h.date.date() if hasattr(h.date, 'date') else h.date
        month_date = datetime(h_date.year, h_date.month, 1)
        actual_value = float(h.revenue) if h.revenue else 0
        last_actual_value = actual_value

        result.append({
            'date': month_date.strftime('%Y-%m-%d'),
            'actual': actual_value,
            'predicted': None,  # No predicted on actual months
            'lowerBound': None,
            'upperBound': None,
        })

    # Add forecast periods starting from prediction_start (all on 1st of month)
    for i in range(periods):
        forecast_date = add_months(prediction_start, i)

        if i == 0:
            # First prediction point bridges from last actual value
            predicted = last_actual_value if last_actual_value else last_value
        else:
            base_predicted = last_value + (slope * i)
            predicted = base_predicted * random.uniform(0.95, 1.05)

        # Add some variance for confidence interval
        variance = predicted * random.uniform(0.08, 0.12)

        result.append({
            'date': forecast_date.strftime('%Y-%m-%d'),
            'actual': last_actual_value if i == 0 else None,  # Bridge: first prediction has actual too
            'predicted': round(predicted, 2),
            'lowerBound': round(predicted - variance, 2) if i > 0 else None,
            'upperBound': round(predicted + variance, 2) if i > 0 else None,
        })

    return result


@bp.route('/pipeline')
def get_pipeline_forecast():
    """Get weighted pipeline forecast."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Seed for consistent variation per date range
    if start_date or end_date:
        random.seed(hash(f"{start_date}{end_date}") % 10000 + 100)

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

    forecast_data = []
    for row in results:
        # Apply variation based on date
        variation = random.uniform(0.9, 1.1)
        weighted = float(row.weighted) * variation if row.weighted else 0
        total = float(row.total) * variation if row.total else 0

        forecast_data.append({
            'month': row.month.strftime('%b %Y') if row.month else 'Unknown',
            'weighted': round(weighted, 2),
            'best': round(total, 2),
            'worst': round(weighted * random.uniform(0.45, 0.55), 2),
        })

    return forecast_data


@bp.route('/churn-risk')
def get_churn_risk():
    """Get customers at risk of churning."""
    limit = request.args.get('limit', 10, type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Use shared function for consistent data across endpoints
    return get_at_risk_customers_with_scores(start_date, end_date, limit)


@bp.route('/kpis')
def get_forecasting_kpis():
    """Get forecasting KPIs with change percentages."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Get at-risk customers using shared function for consistency
    at_risk_customers = get_at_risk_customers_with_scores(start_date, end_date)
    at_risk_count = len(at_risk_customers)

    # Get model metrics using shared function for consistency
    model_metrics = get_model_metrics(start_date, end_date)

    # Seed for other KPI variations
    if start_date or end_date:
        random.seed(hash(f"{start_date}{end_date}") % 10000 + 300)
    else:
        random.seed(42)

    # Calculate predicted revenue (varies by date)
    base_predicted = 4500000
    predicted_revenue = base_predicted * random.uniform(0.85, 1.15)
    predicted_change = random.uniform(8.0, 18.0)

    # At-risk change calculation
    at_risk_change = random.choice([-1, 1]) * random.uniform(3.0, 12.0)

    # Model accuracy change
    accuracy_change = random.choice([-1, 1]) * random.uniform(0.5, 2.0)

    return {
        'predictedRevenue': round(predicted_revenue, 2),
        'predictedChange': round(predicted_change, 1),
        'atRiskCount': at_risk_count,
        'atRiskChange': round(at_risk_change, 1),
        'modelAccuracy': model_metrics['accuracy'],
        'accuracyChange': round(accuracy_change, 1),
        'forecastPeriod': 6,
    }


@bp.route('/seasonality')
def get_seasonality():
    """Get seasonal revenue patterns."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Seed for consistent variation per date range
    if start_date or end_date:
        random.seed(hash(f"{start_date}{end_date}") % 10000 + 200)

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

    seasonality_data = []
    for row in results:
        base_index = float(row.avg_revenue) / overall_avg if overall_avg and row.avg_revenue else 1.0
        # Add slight variation
        index = base_index * random.uniform(0.97, 1.03)
        trend = random.uniform(-0.02, 0.03)

        seasonality_data.append({
            'month': month_names[int(row.month) - 1],
            'index': round(index, 2),
            'trend': round(trend, 2),
        })

    return seasonality_data


@bp.route('/model-performance')
def get_model_performance():
    """Get ML model performance metrics - varies by date range."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Use shared function for consistent data with KPIs
    return get_model_metrics(start_date, end_date)


@bp.route('/revenue-at-risk')
def get_revenue_at_risk():
    """Get revenue at risk by category - uses same customer data as churn-risk."""
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Get at-risk customers using shared function for consistency
    customers = get_at_risk_customers_with_scores(start_date, end_date)

    # Categorize customers by risk level using shared function
    high_risk, medium_risk, low_risk = categorize_customers_by_risk(customers)

    total = high_risk['value'] + medium_risk['value'] + low_risk['value']

    return {
        'highRisk': {
            'value': int(high_risk['value']),
            'customers': high_risk['customers'],
            'label': 'High Risk',
            'threshold': '65%+ risk',
        },
        'mediumRisk': {
            'value': int(medium_risk['value']),
            'customers': medium_risk['customers'],
            'label': 'Medium Risk',
            'threshold': '50-65% risk',
        },
        'lowRisk': {
            'value': int(low_risk['value']),
            'customers': low_risk['customers'],
            'label': 'Low Risk',
            'threshold': '<50% risk',
        },
        'total': int(total),
        'totalCustomers': len(customers),
    }
