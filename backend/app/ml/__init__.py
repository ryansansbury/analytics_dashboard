"""Machine learning for the analytics dashboard.

Two supervised models trained on the application's own data:

- `churn`  — gradient-boosted classifier over RFM and account features,
             evaluated on a stratified holdout.
- `revenue` — ridge regression on trend, seasonality, and lags, evaluated on a
             chronological holdout.

`registry` trains both on first use and caches them. Every performance figure
the API reports is measured on data the model did not train on.
"""

from .registry import (  # noqa: F401
    get_churn_error,
    get_churn_model,
    get_revenue_error,
    get_revenue_forecast,
    reset,
)
