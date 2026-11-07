"""API tests for the forecasting endpoints.

The regression these guard against is specific and real: this API used to
report model accuracy, MAPE, R², RMSE, churn risk scores, and confidence
intervals that were generated with `random.uniform()` rather than measured.
Several tests below assert that endpoint output matches the trained model
exactly, so any drift back toward fabrication fails the suite.
"""

from __future__ import annotations

import pytest

from app.ml import registry


@pytest.fixture(autouse=True)
def _fresh_registry(ctx):
    registry.reset()
    yield


class TestModelPerformance:
    def test_returns_measured_metrics(self, client, ctx):
        payload = client.get("/api/forecasting/model-performance").get_json()
        assert payload["available"] is True
        assert "revenue" in payload and "churn" in payload

    def test_metrics_match_the_trained_model_exactly(self, client, ctx):
        """Not 'close to'. Identical. Anything else means the endpoint is
        deriving numbers instead of reporting them."""
        payload = client.get("/api/forecasting/model-performance").get_json()
        model = registry.get_churn_model()
        forecast = registry.get_revenue_forecast()

        assert payload["churn"]["rocAuc"] == model.metrics.roc_auc
        assert payload["churn"]["precision"] == model.metrics.precision
        assert payload["churn"]["recall"] == model.metrics.recall
        assert payload["revenue"]["mape"] == forecast.metrics.mape
        assert payload["revenue"]["rmse"] == forecast.metrics.rmse

    def test_reports_its_validation_method(self, client, ctx):
        payload = client.get("/api/forecasting/model-performance").get_json()
        assert payload["churn"]["validation"] == "stratified holdout"
        assert payload["revenue"]["validation"] == "chronological holdout"

    def test_is_stable_across_calls(self, client, ctx):
        """The old implementation reseeded a PRNG per request, so identical
        requests returned different accuracy figures."""
        first = client.get("/api/forecasting/model-performance").get_json()
        second = client.get("/api/forecasting/model-performance").get_json()
        assert first == second

    def test_ignores_date_filters(self, client, ctx):
        """Model performance is a property of the fit, not of the window the
        user is looking at. It used to be varied by filter for appearances."""
        plain = client.get("/api/forecasting/model-performance").get_json()
        filtered = client.get(
            "/api/forecasting/model-performance?start_date=2026-01-01&end_date=2026-06-01"
        ).get_json()
        assert plain == filtered


class TestRevenueForecast:
    def test_returns_history_then_forecast(self, client, ctx):
        """Six future points, plus the join.

        The last actual month also carries a predicted value equal to its
        actual, so the dashed forecast line starts exactly where the solid
        history line ends instead of floating above or below it.
        """
        rows = client.get("/api/forecasting/revenue?periods=6").get_json()
        assert isinstance(rows, list) and rows
        assert sum(1 for r in rows if r["predicted"] is not None) == 7
        assert any(r["actual"] is not None for r in rows)

    def test_the_join_point_matches_the_last_actual_exactly(self, client, ctx):
        rows = client.get("/api/forecasting/revenue?periods=6").get_json()
        join = [r for r in rows if r["actual"] is not None and r["predicted"] is not None]
        assert len(join) == 1
        assert join[0]["actual"] == join[0]["predicted"]

    def test_dates_are_ordered_and_monthly(self, client, ctx):
        rows = client.get("/api/forecasting/revenue?periods=4").get_json()
        dates = [r["date"] for r in rows]
        assert dates == sorted(dates)
        assert all(d.endswith("-01") for d in dates)

    def test_bounds_bracket_the_prediction_and_widen(self, client, ctx):
        """Intervals derive from holdout RMSE scaled by sqrt(horizon). They used
        to be a random 8-12% of the value."""
        rows = [r for r in client.get("/api/forecasting/revenue?periods=6").get_json()
                if r["predicted"] is not None]
        widths = []
        for row in rows:
            assert row["lowerBound"] <= row["predicted"] <= row["upperBound"]
            widths.append(row["upperBound"] - row["lowerBound"])
        assert widths[-1] > widths[0], "uncertainty should grow with horizon"

    def test_every_predicted_point_carries_a_band(self, client, ctx):
        """The band has to cover the dashed line for its whole length.

        The join point used to carry null bounds, on the reasoning that a
        measured value has no uncertainty. True of the number and wrong for the
        chart: the dashed line started at the join and the shading started a
        month later, so the first forecast segment was drawn with no interval
        around it.
        """
        rows = client.get("/api/forecasting/revenue?periods=6").get_json()
        for row in rows:
            if row["predicted"] is None:
                continue
            assert row["lowerBound"] is not None, f"{row['date']} has no lower bound"
            assert row["upperBound"] is not None, f"{row['date']} has no upper bound"

    def test_the_band_opens_from_zero_width_at_the_join(self, client, ctx):
        """Anchoring it at the last measurement is what makes the shading start
        exactly where the forecast does rather than a step later."""
        rows = client.get("/api/forecasting/revenue?periods=6").get_json()
        join = [r for r in rows if r["actual"] is not None and r["predicted"] is not None]
        assert len(join) == 1
        assert join[0]["lowerBound"] == join[0]["upperBound"] == join[0]["actual"]

    def test_lower_bound_never_negative(self, client, ctx):
        rows = client.get("/api/forecasting/revenue?periods=12").get_json()
        assert all(r["lowerBound"] >= 0 for r in rows if r["lowerBound"] is not None)

    def test_is_stable_across_calls(self, client, ctx):
        assert (
            client.get("/api/forecasting/revenue?periods=6").get_json()
            == client.get("/api/forecasting/revenue?periods=6").get_json()
        )

    def test_horizon_is_clamped(self, client, ctx):
        rows = client.get("/api/forecasting/revenue?periods=999").get_json()
        # 24 future points at most, plus the join.
        assert sum(1 for r in rows if r["predicted"] is not None) <= 25


class TestChurnRisk:
    def test_scores_are_model_probabilities(self, client, ctx):
        rows = client.get("/api/forecasting/churn-risk").get_json()
        assert rows
        for row in rows:
            assert 0.0 <= row["riskScore"] <= 1.0

    def test_sorted_by_risk_descending(self, client, ctx):
        rows = client.get("/api/forecasting/churn-risk").get_json()
        scores = [r["riskScore"] for r in rows]
        assert scores == sorted(scores, reverse=True)

    def test_recency_is_real_not_invented(self, client, ctx):
        """`daysSinceActivity` was `20 + random.randint(0, 40)`, so it could
        never exceed 60 regardless of the account."""
        from app.ml.features import customer_frame

        frame = customer_frame().set_index("customer_id")
        rows = client.get("/api/forecasting/churn-risk").get_json()
        for row in rows:
            assert row["daysSinceActivity"] == int(frame.loc[row["id"], "recency_days"])

    def test_excludes_already_churned_accounts(self, client, ctx):
        from app import db
        from app.models import Customer

        rows = client.get("/api/forecasting/churn-risk").get_json()
        ids = [r["id"] for r in rows]
        churned = {
            c.id
            for c in db.session.query(Customer).filter(Customer.status == "churned").all()
        }
        assert not (set(ids) & churned)

    def test_is_stable_across_calls(self, client, ctx):
        assert (
            client.get("/api/forecasting/churn-risk").get_json()
            == client.get("/api/forecasting/churn-risk").get_json()
        )


class TestRevenueAtRisk:
    def test_buckets_are_consistent(self, client, ctx):
        payload = client.get("/api/forecasting/revenue-at-risk").get_json()
        at_risk = payload["highRisk"]["customers"] + payload["mediumRisk"]["customers"]
        assert at_risk == payload["totalCustomers"]
        assert at_risk + payload["lowRisk"]["customers"] == payload["scoredCustomers"]

    def test_total_is_the_high_and_medium_tiers(self, client, ctx):
        """The low tier is not at risk. It used to be added into the total."""
        payload = client.get("/api/forecasting/revenue-at-risk").get_json()
        parts = payload["highRisk"]["value"] + payload["mediumRisk"]["value"]
        assert abs(parts - payload["total"]) <= 2  # integer rounding per bucket

    def test_values_are_last_years_revenue(self, client, ctx):
        from app import analytics
        from app.routes.forecasting import get_at_risk_customers_with_scores

        payload = client.get("/api/forecasting/revenue-at-risk").get_json()
        annual = analytics.trailing_revenue()
        high = sum(annual.get(c["id"], 0.0) for c in get_at_risk_customers_with_scores()
                   if c["riskScore"] >= 0.65)
        assert payload["highRisk"]["value"] == int(high)


class TestForecastIntervals:
    def test_the_95_band_contains_the_80_band(self, client, ctx):
        rows = client.get("/api/forecasting/revenue?periods=6").get_json()
        future = [r for r in rows if r["actual"] is None]
        assert future
        for r in future:
            assert r["lower95"] <= r["lowerBound"] <= r["predicted"]
            assert r["predicted"] <= r["upperBound"] <= r["upper95"]

    def test_both_bands_open_from_the_join(self, client, ctx):
        rows = client.get("/api/forecasting/revenue?periods=6").get_json()
        join = [r for r in rows if r["actual"] is not None and r["predicted"] is not None][0]
        assert join["lower95"] == join["upper95"] == join["actual"]

    def test_backtest_matches_the_model_holdout(self, client, ctx):
        rows = client.get("/api/forecasting/revenue?periods=6").get_json()
        forecast = registry.get_revenue_forecast()
        expected = {
            p.start_time.strftime("%Y-%m-%d"): round(float(v), 2)
            for p, v in zip(forecast.backtest["period"], forecast.backtest["revenue"])
        }
        shown = {r["date"]: r["backtest"] for r in rows if r["backtest"] is not None}
        assert shown
        for day, value in shown.items():
            assert value == expected[day]
        assert all(r["backtest"] is None for r in rows if r["actual"] is None)
