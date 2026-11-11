from flask import Blueprint, request
from datetime import datetime
import pandas as pd
from app import analytics, db
from app.models import Transaction, Customer, Pipeline
from app import ml
from app.ml.features import CHURN_HORIZON_DAYS, customer_frame, live_customers

bp = Blueprint('forecasting', __name__, url_prefix='/api/forecasting')


def get_at_risk_customers_with_scores(start_date=None, end_date=None, limit=None):
    """Score currently-retained customers with the trained churn classifier.

    `riskScore` is a calibrated predicted probability from the model, and
    `daysSinceActivity` is the real recency computed from transaction history.
    Both were previously derived from a customer's rank by lifetime value plus
    `random.uniform()` noise, which meant the dashboard's headline risk numbers
    were not connected to anything.

    Churned accounts are excluded. The question this answers is which live
    customers are about to leave, not which already have.

    Returns an empty list when no model is available. Callers report that
    honestly rather than substituting a heuristic.
    """
    model = ml.get_churn_model()
    if model is None:
        return []

    # Live customers only, the population the model was trained on: not
    # marked churned, and with an order in the last six months.
    frame = live_customers(customer_frame()).copy()
    if frame.empty:
        return []

    frame['risk_score'] = model.predict_proba(frame)

    lookup = {
        c.id: c
        for c in db.session.query(Customer).filter(
            Customer.id.in_(frame['customer_id'].tolist())
        ).all()
    }

    frame = frame.sort_values('risk_score', ascending=False)
    if limit:
        frame = frame.head(limit)

    # What each customer spent in the last year, which is what leaving would
    # cost. Lifetime value is what they already spent.
    annual = analytics.trailing_revenue()

    scored = []
    for row in frame.itertuples():
        customer = lookup.get(row.customer_id)
        if customer is None:
            continue
        risk = float(row.risk_score)
        scored.append({
            'id': customer.id,
            'name': customer.name,
            'company': customer.company,
            'segment': customer.segment,
            'lifetimeValue': float(customer.lifetime_value) if customer.lifetime_value else 0,
            'annualRevenue': annual.get(customer.id, 0.0),
            'riskScore': round(risk, 2),
            'daysSinceActivity': int(row.recency_days),
            'recommendation': 'Executive outreach' if risk > 0.75 else 'Success check-in',
        })

    return scored


def categorize_customers_by_risk(customers_with_scores):
    """
    Categorize customers into high/medium/low risk based on their risk scores.
    Returns counts and total LTV for each category.
    """
    high_risk = {'customers': 0, 'value': 0}
    medium_risk = {'customers': 0, 'value': 0}
    low_risk = {'customers': 0, 'value': 0}

    for customer in customers_with_scores:
        ltv = customer.get('annualRevenue', customer['lifetimeValue'])
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
    """Real holdout metrics for both models.

    Every figure here is measured by scikit-learn on data the model never
    trained on. The date-range arguments are accepted for API compatibility and
    deliberately ignored: model performance is a property of the fit, not of
    whatever window the user is currently looking at. Varying it by filter would
    be theatre.

    Returns `available: False` when a model could not be trained, because the
    honest answer to "how good is the model" is sometimes "there isn't one."
    """
    forecast = ml.get_revenue_forecast()
    churn_model = ml.get_churn_model()

    if forecast is None and churn_model is None:
        return {
            'available': False,
            'reason': ml.get_revenue_error() or ml.get_churn_error() or 'models unavailable',
        }

    payload = {'available': True}

    if forecast is not None:
        m = forecast.metrics
        payload['revenue'] = {
            'mape': m.mape,
            'rmse': m.rmse,
            'mae': m.mae,
            'r2Score': m.r2,
            'naiveMape': m.naive_mape,
            'seasonalNaiveMape': m.seasonal_naive_mape,
            'improvementOverNaive': m.improvement_over_naive,
            'trainMonths': m.n_train,
            'holdoutMonths': m.n_test,
            'model': 'Ridge regression on trend, seasonality, quarter-end, and 2 lags',
            'validation': 'chronological holdout',
        }
        # Back-compat keys the existing UI reads. Sourced from the real fit.
        payload['mape'] = m.mape
        payload['rmse'] = m.rmse
        payload['r2Score'] = m.r2
        payload['dataPoints'] = f'{m.n_train + m.n_test} mo'

    if churn_model is not None:
        c = churn_model.metrics
        payload['churn'] = {
            'rocAuc': c.roc_auc,
            'averagePrecision': c.average_precision,
            'accuracy': c.accuracy,
            'precision': c.precision,
            'recall': c.recall,
            'f1': c.f1,
            'brierScore': c.brier,
            'baseRate': c.positive_rate,
            'trainRows': c.n_train,
            'holdoutRows': c.n_test,
            'topFeatures': c.feature_importance,
            'model': 'Gradient-boosted classifier on RFM and account features',
            'label': f'no completed order in the {CHURN_HORIZON_DAYS} days after the cutoff',
            'horizonDays': CHURN_HORIZON_DAYS,
            'cutoff': c.cutoff,
            'validation': 'stratified holdout',
        }
        payload['accuracy'] = round(c.accuracy * 100, 1)

    return payload


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


#: Two-sided normal quantiles for the 80% and 95% intervals.
Z80 = 1.2816
Z95 = 1.9600


@bp.route('/revenue')
def get_revenue_forecast():
    """Monthly revenue forecast from the trained model.

    Predictions come from `app.ml.revenue`, a ridge regression on trend,
    cyclical seasonality, a quarter-end flag, and two autoregressive lags, fit on complete months
    only. Confidence bounds are derived from the model's own holdout RMSE and
    widen with the square root of the horizon, which is the standard way an
    interval grows as you forecast further out.

    Previously the slope was multiplied by `random.uniform(0.9, 1.1)`, each
    predicted point by `random.uniform(0.95, 1.05)`, and the interval width was
    `random.uniform(0.08, 0.12)` of the value. None of that described
    uncertainty; it was decoration.
    """
    periods = request.args.get('periods', 6, type=int)
    periods = max(1, min(periods, 24))
    start_date = request.args.get('start_date')

    forecast = ml.get_revenue_forecast(horizon=periods)
    if forecast is None:
        return []

    history = forecast.history
    rmse = forecast.metrics.rmse

    # Clip the *displayed* history to the selected window.
    #
    # The model still trains on every month available, which is correct and
    # must not change: throwing away history to match a UI filter would make
    # the forecast worse. Only the plotted actuals are scoped.
    #
    # Without this the card always showed a fixed eight-month tail regardless of
    # the filter, so selecting Year to Date put December of the previous year on
    # a chart the user had just scoped to January onward.
    if start_date:
        try:
            cutoff = pd.Period(start_date, freq='M')
            clipped = history[history['period'] >= cutoff]
            # Keep at least two points so the line has something to draw.
            history = clipped if len(clipped) >= 2 else history.tail(2)
        except Exception:  # noqa: BLE001 - a malformed filter must not 500
            pass

    result = []

    # Actuals: solid line.
    tail = history.tail(12)
    rows = list(tail.itertuples())
    for row in rows:
        result.append({
            'date': row.period.start_time.strftime('%Y-%m-%d'),
            'actual': round(float(row.revenue), 2),
            'predicted': None,
            'lowerBound': None,
            'upperBound': None,
        })

    # The join. The last actual month carries the predicted value too, set to
    # the actual, so the dashed line begins exactly where the solid one ends
    # instead of starting somewhere above or below it.
    #
    # It also carries a zero-width band, both bounds equal to the value. The
    # bounds were null here on the reasoning that a measurement has no
    # uncertainty to draw, and that is true of the number but wrong for the
    # chart: the band then began one month after the dashed line did, leaving
    # the first forecast segment with no interval around it and a visible step
    # where the shading started. Uncertainty at the last observed point is
    # genuinely zero, so anchoring the band there is the honest shape. It opens
    # from a point at the join and widens with the horizon.
    if rows:
        anchor = round(float(rows[-1].revenue), 2)
        result[-1]['predicted'] = anchor
        result[-1]['lowerBound'] = anchor
        result[-1]['upperBound'] = anchor

    if rows:
        result[-1]['lower95'] = anchor
        result[-1]['upper95'] = anchor

    # The backtest: what the model predicted for the holdout months when it had
    # never seen them, drawn over the actuals so the fit is visible rather than
    # taken on faith from a MAPE figure.
    backtest = {row.period: float(row.revenue) for row in forecast.backtest.itertuples()}
    for point, row in zip(result, rows):
        value = backtest.get(row.period)
        point['backtest'] = round(value, 2) if value is not None else None

    # Forecast: dashed continuation. Two intervals, 80% and 95%, from the
    # holdout error treated as normal, each widening with the square root of
    # the horizon, which is how forecast uncertainty compounds.
    for step, row in enumerate(forecast.predictions.itertuples(), start=1):
        predicted = float(row.revenue)
        spread = rmse * (step ** 0.5)
        result.append({
            'date': row.period.start_time.strftime('%Y-%m-%d'),
            'actual': None,
            'predicted': round(predicted, 2),
            'lowerBound': round(max(predicted - Z80 * spread, 0.0), 2),
            'upperBound': round(predicted + Z80 * spread, 2),
            'lower95': round(max(predicted - Z95 * spread, 0.0), 2),
            'upper95': round(predicted + Z95 * spread, 2),
            'backtest': None,
        })

    for point in result:
        point.setdefault('lower95', None)
        point.setdefault('upper95', None)
        point.setdefault('backtest', None)
    return result


@bp.route('/pipeline')
def get_pipeline_forecast():
    """Weighted pipeline forecast by expected close month.

    The three numbers are the standard sales-forecast trio and each has a
    definition rather than a multiplier:

    - `best`     every open opportunity closes at full value
    - `weighted` sum of amount x probability, the expected value
    - `worst`    commit only, meaning opportunities already at negotiation or
                 later, still probability-weighted

    Previously every figure was scaled by `random.uniform(0.9, 1.1)` and the
    worst case was the weighted number times `random.uniform(0.45, 0.55)`, so
    the "conservative" line was a coin flip rather than a commit.
    """
    # Grouped in Python rather than with date_trunc so the endpoint works on
    # SQLite as well as Postgres, which is what lets it be tested.
    rows = db.session.query(
        Pipeline.expected_close_date,
        Pipeline.amount,
        Pipeline.probability,
        Pipeline.stage,
    ).filter(
        Pipeline.stage.notin_(['closed-won', 'closed-lost']),
        Pipeline.expected_close_date >= datetime.now().date(),
    ).all()

    COMMIT_STAGES = {'negotiation'}

    buckets = {}
    for row in rows:
        if row.expected_close_date is None or row.amount is None:
            continue
        key = (row.expected_close_date.year, row.expected_close_date.month)
        bucket = buckets.setdefault(key, {'best': 0.0, 'weighted': 0.0, 'worst': 0.0})
        amount = float(row.amount)
        probability = (row.probability or 0) / 100.0
        bucket['best'] += amount
        bucket['weighted'] += amount * probability
        if row.stage in COMMIT_STAGES:
            bucket['worst'] += amount * probability

    forecast_data = []
    for (year, month) in sorted(buckets)[:6]:
        bucket = buckets[(year, month)]
        forecast_data.append({
            'month': datetime(year, month, 1).strftime('%b %Y'),
            'weighted': round(bucket['weighted'], 2),
            'best': round(bucket['best'], 2),
            'worst': round(bucket['worst'], 2),
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
    """Headline forecasting KPIs.

    `predictedRevenue` is next month from the trained forecaster and
    `predictedChange` is its real percentage change against the last complete
    month. Both used to be a hardcoded 4,500,000 multiplied by
    `random.uniform(0.85, 1.15)` and a random 8-18% respectively.

    `atRiskChange` and `accuracyChange` are **null on purpose**. A delta needs a
    prior observation to compare against, and this application stores no
    historical snapshots of either the at-risk count or model performance.
    They were previously `random.choice([-1, 1]) * random.uniform(...)`, which
    invented both the direction and the magnitude. Returning null lets the UI
    omit the arrow rather than draw a fictional one.
    """
    # At or above the risk threshold, the same count the Customers page shows.
    # This was the length of the whole scored list, every live customer.
    at_risk_count = analytics.at_risk_count(get_at_risk_customers_with_scores())

    model_metrics = get_model_metrics()

    predicted_revenue = None
    predicted_change = None
    predicted_month = None
    forecast = ml.get_revenue_forecast()
    if forecast is not None and not forecast.predictions.empty:
        predicted_revenue = round(float(forecast.predictions['revenue'].iloc[0]), 2)
        predicted_month = forecast.predictions['period'].iloc[0].start_time.strftime('%Y-%m-%d')
        last_actual = float(forecast.history['revenue'].iloc[-1])
        if last_actual:
            predicted_change = round((predicted_revenue - last_actual) / last_actual * 100, 1)

    return {
        'predictedRevenue': predicted_revenue,
        'predictedChange': predicted_change,
        'predictedMonth': predicted_month,
        'atRiskCount': at_risk_count,
        'atRiskThreshold': analytics.RISK_THRESHOLD,
        # No historical snapshot exists to difference against. See docstring.
        'atRiskChange': None,
        'modelAccuracy': model_metrics.get('accuracy'),
        'accuracyChange': None,
        'forecastPeriod': 6,
    }


@bp.route('/seasonality')
def get_seasonality():
    """Seasonal revenue index by calendar month, with a real year-over-year trend.

    Two things were wrong here. The index was a genuine ratio multiplied by
    `random.uniform(0.97, 1.03)`, and `trend` was `random.uniform(-0.02, 0.03)`
    with no input at all.

    The index is now total completed revenue for each calendar month divided by
    the average month, which is what a seasonality index means. Averaging
    transaction *size* was the previous basis and it barely moves, because
    seasonality shows up in how many deals close rather than how big they are.

    `trend` compares the most recent year's share for that month against the
    prior year's. It is null for months without two years of history, since
    there is nothing to compare.
    """
    rows = db.session.query(
        Transaction.transaction_date,
        Transaction.amount,
    ).filter(Transaction.status == 'completed').all()

    if not rows:
        return []

    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    # revenue[month] across all years, and per (year, month) for the trend.
    by_month = {m: 0.0 for m in range(1, 13)}
    by_year_month = {}
    for row in rows:
        if row.transaction_date is None or row.amount is None:
            continue
        month = row.transaction_date.month
        year = row.transaction_date.year
        amount = float(row.amount)
        by_month[month] += amount
        by_year_month[(year, month)] = by_year_month.get((year, month), 0.0) + amount

    observed = {m: v for m, v in by_month.items() if v > 0}
    if not observed:
        return []
    overall_avg = sum(observed.values()) / len(observed)

    # Year totals let the trend compare shares rather than raw amounts, so a
    # growing business does not read as every month trending up.
    year_totals = {}
    for (year, month), value in by_year_month.items():
        year_totals[year] = year_totals.get(year, 0.0) + value
    years = sorted(year_totals)

    seasonality_data = []
    for month in sorted(observed):
        index = observed[month] / overall_avg if overall_avg else 1.0

        trend = None
        if len(years) >= 2:
            recent, prior = years[-1], years[-2]
            recent_total, prior_total = year_totals.get(recent), year_totals.get(prior)
            recent_share = (
                by_year_month.get((recent, month), 0.0) / recent_total
                if recent_total else None
            )
            prior_share = (
                by_year_month.get((prior, month), 0.0) / prior_total
                if prior_total else None
            )
            if recent_share is not None and prior_share:
                trend = round(recent_share - prior_share, 4)

        seasonality_data.append({
            'month': month_names[month - 1],
            'index': round(index, 2),
            'trend': trend,
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
    """Last year's revenue from customers in each churn-risk tier.

    `total` is the high and medium tiers together, the revenue actually at
    risk. It used to add the low tier too, so the headline counted nearly every
    customer's spend as at risk. Values are each customer's completed revenue
    over the last year, which is what losing them would cost. Lifetime value,
    the old basis, is what they have already paid.
    """
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    customers = get_at_risk_customers_with_scores(start_date, end_date)
    high_risk, medium_risk, low_risk = categorize_customers_by_risk(customers)

    return {
        'highRisk': {
            'value': int(high_risk['value']),
            'customers': high_risk['customers'],
            'label': 'High risk',
            'threshold': '65% or higher',
        },
        'mediumRisk': {
            'value': int(medium_risk['value']),
            'customers': medium_risk['customers'],
            'label': 'Medium risk',
            'threshold': '50% to 65%',
        },
        'lowRisk': {
            'value': int(low_risk['value']),
            'customers': low_risk['customers'],
            'label': 'Low risk',
            'threshold': 'Under 50%',
        },
        'total': int(high_risk['value'] + medium_risk['value']),
        'totalCustomers': high_risk['customers'] + medium_risk['customers'],
        'scoredCustomers': len(customers),
        'basis': 'completed revenue in the last 12 months',
    }
