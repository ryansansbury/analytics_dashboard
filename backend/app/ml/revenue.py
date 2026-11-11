"""Monthly revenue forecasting.

Ridge regression on a small, explicit feature set: a linear trend, cyclical
month encodings, a quarter-end flag, and two autoregressive lags. Evaluation uses a chronological
holdout, never a shuffled split, because shuffling a time series lets the model
see the future and produces error metrics that are meaningless.

Every number the API reports about this model comes from `Forecast.metrics`,
which is measured on months the fit never touched.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_percentage_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

MIN_MONTHS = 12
HOLDOUT_MONTHS = 6
N_LAGS = 2


@dataclass
class RevenueMetrics:
    """Chronological-holdout performance, with the baseline it has to beat.

    `mape` is the headline. `naive_mape` is what you get by predicting last
    month again, and `improvement_over_naive` is the only number that says
    whether the model earns its complexity.

    `r2` is reported for completeness and should be read with care: on a short
    holdout of a trending series its denominator is the variance of a handful
    of similar values, so it goes negative even when absolute error is small.
    It is not a failure signal on its own.
    """

    mape: float
    r2: float
    rmse: float
    mae: float
    naive_mape: float
    seasonal_naive_mape: float
    improvement_over_naive: float
    n_train: int
    n_test: int
    holdout_months: int

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Forecast:
    history: pd.DataFrame
    predictions: pd.DataFrame
    metrics: RevenueMetrics
    trend_per_month: float
    #: One row per holdout month with columns `period` and `revenue`, holding
    #: what the model predicted for months whose actuals it never trained on.
    #: This is the evidence that the forecast tracks reality: plotted against
    #: the actuals for the same months, the reader can see the fit rather than
    #: taking a MAPE figure on faith.
    backtest: pd.DataFrame


def _features(index: int, month: int, lag1: float, lag2: float) -> list[float]:
    """One month's row: trend, yearly cycle, the quarter-end flag, and two lags.

    Cyclical encoding rather than twelve dummies: with only two years of data,
    dummies would spend a parameter per month on roughly two observations each
    and memorise noise.

    The quarter-end flag is one parameter for a known B2B pattern, deals pulled
    into March, June, September, and December to land in the quarter. A smooth
    yearly curve can't make three sharp steps a year, so without it the model
    read each quarter-end spike as momentum and the month after as a slump.
    """
    return [
        index,
        np.sin(2 * np.pi * month / 12),
        np.cos(2 * np.pi * month / 12),
        1.0 if month % 3 == 0 else 0.0,
        lag1,
        lag2,
    ]


def _design_matrix(revenue: np.ndarray, start_index: int, months: np.ndarray) -> np.ndarray:
    """One row of `_features` per month that has two months of history behind it."""
    rows = [
        _features(start_index + i, months[i], revenue[i - 1], revenue[i - 2])
        for i in range(N_LAGS, len(revenue))
    ]
    return np.asarray(rows, dtype=float)


def train(frame: pd.DataFrame, horizon: int = 6) -> Forecast:
    """Fit on all but the last `HOLDOUT_MONTHS`, score there, refit on all.

    Raises ValueError when there is not enough history, which callers surface
    as an unavailable forecast rather than a fabricated one.
    """
    if len(frame) < MIN_MONTHS:
        raise ValueError(f"need at least {MIN_MONTHS} complete months, have {len(frame)}")

    frame = frame.sort_values("period").reset_index(drop=True)
    revenue = frame["revenue"].astype(float).to_numpy()
    months = np.array([p.month for p in frame["period"]])

    X = _design_matrix(revenue, 0, months)
    y = revenue[N_LAGS:]

    holdout = min(HOLDOUT_MONTHS, max(2, len(y) // 4))
    X_train, X_test = X[:-holdout], X[-holdout:]
    y_train, y_test = y[:-holdout], y[-holdout:]

    model = Pipeline([("scale", StandardScaler()), ("ridge", Ridge(alpha=1.0))])
    model.fit(X_train, y_train)
    pred = model.predict(X_test)

    # Baselines on the identical holdout. "Predict last month again" is the bar
    # any forecast has to clear to be worth running at all.
    holdout_idx = np.arange(N_LAGS, len(revenue))[-holdout:]
    naive = revenue[holdout_idx - 1]
    seasonal = revenue[holdout_idx - 12] if holdout_idx[0] >= 12 else naive

    mape = float(mean_absolute_percentage_error(y_test, pred) * 100)
    naive_mape = float(mean_absolute_percentage_error(y_test, naive) * 100)
    seasonal_mape = float(mean_absolute_percentage_error(y_test, seasonal) * 100)
    improvement = (naive_mape - mape) / naive_mape * 100 if naive_mape else 0.0

    # Holdout predictions keyed to their months, for the chart's overlap band.
    holdout_periods = frame["period"].iloc[N_LAGS:].reset_index(drop=True)[-holdout:]
    backtest = pd.DataFrame(
        {"period": holdout_periods.to_numpy(), "revenue": pred.astype(float)}
    )

    metrics = RevenueMetrics(
        mape=round(mape, 2),
        r2=round(float(r2_score(y_test, pred)), 4),
        rmse=round(float(np.sqrt(mean_squared_error(y_test, pred))), 2),
        mae=round(float(np.mean(np.abs(y_test - pred))), 2),
        naive_mape=round(naive_mape, 2),
        seasonal_naive_mape=round(seasonal_mape, 2),
        improvement_over_naive=round(improvement, 1),
        n_train=int(len(y_train)),
        n_test=int(len(y_test)),
        holdout_months=int(holdout),
    )

    # Refit on the full history before forecasting forward. The holdout existed
    # to measure error honestly, not to be thrown away.
    final = Pipeline([("scale", StandardScaler()), ("ridge", Ridge(alpha=1.0))])
    final.fit(X, y)

    # Recursive multi-step forecast: each prediction feeds the next month's lags.
    series = list(revenue)
    last_period = frame["period"].iloc[-1]
    future_periods, future_values = [], []
    for step in range(1, horizon + 1):
        period = last_period + step
        row = np.array(
            [_features(len(series), period.month, series[-1], series[-2])],
            dtype=float,
        )
        value = float(final.predict(row)[0])
        value = max(value, 0.0)
        series.append(value)
        future_periods.append(period)
        future_values.append(value)

    predictions = pd.DataFrame({"period": future_periods, "revenue": future_values})

    # Slope of a plain least-squares line, reported so the UI can describe the
    # direction without re-deriving it.
    slope = float(np.polyfit(np.arange(len(revenue)), revenue, 1)[0])

    return Forecast(
        history=frame,
        predictions=predictions,
        metrics=metrics,
        trend_per_month=round(slope, 2),
        backtest=backtest,
    )
