"""Model tests.

Two jobs here. First, the models train and behave sanely. Second, and more
important for this repo's history: the reported metrics are actually measured
rather than asserted. Several tests below exist specifically to fail if anyone
reintroduces hardcoded or randomised performance numbers.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.ml import churn as churn_mod
from app.ml import revenue as revenue_mod


class TestChurnModel:
    def test_trains_and_reports_a_holdout_split(self, churn_model, customers_frame):
        m = churn_model.metrics
        assert m.n_train + m.n_test == len(customers_frame)
        assert m.n_test > 0 and m.n_train > m.n_test

    def test_beats_random(self, churn_model):
        """A model at 0.5 AUC has learned nothing. This is the floor that the
        previous formula-plus-noise implementation could not have cleared."""
        assert churn_model.metrics.roc_auc > 0.7

    def test_metrics_are_in_valid_ranges(self, churn_model):
        m = churn_model.metrics
        for name in ("roc_auc", "average_precision", "accuracy", "precision", "recall", "f1"):
            value = getattr(m, name)
            assert 0.0 <= value <= 1.0, f"{name}={value}"
        assert 0.0 <= m.brier <= 1.0

    def test_metrics_are_deterministic(self, customers_frame):
        """Same data in, same numbers out. If this fails, something random is
        leaking into the reported performance."""
        a = churn_mod.train(customers_frame).metrics
        b = churn_mod.train(customers_frame).metrics
        assert a.to_dict() == b.to_dict()

    def test_probabilities_are_probabilities(self, churn_model, customers_frame):
        proba = churn_model.predict_proba(customers_frame)
        assert len(proba) == len(customers_frame)
        assert np.all((proba >= 0.0) & (proba <= 1.0))

    def test_separates_actual_churners(self, churn_model, customers_frame):
        proba = churn_model.predict_proba(customers_frame)
        churned = proba[customers_frame["churned"] == 1].mean()
        retained = proba[customers_frame["churned"] == 0].mean()
        assert churned > retained * 2

    def test_recency_is_a_leading_driver(self, churn_model):
        importance = churn_model.metrics.feature_importance
        assert importance, "no feature importance reported"
        assert "recency_days" in importance

    def test_refuses_single_class_data(self, customers_frame):
        frame = customers_frame.copy()
        frame["churned"] = 0
        with pytest.raises(ValueError, match="single class"):
            churn_mod.train(frame)

    def test_refuses_tiny_datasets(self, customers_frame):
        with pytest.raises(ValueError, match="not enough"):
            churn_mod.train(customers_frame.head(20))

    def test_refuses_missing_columns(self, customers_frame):
        frame = customers_frame.drop(columns=["recency_days"])
        with pytest.raises(ValueError, match="missing columns"):
            churn_mod.train(frame)


class TestRevenueModel:
    def test_holdout_is_chronological(self, revenue_forecast, revenue_frame):
        """Shuffling a time series lets the model see the future."""
        m = revenue_forecast.metrics
        assert m.n_test == m.holdout_months
        assert m.n_train + m.n_test == len(revenue_frame) - revenue_mod.N_LAGS

    def test_beats_the_naive_baseline(self, revenue_forecast):
        """Predicting last month again is free. A model that cannot beat it is
        not worth running."""
        m = revenue_forecast.metrics
        assert m.mape < m.naive_mape, f"model {m.mape}% vs naive {m.naive_mape}%"
        assert m.improvement_over_naive > 0

    def test_error_is_reasonable(self, revenue_forecast):
        assert 0 < revenue_forecast.metrics.mape < 25

    def test_forecast_horizon_and_shape(self, revenue_frame):
        forecast = revenue_mod.train(revenue_frame, horizon=6)
        assert len(forecast.predictions) == 6
        assert (forecast.predictions["revenue"] >= 0).all()

    def test_forecast_continues_the_calendar(self, revenue_forecast):
        last_history = revenue_forecast.history["period"].iloc[-1]
        first_future = revenue_forecast.predictions["period"].iloc[0]
        assert first_future == last_history + 1

    def test_metrics_are_deterministic(self, revenue_frame):
        a = revenue_mod.train(revenue_frame).metrics
        b = revenue_mod.train(revenue_frame).metrics
        assert a.to_dict() == b.to_dict()

    def test_forecast_is_not_wild(self, revenue_forecast):
        """Guards against a runaway recursive forecast."""
        history_max = revenue_forecast.history["revenue"].max()
        assert revenue_forecast.predictions["revenue"].max() < history_max * 3

    def test_refuses_short_history(self, revenue_frame):
        with pytest.raises(ValueError, match="at least"):
            revenue_mod.train(revenue_frame.head(6))
