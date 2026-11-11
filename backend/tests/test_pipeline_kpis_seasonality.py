"""Tests for the pipeline, KPI, and seasonality endpoints.

These three were the last places the API scaled real database values by
`random.uniform()` before returning them. The tests below assert the arithmetic
now reconciles against the underlying rows, which a random multiplier cannot
survive.
"""

from __future__ import annotations

from datetime import datetime

import pytest

from app import db
from app.ml import registry
from app.models import Pipeline, Transaction


@pytest.fixture(autouse=True)
def _fresh_registry(ctx):
    registry.reset()
    yield


class TestPipelineForecast:
    def test_returns_at_most_six_months_in_order(self, client, ctx):
        rows = client.get("/api/forecasting/pipeline").get_json()
        assert isinstance(rows, list)
        assert len(rows) <= 6
        parsed = [datetime.strptime(r["month"], "%b %Y") for r in rows]
        assert parsed == sorted(parsed)

    def test_worst_is_at_most_weighted_is_at_most_best(self, rows_or_skip):
        """commit <= expected value <= everything closes. A random multiplier
        applied independently to each could invert this."""
        for row in rows_or_skip:
            assert row["worst"] <= row["weighted"] + 0.01
            assert row["weighted"] <= row["best"] + 0.01

    def test_best_case_reconciles_with_the_database(self, rows_or_skip, ctx):
        """`best` must equal the actual sum of open pipeline for that month."""
        expected = {}
        for p in db.session.query(Pipeline).filter(
            Pipeline.stage.notin_(["closed-won", "closed-lost"]),
            Pipeline.expected_close_date >= datetime.now().date(),
        ).all():
            key = p.expected_close_date.strftime("%b %Y")
            expected[key] = expected.get(key, 0.0) + float(p.amount or 0)

        for row in rows_or_skip:
            assert row["best"] == pytest.approx(expected[row["month"]], rel=1e-6)

    def test_excludes_closed_opportunities(self, rows_or_skip, ctx):
        total_open = sum(
            float(p.amount or 0)
            for p in db.session.query(Pipeline).filter(
                Pipeline.stage.notin_(["closed-won", "closed-lost"]),
                Pipeline.expected_close_date >= datetime.now().date(),
            ).all()
        )
        assert sum(r["best"] for r in rows_or_skip) <= total_open + 0.01

    def test_is_stable_across_calls(self, client, ctx):
        assert (
            client.get("/api/forecasting/pipeline").get_json()
            == client.get("/api/forecasting/pipeline").get_json()
        )


class TestForecastingKpis:
    def test_predicted_revenue_matches_the_model(self, client, ctx):
        payload = client.get("/api/forecasting/kpis").get_json()
        forecast = registry.get_revenue_forecast()
        expected = round(float(forecast.predictions["revenue"].iloc[0]), 2)
        assert payload["predictedRevenue"] == expected

    def test_predicted_change_reconciles(self, client, ctx):
        payload = client.get("/api/forecasting/kpis").get_json()
        forecast = registry.get_revenue_forecast()
        last_actual = float(forecast.history["revenue"].iloc[-1])
        expected = round(
            (payload["predictedRevenue"] - last_actual) / last_actual * 100, 1
        )
        assert payload["predictedChange"] == expected

    def test_unknowable_deltas_are_null_not_invented(self, client, ctx):
        """No historical snapshot exists for either, so there is nothing to
        difference. These were random sign and random magnitude."""
        payload = client.get("/api/forecasting/kpis").get_json()
        assert payload["atRiskChange"] is None
        assert payload["accuracyChange"] is None

    def test_at_risk_count_matches_the_scored_list(self, client, ctx):
        """Customers at or above the threshold, not every customer scored.

        The count used to be the length of the whole scored list, which is
        every live customer, so the card claimed nearly the entire base was at
        risk.
        """
        payload = client.get("/api/forecasting/kpis").get_json()
        from app.routes.forecasting import get_at_risk_customers_with_scores

        scored = get_at_risk_customers_with_scores()
        expected = sum(1 for c in scored if c["riskScore"] >= payload["atRiskThreshold"])
        assert payload["atRiskCount"] == expected
        assert payload["atRiskCount"] < len(scored)

    def test_names_the_forecast_month(self, client, ctx):
        payload = client.get("/api/forecasting/kpis").get_json()
        forecast = registry.get_revenue_forecast()
        first = forecast.predictions["period"].iloc[0].start_time.strftime("%Y-%m-%d")
        assert payload["predictedMonth"] == first

    def test_is_stable_across_calls(self, client, ctx):
        assert (
            client.get("/api/forecasting/kpis").get_json()
            == client.get("/api/forecasting/kpis").get_json()
        )


class TestSeasonality:
    def test_returns_named_months(self, client, ctx):
        rows = client.get("/api/forecasting/seasonality").get_json()
        assert rows
        names = {"Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}
        assert all(r["month"] in names for r in rows)

    def test_index_averages_to_one(self, client, ctx):
        """It is a ratio against the average month, so it has to. A random
        multiplier on each month would not preserve this."""
        rows = client.get("/api/forecasting/seasonality").get_json()
        mean_index = sum(r["index"] for r in rows) / len(rows)
        assert mean_index == pytest.approx(1.0, abs=0.02)

    def test_index_reconciles_with_revenue(self, client, ctx):
        rows = client.get("/api/forecasting/seasonality").get_json()
        by_month = {}
        for t in db.session.query(Transaction).filter(
            Transaction.status == "completed"
        ).all():
            m = t.transaction_date.month
            by_month[m] = by_month.get(m, 0.0) + float(t.amount or 0)
        avg = sum(by_month.values()) / len(by_month)

        names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                 "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        for row in rows:
            month = names.index(row["month"]) + 1
            assert row["index"] == pytest.approx(by_month[month] / avg, abs=0.01)

    def test_seasonal_variation_is_visible(self, client, ctx):
        """The generator applies real monthly multipliers, so a correct index
        must show spread. Averaging transaction *size* washed this out."""
        rows = client.get("/api/forecasting/seasonality").get_json()
        indices = [r["index"] for r in rows]
        assert max(indices) - min(indices) > 0.05

    def test_trend_is_a_real_number_or_null(self, client, ctx):
        rows = client.get("/api/forecasting/seasonality").get_json()
        for row in rows:
            assert row["trend"] is None or -1.0 <= row["trend"] <= 1.0

    def test_is_stable_across_calls(self, client, ctx):
        assert (
            client.get("/api/forecasting/seasonality").get_json()
            == client.get("/api/forecasting/seasonality").get_json()
        )


@pytest.fixture()
def rows_or_skip(client, ctx):
    rows = client.get("/api/forecasting/pipeline").get_json()
    if not rows:
        pytest.skip("no open pipeline with a future close date in this dataset")
    return rows
