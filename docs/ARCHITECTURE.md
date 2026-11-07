# Architecture

A Flask REST API over PostgreSQL, a React SPA that consumes it, and two
scikit-learn models trained on the application's own data. The hosted demo is a
static build of the same application; see the end of this document.

```
React 19 SPA  ──fetch──▶  Flask /api/*  ──SQLAlchemy──▶  PostgreSQL
     │                        │
 TanStack Query          app/ml/registry
 (server cache)          (lazy-trained models)
```

---

## Backend

```
backend/app/
  __init__.py      application factory, /api/health, static serving
  config.py        per-environment config
  periods.py       the time-bucketing rule, shared by every series endpoint
  models/          SQLAlchemy models, one per file
  routes/          five blueprints, one per domain
  ml/
    features.py    RFM and monthly-revenue feature frames
    churn.py       gradient-boosted classifier
    revenue.py     ridge regression forecast
    registry.py    lazy training, cached per process
```

### Application factory

`create_app(config_name)` initialises SQLAlchemy, opens CORS on `/api/*`,
registers the five blueprints, and calls `db.create_all()`. Creating tables is
idempotent and safe. Populating them is neither, and does not happen here.

The factory previously auto-reseeded when data looked stale. That recursed
infinitely, because `seed_database()` calls `create_app()`, which reached the
same check and called `seed_database()` again, terminating only by exhausting
the database's connections. See `DECISIONS.md` entry 5.

### Route blueprints

Five, each mounted under its own prefix: `dashboard`, `revenue`, `customers`,
`operations`, `forecasting`. Handlers query through SQLAlchemy, convert
snake_case to camelCase, and return JSON.

Some helpers are shared across blueprints so that a figure appearing on two
pages cannot differ: the churn scoring behind both `/customers/at-risk` and
`/forecasting/churn-risk`, and the pipeline aggregate behind both
`/dashboard/summary` and `/operations/pipeline`. This couples the route modules
to each other, which is acceptable at this size and would want a service layer
if it grew.

### The bucketing rule

`app/periods.py` exists so that one rule has one home: **a period the window
only partly covers is not plotted.** Every time-bucketed endpoint calls
`drop_incomplete_tail`, and `app/ml/features.monthly_revenue` applies the same
rule to the model's training input, so the forecast and the chart never disagree
about what a month is.

### Models

Trained lazily on first use and cached for the process lifetime by
`app/ml/registry.py`. The registry returns `None` when a model cannot be fit,
and callers report `available: false` rather than inventing a figure. Nothing
trains at import time, so a cold start does not pay for training it may not
need.

- **Churn** — `GradientBoostingClassifier` over RFM features, tenure, refund
  rate, spend trend, and account attributes. Stratified holdout. Reports ROC
  AUC, average precision, precision, recall, F1, Brier score, and gain-based
  feature importance.
- **Revenue** — `Ridge` over trend, cyclical month encodings, and two
  autoregressive lags, inside a `ColumnTransformer`. Chronological holdout,
  never shuffled. Reported against last-value and seasonal-naive baselines.
  Intervals come from holdout RMSE scaled by the square root of the horizon.

---

## Frontend

```
frontend/src/
  services/api.ts          one typed function per endpoint
  services/staticData.ts   static-mode transport for the hosted demo
  hooks/useApi.ts          one TanStack Query hook per endpoint
  hooks/useFilters.tsx     global date range and dimension filters
  pages/                   five routed pages
  components/              cards, charts, tables, layout, filters, common
  utils/formatters.ts      currency, number, date, and chart colour helpers
```

**Data flow.** A page calls a hook, the hook calls a service function, the
service function calls `fetchApi`. TanStack Query owns caching, deduplication,
and loading state. The query key includes the active date range, so changing a
filter refetches rather than reusing a stale entry.

**One interception point.** Every request goes through `fetchApi`. That is what
makes the static build possible without a parallel code path: the transport
changes, nothing above it does.

**Charts.** Project components in `components/charts`, most of them over
Recharts and a few in plain SVG or HTML where that draws better: the sparkline,
the calendar and cohort heatmaps, ranked bars, and quota attainment. The shared
tooltip, legend, and axis styling live in `chrome.tsx`, and every entity's colour
is fixed in `utils/colors.ts` so it never changes with rank. Chart colour tokens,
including the validated heatmap ramp, live in plain `:root` rather than
Tailwind's `@theme`, because Tailwind v4 prunes theme tokens it cannot see
referenced in markup and once silently dropped two funnel colours.

**Cards.** `ChartCard` gives every chart a title, a subtitle that says what the
numbers are, a table view with a CSV download, and its own error boundary, so a
chart that fails to draw blanks its card and not the page.

**Calculations.** The endpoints added for these charts load plain rows and
aggregate them with pandas in `app/analytics.py`. Each calculation is a pure
function with tests that work the answer out by hand, and the same code runs on
PostgreSQL and on the SQLite test database.

---

## Data

Six tables: `customers`, `products`, `transactions`, `pipeline`, `sales_reps`,
`daily_metrics`. Roughly 2,000 customers and 45,000 transactions across a
two-year window, generated by `backend/data/seed_data.py`.

The generator is deterministic (seed 42 across Faker, `random`, and NumPy) but
anchors its window to the current date minus two years, so regenerating produces
the same dataset re-dated to today rather than a different one.

Churn is behaviour-driven rather than assigned at random: a latent engagement
variable drives both transaction frequency and the churn hazard, and is stripped
from the row before insert so no model can read the label's cause back out.

---

## The static build

The application runs against live PostgreSQL. The hosted demo is a build
artifact of it.

`backend/scripts/snapshot.py` boots the real Flask app, trains both models,
walks every endpoint the UI calls under all five date presets, and writes the
responses to `frontend/public/data/`. With `VITE_STATIC_DATA=true`,
`fetchApi` resolves those files instead of the network.

The one hard problem is time. Presets resolve against today, so a snapshot taken
on one date stops matching the next. The snapshot records the date it was taken
and static mode treats that as today, which keeps request paths usable directly
as cache keys with no separate mapping to drift.

`frontend/src/services/staticData.test.tsx` mounts every page under every preset
against the generated snapshot and fails on any request the snapshot does not
contain, so an uncovered endpoint breaks a test rather than a chart.

The live build tree-shakes the static path out entirely.
