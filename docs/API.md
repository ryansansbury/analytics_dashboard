# API Reference

All endpoints are **HTTP GET**, return **JSON**, and require **no authentication**.
CORS is open for `/api/*`. The base path is `/api`. In production the API is
same-origin with the frontend; in development the Vite server proxies `/api` to
Flask on port 5001.

## Conventions

- `start_date` and `end_date` are `YYYY-MM-DD`. Defaults are computed
  server-side from the current date and differ per endpoint, noted below.
- Revenue aggregations count only `Transaction.status == 'completed'`.
- Response fields are **camelCase**, converted from snake_case columns.
- **Every figure is derived from stored rows or from a trained model.** Where a
  value cannot be computed, the field is `null` rather than estimated. A null
  `*Change` field means there is no prior period to compare against, not that
  the change is zero.
- **Time-bucketed series omit any period the window only partly covers.** The
  newer endpoints trim both ends with `app/analytics.py` and `/revenue/trends`
  trims its last bucket with `app/periods.py`. A part-month plotted beside
  complete months reads as a collapse, and a window opening midweek would start
  with a short week that reads as a dip.
- `granularity` is `day`, `week`, or `month`. When it is absent the server picks
  days up to 31 days, weeks up to 92, and months beyond. Weeks start on Monday.

---

## Utility

### `GET /api/health`

Liveness plus data readiness. Reports row counts and the age of the newest
transaction, because every endpoint degrades gracefully on an empty database
and returns 200 with empty results, which is correct but indistinguishable from
a broken deployment when you are looking at a blank dashboard.

```json
{
  "status": "healthy",
  "environment": "development",
  "data": {
    "seeded": true,
    "counts": { "customers": 0, "transactions": 0, "pipeline": 0 },
    "latestTransaction": "YYYY-MM-DD",
    "ageInDays": 0
  }
}
```

`status` is `"degraded"` with a `hint` field when the database is empty or the
tables are missing.

> There is no seeding endpoint. Seeding is destructive and belongs at the
> command line: `python reseed.py`. It was previously exposed as an
> unauthenticated `GET /api/seed-database`, which meant anyone who found the URL
> could wipe and regenerate the dataset.

---

## Dashboard — `/api/dashboard`

### `GET /api/dashboard/summary`

Params: `start_date` (default 30d), `end_date` (default today). The window
against the prior window of the same number of days, ending the day before it
starts. Active customers are customers with a completed order. The open
pipeline is what was open on each window's last day, from stage history.
`trends` holds one point per whole bucket for the tiles' sparklines.

```json
{
  "kpis": {
    "totalRevenue":   { "value": 0, "previousValue": 0, "change": 0, "changePercent": 0 },
    "totalCustomers": { "value": 0, "previousValue": 0, "change": 0, "changePercent": 0 },
    "totalOrders":    { "value": 0, "previousValue": 0, "changePercent": 0 },
    "avgOrderValue":  { "value": 0, "changePercent": 0 },
    "pipelineValue":  { "value": 0, "changePercent": 0 }
  },
  "trends": {
    "revenue":   [{ "date": "YYYY-MM-DD", "value": 0 }],
    "customers": [{ "date": "YYYY-MM-DD", "value": 0 }],
    "aov":       [{ "date": "YYYY-MM-DD", "value": 0 }],
    "pipeline":  [{ "date": "YYYY-MM-DD", "value": 0 }]
  },
  "granularity": "week",
  "dateRange": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD",
                 "previousStartDate": "YYYY-MM-DD", "previousEndDate": "YYYY-MM-DD" }
}
```

### `GET /api/dashboard/kpis`

Calls the same handler as `/summary`. Identical params and response.

---

## Revenue — `/api/revenue`

### `GET /api/revenue/trends`

Params: `start_date` (default 365d), `end_date`, `granularity` = `day` | `week`
| `month` (default `day`). Under `week` and `month` an incomplete trailing
bucket is dropped.

```json
[ { "date": "YYYY-MM-DD", "revenue": 0, "orders": 0 } ]
```

### `GET /api/revenue/comparison`

Params: `start_date`, `end_date`, `granularity`. Revenue in each whole bucket of
the window beside the same bucket a year earlier. Months shift by twelve. Days
and weeks shift by 364 days so weekdays line up.

```json
{
  "granularity": "week",
  "points": [{ "date": "YYYY-MM-DD", "label": "Aug 10", "previousDate": "YYYY-MM-DD",
               "previousLabel": "Aug 11", "current": 0, "previous": 0 }],
  "current": 0, "previous": 0, "change": 27.4,
  "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"
}
```

### `GET /api/revenue/category-trends`

Params: `start_date`, `end_date`, `granularity`. Revenue per bucket for the five
largest categories over the window, with the rest summed as `Other`. `keys` is
ordered largest first.

```json
{ "granularity": "month", "keys": ["Security Solutions", "...", "Other"],
  "points": [{ "date": "YYYY-MM-DD", "label": "Dec 2025", "Security Solutions": 0 }] }
```

### `GET /api/revenue/region-trends`

Params: `start_date`, `end_date`, `granularity`. Revenue per bucket for every
region, plus each region's total and its change on the same buckets a year
earlier.

```json
{ "granularity": "month", "keys": ["North America", "..."],
  "points": [{ "date": "YYYY-MM-DD", "label": "Dec 2025", "North America": 0 }],
  "totals": [{ "region": "North America", "revenue": 0, "previous": 0, "change": 0 }] }
```

### `GET /api/revenue/calendar`

Params: `end_date`. Daily revenue for the 53 calendar weeks ending with the
week that holds `end_date`, starting on a Monday and stopping at `end_date`.
Days with no orders are present with zero revenue.

```json
{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "max": 0,
  "days": [{ "date": "YYYY-MM-DD", "week": 0, "weekday": 0, "revenue": 0 }] }
```

### `GET /api/revenue/order-sizes`

Params: `start_date`, `end_date`. Orders and revenue in roughly logarithmic size
bands, as counts and as shares.

```json
[{ "band": "$2.5K to $5K", "min": 2500, "max": 5000, "orders": 0, "revenue": 0,
   "orderShare": 0, "revenueShare": 0 }]
```

### `GET /api/revenue/by-category`

Params: `start_date` (30d), `end_date`. Descending by revenue.

```json
[ { "category": "Enterprise Software", "value": 0, "percentage": 0 } ]
```

### `GET /api/revenue/by-region`

Params: `start_date` (30d), `end_date`. `growth` is `null` when no prior period
is available.

```json
[ { "region": "North America", "revenue": 0, "customers": 0, "growth": null } ]
```

### `GET /api/revenue/by-channel`

Params: `start_date` (30d), `end_date`.

```json
[ { "channel": "Direct Sales", "value": 0, "percentage": 0 } ]
```

### `GET /api/revenue/top-products`

Params: `start_date` (30d), `end_date`, `limit` (default 10).

```json
[ { "id": 0, "name": "", "category": "", "revenue": 0, "unitsSold": 0, "avgPrice": 0, "growth": null } ]
```

---

## Customers — `/api/customers`

### `GET /api/customers/overview`

Params: `start_date`, `end_date`. `total` counts customers with a completed
order in the window and `new` counts customers acquired in it, each against the
prior window of equal length. `atRisk` counts live customers the churn model
puts at `atRiskThreshold` or higher. `churned` is the all-time count from the
account status, because no churn date is stored to scope it to a window.

```json
{ "total": 0, "totalChange": 0, "new": 0, "newChange": 0,
  "churned": 0, "churnedScope": "all time", "churnedChange": null,
  "atRisk": 0, "atRiskThreshold": 0.5, "atRiskChange": null }
```

### `GET /api/customers/segments`

Params: `start_date` (30d), `end_date`.

```json
[ { "segment": "enterprise", "count": 0, "revenue": 0, "percentage": 0 } ]
```

### `GET /api/customers/cohorts`

Params: `end_date`. `start_date` is accepted and ignored. Monthly retention for
the twelve most recent first-purchase cohorts. A customer belongs to the month
of their first completed order, so month 0 is 100% by definition. Month k is the
share of the cohort with a completed order k months later. Only whole months
count, and months a cohort hasn't reached are `null`. Customers acquired before
the first recorded order are left out, since their first purchase predates the
data.

```json
[{ "cohort": "YYYY-MM-01", "label": "Nov 2025", "size": 0,
   "retention": [100.0, 0, 0, null] }]
```

### `GET /api/customers/lifetime-value`

Params: `start_date`, `end_date`. Distribution across LTV bands.

```json
[ { "range": "$0-10k", "count": 0, "percentage": 0 } ]
```

### `GET /api/customers/acquisition`

Params: `start_date` (default 365d), `end_date`. New customers per whole bucket
split by acquisition channel. The bucket size follows the window's length.

```json
{ "granularity": "month", "keys": ["Direct Sales", "..."],
  "points": [{ "date": "YYYY-MM-DD", "label": "Dec 2025", "Direct Sales": 0 }] }
```

### `GET /api/customers/risk-value`

No params. Every live customer's churn probability against their completed
revenue over the last 12 months, for the scatter. Customers with no revenue in
the year are left off the points and counted in `withoutRevenue`.

```json
{ "points": [{ "id": 0, "company": "", "segment": "smb", "riskScore": 0.0, "annualRevenue": 0 }],
  "threshold": 0.5, "scored": 0, "withoutRevenue": 0 }
```

### `GET /api/customers/at-risk`

Params: `limit` (default 10), `start_date`, `end_date`. Shares the churn model
with `/api/forecasting/churn-risk`, so the two never disagree.

```json
[ { "id": 0, "name": "", "company": "", "segment": "", "lifetimeValue": 0,
    "riskScore": 0.0, "daysSinceActivity": 0, "recommendation": "" } ]
```

---

## Operations — `/api/operations`

### `GET /api/operations/pipeline`

Params: `start_date` (30d), `end_date`. Funnel by stage. `conversionRate` is
`null` for the first stage, which has nothing to convert from.

```json
[ { "stage": "Lead", "count": 0, "value": 0, "conversionRate": null } ]
```

### `GET /api/operations/pipeline-kpis`

Params: `start_date`, `end_date`. From each deal's stage history, each against
the prior window of equal length. Win rate is deals won over deals won or lost
among deals that closed in the window, and its change is in percentage points.
Cycle time is days from creation to the win for deals won in the window.

```json
{ "pipelineValue": 0, "pipelineChange": 0, "openDeals": 0,
  "winRate": 0, "winRateChange": 0, "avgDealSize": 0, "dealSizeChange": 0,
  "avgCycleTime": 0, "cycleTimeChange": 0, "dealsWon": 0, "dealsLost": 0 }
```

### `GET /api/operations/pipeline-flow`

Params: `end_date`. How the deals created in the 365 days to `end_date` moved
through the stages, as nodes and links for a Sankey diagram. Each link counts
deals and carries their summed value. The links out of Lead add up to
`created`.

```json
{ "nodes": [{ "name": "Lead" }, "...", { "name": "Won" }, { "name": "Lost" }, { "name": "Open" }],
  "links": [{ "source": 0, "target": 1, "value": 0, "amount": 0 }],
  "created": 0, "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" }
```

### `GET /api/operations/sales-performance`

Params: `start_date`, `end_date`. Every rep's completed bookings in the window
against their annual quota prorated to the window's days, sorted by attainment.

```json
[{ "id": 0, "name": "", "team": "Enterprise", "region": "", "quota": 0,
   "periodQuota": 0, "achieved": 0, "deals": 0, "attainment": 0 }]
```

### `GET /api/operations/conversion-rates`

Params: `end_date`. Of the deals that left each stage in the 365 days to
`end_date`, the share that moved to the next stage. Deals still in a stage are
left out of its rate.

```json
[{ "fromStage": "Lead", "toStage": "Qualified", "rate": 0, "exits": 0 }]
```

### `GET /api/operations/cycle-time`

Params: `end_date`. Average days deals spent in each stage, for stage exits in
the 365 days to `end_date`, from stage history.

```json
[{ "stage": "Lead", "avgDays": 0, "count": 0 }]
```

### `GET /api/operations/opportunities`

Params: `stage` (optional), `limit` (default 20).

```json
[ { "id": 0, "opportunityName": "", "customerId": 0, "customerName": "",
    "amount": 0, "probability": 0, "expectedCloseDate": "YYYY-MM-DD", "salesRepId": 0 } ]
```

### `GET /api/operations/deal-size-distribution`

Params: `start_date` (default 365d), `end_date`.

```json
[ { "bucket": "", "count": 0, "value": 0 } ]
```

---

## Forecasting — `/api/forecasting`

Backed by two models trained on the application's own data. Every figure below
is measured on a holdout the model never trained on. When a model cannot be fit,
endpoints report `available: false` rather than returning a number.

### `GET /api/forecasting/revenue`

Params: `periods` (default 6, at most 24), `start_date` to clip the plotted
history. Monthly actuals, the backtest over the holdout months, and the
forecast with 80% (`lowerBound` and `upperBound`) and 95% intervals. The
intervals come from the holdout RMSE, widen with the square root of the
horizon, and open from zero width at the last actual month.

```json
[{ "date": "YYYY-MM-01", "actual": 0, "predicted": null, "lowerBound": null,
   "upperBound": null, "lower95": null, "upper95": null, "backtest": 0 }]
```

### `GET /api/forecasting/pipeline`

Params: `start_date`, `end_date`. Probability-weighted pipeline by month.

```json
[ { "month": "", "weighted": 0, "best": 0, "worst": 0 } ]
```

### `GET /api/forecasting/churn-risk`

Params: `limit` (default 10), `start_date`, `end_date`. Model probabilities,
descending. Already-churned accounts are excluded. `daysSinceActivity` is the
real recency from the feature frame.

```json
[ { "id": 0, "name": "", "company": "", "segment": "", "lifetimeValue": 0,
    "riskScore": 0.0, "daysSinceActivity": 0, "recommendation": "" } ]
```

### `GET /api/forecasting/kpis`

The first forecast month and its change against the last actual month, and the
count of live customers at or above the risk threshold.

```json
{ "predictedRevenue": 0, "predictedChange": 0, "predictedMonth": "YYYY-MM-01",
  "atRiskCount": 0, "atRiskThreshold": 0.5, "atRiskChange": null,
  "modelAccuracy": 0, "accuracyChange": null, "forecastPeriod": 6 }
```

### `GET /api/forecasting/seasonality`

Params: `start_date`, `end_date`. Monthly index against the series mean.

```json
[ { "month": "Jan", "index": 1.0, "trend": 0 } ]
```

### `GET /api/forecasting/model-performance`

Ignores date filters: model performance is a property of the fit, not of the
window being viewed. It used to be varied by filter for appearances.

```json
{
  "available": true,
  "accuracy": 0, "mape": 0, "r2Score": 0, "rmse": 0, "dataPoints": "21 mo",
  "revenue": {
    "model": "Ridge regression on trend, seasonality, quarter-end, and 2 lags",
    "validation": "chronological holdout",
    "mape": 0, "naiveMape": 0, "seasonalNaiveMape": 0, "improvementOverNaive": 0,
    "rmse": 0, "mae": 0, "r2Score": 0, "trainMonths": 0, "holdoutMonths": 0
  },
  "churn": {
    "model": "Gradient-boosted classifier on RFM and account features",
    "validation": "stratified holdout",
    "rocAuc": 0, "accuracy": 0, "precision": 0, "recall": 0, "f1": 0,
    "averagePrecision": 0, "brierScore": 0, "baseRate": 0,
    "trainRows": 0, "holdoutRows": 0, "topFeatures": {}
  }
}
```

Note that `r2Score` is negative for the revenue model. That is honest and worth
understanding: R² measures against the holdout's own mean, and across a short,
nearly flat holdout window that mean is hard to beat even when absolute error is
small. MAPE against the naive baseline is the comparison that says whether the
model earns its keep.

### `GET /api/forecasting/revenue-at-risk`

Completed revenue over the last 12 months from live customers in each churn
risk tier. `total` and `totalCustomers` are the high and medium tiers together,
the revenue actually at risk. The low tier is reported for context.

```json
{ "highRisk":   { "value": 0, "customers": 0, "label": "High risk", "threshold": "65% or higher" },
  "mediumRisk": { "value": 0, "customers": 0, "label": "Medium risk", "threshold": "50% to 65%" },
  "lowRisk":    { "value": 0, "customers": 0, "label": "Low risk", "threshold": "Under 50%" },
  "total": 0, "totalCustomers": 0, "scoredCustomers": 0,
  "basis": "completed revenue in the last 12 months" }
```

