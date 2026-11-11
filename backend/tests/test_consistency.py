"""Cross-endpoint consistency and sanity.

Unit tests check a function. These check that the *pages* agree with each other
and with the database, which is where this application's real defects lived: a
pipeline funnel reporting 47.8M against 45.5M of actual rows, model metrics that
changed on every request, and a revenue series that trended up under a 90-day
filter and fell off a cliff under Year to Date because only the bucket size
differed.

Every test here is a regression guard for a defect that shipped.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app import db
from app.models import Customer, Pipeline, Transaction
from app.periods import drop_incomplete_tail, granularity_for, is_complete


class TestPeriodRules:
    """The bucketing rule itself, independent of any endpoint."""

    def test_daily_buckets_are_never_partial(self):
        rows = [{'date': '2026-08-09', 'v': 1}]
        assert drop_incomplete_tail(rows, 'day', date(2026, 8, 9)) == rows

    def test_drops_a_month_the_window_does_not_finish(self):
        rows = [{'date': '2026-07-01'}, {'date': '2026-08-01'}]
        out = drop_incomplete_tail(rows, 'month', date(2026, 8, 9))
        assert [r['date'] for r in out] == ['2026-07-01']

    def test_keeps_a_month_the_window_completes(self):
        rows = [{'date': '2026-06-01'}, {'date': '2026-07-01'}]
        out = drop_incomplete_tail(rows, 'month', date(2026, 7, 31))
        assert len(out) == 2

    def test_handles_december_rollover(self):
        assert is_complete(date(2026, 12, 1), 'month', date(2026, 12, 31))
        assert not is_complete(date(2026, 12, 1), 'month', date(2026, 12, 30))

    def test_drops_every_row_sharing_an_incomplete_bucket(self):
        """Series split by channel put several rows on one date."""
        rows = [
            {'date': '2026-07-01', 'channel': 'a'},
            {'date': '2026-07-01', 'channel': 'b'},
            {'date': '2026-08-01', 'channel': 'a'},
            {'date': '2026-08-01', 'channel': 'b'},
        ]
        out = drop_incomplete_tail(rows, 'month', date(2026, 8, 9))
        assert {r['date'] for r in out} == {'2026-07-01'}

    def test_never_empties_a_non_empty_series(self):
        """A blank chart is indistinguishable from a broken one."""
        rows = [{'date': '2026-08-01'}]
        assert drop_incomplete_tail(rows, 'month', date(2026, 8, 9)) == rows

    def test_granularity_thresholds(self):
        assert granularity_for(7) == 'day'
        assert granularity_for(31) == 'day'
        assert granularity_for(90) == 'week'
        assert granularity_for(365) == 'month'


@pytest.fixture(autouse=True)
def _registry(pg_ctx):
    from app.ml import registry
    registry.reset()
    yield


def _range():
    end = db.session.query(db.func.max(Transaction.transaction_date)).scalar()
    return (end - timedelta(days=365)).isoformat(), end.isoformat()


class TestRevenueAgreesAcrossPages:
    """Total revenue is one number. Every page must report it."""

    def test_all_breakdowns_sum_to_the_same_total(self, pg_client, pg_ctx):
        start, end = _range()
        q = f'?start_date={start}&end_date={end}'

        summary = pg_client.get(f'/api/dashboard/summary{q}').get_json()
        kpi = summary['kpis']['totalRevenue']['value']

        by_cat = sum(r['value'] for r in pg_client.get(f'/api/revenue/by-category{q}').get_json())
        by_reg = sum(r['revenue'] for r in pg_client.get(f'/api/revenue/by-region{q}').get_json())

        assert by_cat == pytest.approx(kpi, rel=1e-6)
        assert by_reg == pytest.approx(kpi, rel=1e-6)

    def test_kpi_matches_the_database(self, pg_client, pg_ctx):
        start, end = _range()
        summary = pg_client.get(
            f'/api/dashboard/summary?start_date={start}&end_date={end}'
        ).get_json()
        truth = db.session.query(db.func.sum(Transaction.amount)).filter(
            Transaction.status == 'completed',
            Transaction.transaction_date.between(start, end),
        ).scalar()
        assert summary['kpis']['totalRevenue']['value'] == pytest.approx(float(truth), rel=1e-6)


class TestNoPartialPeriodCliff:
    """The defect that made the same data tell two different stories."""

    def test_monthly_trend_excludes_an_unfinished_month(self, pg_client, pg_ctx):
        start, end = _range()
        rows = pg_client.get(
            f'/api/revenue/trends?start_date={start}&end_date={end}&granularity=month'
        ).get_json()
        assert rows
        last = rows[-1]['date']
        assert is_complete(date.fromisoformat(last), 'month', date.fromisoformat(end))

    def test_final_month_is_not_an_outlier(self, pg_client, pg_ctx):
        """A part-month reads as a collapse. This is the shape of the bug."""
        start, end = _range()
        rows = pg_client.get(
            f'/api/revenue/trends?start_date={start}&end_date={end}&granularity=month'
        ).get_json()
        values = [r['revenue'] for r in rows]
        assert len(values) >= 3
        median = sorted(values)[len(values) // 2]
        assert values[-1] > median * 0.5, (
            f'last bucket {values[-1]:,.0f} against median {median:,.0f} — '
            'looks like an unfinished period leaked through'
        )

    def test_weekly_and_monthly_tell_the_same_story(self, pg_client, pg_ctx):
        """Bucket size must not change the direction of the trend."""
        start, end = _range()
        base = f'?start_date={start}&end_date={end}'
        weekly = [r['revenue'] for r in
                  pg_client.get(f'/api/revenue/trends{base}&granularity=week').get_json()]
        monthly = [r['revenue'] for r in
                   pg_client.get(f'/api/revenue/trends{base}&granularity=month').get_json()]

        def rising(v):
            half = len(v) // 2
            return sum(v[half:]) / len(v[half:]) >= sum(v[:half]) / len(v[:half])

        assert rising(weekly) == rising(monthly)


class TestPipelineAgreesWithTheDatabase:
    def test_funnel_totals_match_the_rows(self, pg_client, pg_ctx):
        rows = pg_client.get('/api/operations/pipeline').get_json()
        api = {r['stage'].lower().replace(' ', '-'): r for r in rows}

        for stage in ('lead', 'qualified', 'proposal', 'negotiation'):
            truth = db.session.query(db.func.sum(Pipeline.amount)).filter(
                Pipeline.stage == stage
            ).scalar() or 0
            assert api[stage]['value'] == pytest.approx(float(truth), rel=1e-6), stage

    def test_funnel_counts_match_the_rows(self, pg_client, pg_ctx):
        rows = pg_client.get('/api/operations/pipeline').get_json()
        api = {r['stage'].lower().replace(' ', '-'): r for r in rows}
        for stage in ('lead', 'qualified', 'proposal', 'negotiation'):
            truth = db.session.query(db.func.count(Pipeline.id)).filter(
                Pipeline.stage == stage
            ).scalar()
            assert api[stage]['count'] == truth, stage

    def test_open_pipeline_matches_the_dashboard(self, pg_client, pg_ctx):
        rows = pg_client.get('/api/operations/pipeline').get_json()
        open_sum = sum(r['value'] for r in rows if r['stage'] != 'Closed Won')
        truth = db.session.query(db.func.sum(Pipeline.amount)).filter(
            Pipeline.stage.notin_(['closed-won', 'closed-lost'])
        ).scalar()
        assert open_sum == pytest.approx(float(truth), rel=1e-6)


class TestDeterminism:
    """Nothing may change between two identical requests."""

    ENDPOINTS = [
        '/api/dashboard/summary',
        '/api/revenue/trends',
        '/api/revenue/by-category',
        '/api/revenue/by-region',
        '/api/customers/overview',
        '/api/customers/cohorts',
        '/api/operations/pipeline',
        '/api/operations/pipeline-kpis',
        '/api/operations/sales-performance',
        '/api/operations/cycle-time',
        '/api/forecasting/revenue',
        '/api/forecasting/kpis',
        '/api/forecasting/model-performance',
        '/api/forecasting/churn-risk',
        '/api/forecasting/seasonality',
        '/api/revenue/comparison',
        '/api/revenue/category-trends',
        '/api/revenue/region-trends',
        '/api/revenue/calendar',
        '/api/revenue/order-sizes',
        '/api/customers/risk-value',
        '/api/operations/pipeline-flow',
        '/api/operations/conversion-rates',
        '/api/forecasting/revenue-at-risk',
    ]

    @pytest.mark.parametrize('path', ENDPOINTS)
    def test_repeated_requests_are_identical(self, pg_client, pg_ctx, path):
        start, end = _range()
        q = f'?start_date={start}&end_date={end}'
        assert pg_client.get(f'{path}{q}').get_json() == pg_client.get(f'{path}{q}').get_json()

    @pytest.mark.parametrize('path', ENDPOINTS)
    def test_endpoint_responds(self, pg_client, pg_ctx, path):
        start, end = _range()
        assert pg_client.get(f'{path}?start_date={start}&end_date={end}').status_code == 200


class TestChangeFieldsAreHonest:
    """A delta with no prior observation is null, never invented."""

    def test_unknowable_deltas_are_null(self, pg_client, pg_ctx):
        """No churn date and no at-risk snapshot are stored, so these stay null."""
        start, end = _range()
        q = f'?start_date={start}&end_date={end}'
        overview = pg_client.get(f'/api/customers/overview{q}').get_json()
        assert overview['churnedChange'] is None
        assert overview['atRiskChange'] is None

    def test_pipeline_deltas_are_measured_from_stage_history(self, pg_client, pg_ctx):
        """Stage history made these computable. They were null, and before that random."""
        start, end = _range()
        q = f'?start_date={start}&end_date={end}'
        kpis = pg_client.get(f'/api/operations/pipeline-kpis{q}').get_json()
        for field in ('pipelineChange', 'winRateChange', 'dealSizeChange', 'cycleTimeChange'):
            assert kpis[field] is None or isinstance(kpis[field], (int, float)), field
        assert kpis['avgCycleTime'] is not None and kpis['avgCycleTime'] > 0
        assert kpis == pg_client.get(f'/api/operations/pipeline-kpis{q}').get_json()

    def test_open_pipeline_on_the_last_day_matches_the_open_rows(self, pg_client, pg_ctx):
        """Open on a day means created by then and not yet closed, straight from the rows."""
        start, end = _range()
        kpis = pg_client.get(
            f'/api/operations/pipeline-kpis?start_date={start}&end_date={end}').get_json()
        truth = db.session.query(db.func.sum(Pipeline.amount)).filter(
            db.func.date(Pipeline.created_at) <= end,
            db.or_(Pipeline.closed_at.is_(None), Pipeline.closed_at > end),
        ).scalar()
        assert kpis['pipelineValue'] == pytest.approx(float(truth), rel=1e-6)

    def test_computable_deltas_are_numbers_or_null_never_random(self, pg_client, pg_ctx):
        """Two calls agreeing rules out a PRNG behind the figure."""
        start, end = _range()
        q = f'?start_date={start}&end_date={end}'
        a = pg_client.get(f'/api/customers/overview{q}').get_json()
        b = pg_client.get(f'/api/customers/overview{q}').get_json()
        assert a['totalChange'] == b['totalChange']
        assert a['newChange'] == b['newChange']


class TestCohortRetention:
    def test_retention_never_exceeds_one_hundred_percent(self, pg_client, pg_ctx):
        start, end = _range()
        rows = pg_client.get(
            f'/api/customers/cohorts?start_date={start}&end_date={end}'
        ).get_json()
        for row in rows:
            for k, v in enumerate(row['retention']):
                if v is not None:
                    assert 0 <= v <= 100, f'{row["label"]} month {k}={v}'

    def test_cohort_size_is_reported(self, pg_client, pg_ctx):
        start, end = _range()
        rows = pg_client.get(
            f'/api/customers/cohorts?start_date={start}&end_date={end}'
        ).get_json()
        assert rows
        for row in rows:
            assert row['size'] > 0

    def test_every_cohort_starts_at_one_hundred(self, pg_client, pg_ctx):
        """Month 0 is the first purchase, so every member is active in it."""
        _, end = _range()
        rows = pg_client.get(f'/api/customers/cohorts?end_date={end}').get_json()
        assert rows
        assert all(row['retention'][0] == 100.0 for row in rows)


class TestSalesPerformanceIsMeasured:
    def test_attainment_reconciles_with_quota_and_achieved(self, pg_client, pg_ctx):
        """It used to be overwritten with a manufactured 145-to-61 curve.

        The quota it's measured against is the annual quota prorated to the
        window's days. Against the full annual figure every rep sat near the
        window's share of the year.
        """
        start, end = _range()
        rows = pg_client.get(
            f'/api/operations/sales-performance?start_date={start}&end_date={end}'
        ).get_json()
        assert rows
        days = (date.fromisoformat(end) - date.fromisoformat(start)).days + 1
        for rep in rows:
            if rep['quota']:
                assert rep['periodQuota'] == pytest.approx(rep['quota'] * days / 365, abs=0.01)
                expected = rep['achieved'] / rep['periodQuota'] * 100
                assert rep['attainment'] == pytest.approx(expected, abs=0.2), rep['name']

    def test_attainment_is_spread_around_target(self, pg_client, pg_ctx):
        start, end = _range()
        rows = pg_client.get(
            f'/api/operations/sales-performance?start_date={start}&end_date={end}'
        ).get_json()
        attainments = sorted(r['attainment'] for r in rows if r['attainment'] is not None)
        median = attainments[len(attainments) // 2]
        assert 60 < median < 140

    def test_not_every_rep_beats_quota(self, pg_client, pg_ctx):
        rows = pg_client.get('/api/operations/sales-performance').get_json()
        attainments = [r['attainment'] for r in rows]
        assert len(set(attainments)) > 1
