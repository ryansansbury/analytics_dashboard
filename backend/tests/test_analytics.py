"""Tests for the calculations behind the newer charts.

The first half calls the pure functions in `app.analytics` with a handful of
hand-made rows, where the right answer can be worked out on paper. The second
half calls the endpoints on the SQLite fixture and reconciles what they return
with the database, because a chart that disagrees with the rows under it is the
defect this project keeps guarding against.
"""

from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import pytest

from app import analytics as A


def orders(*rows):
    """(day, amount, customer, region, channel, category) tuples as an orders frame."""
    return A.orders_frame(list(rows))


# --------------------------------------------------------------------------- buckets


class TestBuckets:
    def test_a_partial_first_week_is_dropped(self):
        # Thursday 2026-08-06 to Sunday 2026-08-30.
        buckets = A.complete_buckets(date(2026, 8, 6), date(2026, 8, 30), 'week')
        assert buckets[0] == date(2026, 8, 10)  # the first whole Monday
        assert buckets[-1] == date(2026, 8, 24)
        assert all(b.weekday() == 0 for b in buckets)

    def test_a_partial_last_week_is_dropped(self):
        buckets = A.complete_buckets(date(2026, 8, 3), date(2026, 8, 22), 'week')
        assert buckets == [date(2026, 8, 3), date(2026, 8, 10)]

    def test_partial_months_are_dropped_at_both_ends(self):
        buckets = A.complete_buckets(date(2025, 11, 6), date(2026, 11, 6), 'month')
        assert buckets[0] == date(2025, 12, 1)
        assert buckets[-1] == date(2026, 10, 1)
        assert len(buckets) == 11

    def test_days_cover_the_whole_window(self):
        buckets = A.complete_buckets(date(2026, 10, 30), date(2026, 11, 6), 'day')
        assert len(buckets) == 8
        assert buckets[0] == date(2026, 10, 30) and buckets[-1] == date(2026, 11, 6)

    def test_a_window_shorter_than_a_bucket_still_returns_one(self):
        assert len(A.complete_buckets(date(2026, 11, 2), date(2026, 11, 6), 'month')) == 1

    def test_year_earlier_keeps_the_weekday(self):
        weeks = [date(2026, 8, 3), date(2026, 8, 10)]
        prior = A.year_earlier(weeks, 'week')
        assert all(p.weekday() == 0 for p in prior)
        assert prior[0] == date(2025, 8, 4)

    def test_year_earlier_months(self):
        assert A.year_earlier([date(2026, 1, 1), date(2026, 10, 1)], 'month') == [
            date(2025, 1, 1), date(2025, 10, 1)]

    def test_prior_window_has_the_same_length(self):
        start, end = date(2026, 8, 8), date(2026, 11, 6)
        prev_start, prev_end = A.prior_window(start, end)
        assert prev_end == start - timedelta(days=1)
        assert (prev_end - prev_start).days == (end - start).days

    def test_labels_are_words(self):
        assert A.label_bucket(date(2026, 3, 1), 'month') == 'Mar 2026'
        assert A.label_bucket(date(2026, 3, 2), 'week') == 'Mar 2'


# --------------------------------------------------------------------------- revenue


class TestRevenueCalculations:
    def test_comparison_lines_up_each_bucket_with_its_year_earlier_twin(self):
        cur = orders((date(2026, 8, 3), 100.0, 1, 'NA', 'direct', 'A'),
                     (date(2026, 8, 12), 50.0, 2, 'NA', 'direct', 'A'))
        prev = orders((date(2025, 8, 4), 80.0, 1, 'NA', 'direct', 'A'))
        buckets = [date(2026, 8, 3), date(2026, 8, 10)]
        rows = A.revenue_comparison(cur, prev, buckets, A.year_earlier(buckets, 'week'), 'week')
        assert [(r['current'], r['previous']) for r in rows] == [(100.0, 80.0), (50.0, 0.0)]
        assert rows[0]['previousDate'] == '2025-08-04'

    def test_split_series_names_the_top_and_folds_the_rest(self):
        day = date(2026, 8, 3)
        frame = orders(*[(day, float(v), 1, 'NA', 'direct', c)
                         for c, v in [('A', 60), ('B', 50), ('C', 40), ('D', 30), ('E', 20), ('F', 10)]])
        out = A.split_series(frame, [day], 'day', 'category', top=3)
        assert out['keys'] == ['A', 'B', 'C', 'Other']
        assert out['points'][0]['Other'] == 60.0
        assert sum(out['points'][0][k] for k in out['keys']) == 210.0

    def test_split_series_keeps_every_key_when_one_more_would_be_other(self):
        day = date(2026, 8, 3)
        frame = orders(*[(day, 10.0, 1, 'NA', 'direct', c) for c in 'ABCD'])
        assert A.split_series(frame, [day], 'day', 'category', top=3)['keys'] == list('ABCD')

    def test_calendar_opens_on_a_monday_and_stops_at_the_end(self):
        end = date(2026, 11, 6)  # a Friday
        frame = orders((end, 25.0, 1, 'NA', 'direct', 'A'))
        days = A.daily_calendar(frame, end)
        assert date.fromisoformat(days[0]['date']).weekday() == 0
        assert days[-1]['date'] == '2026-11-06'
        assert days[-1]['revenue'] == 25.0
        assert days[-1]['week'] == 52
        assert len(days) == 52 * 7 + 5

    def test_size_bands_cover_every_order(self):
        bands = A.size_distribution([500.0, 1500.0, 3000.0, 7000.0, 12000.0, 30000.0, 90000.0])
        assert [b['orders'] for b in bands] == [1, 1, 1, 1, 1, 1, 1]
        assert sum(b['orderShare'] for b in bands) == pytest.approx(100, abs=0.5)
        assert sum(b['revenueShare'] for b in bands) == pytest.approx(100, abs=0.5)
        assert bands[0]['band'] == 'Under $1K' and bands[-1]['band'] == '$50K and up'


# --------------------------------------------------------------------------- customers


class TestCohorts:
    def purchases(self, rows):
        return pd.DataFrame(rows, columns=['customer_id', 'day'])

    def test_month_zero_is_always_one_hundred(self):
        frame = self.purchases([
            (1, date(2026, 6, 20)), (1, date(2026, 7, 2)),
            (2, date(2026, 6, 3)),
            (3, date(2026, 7, 15)), (3, date(2026, 8, 1)), (3, date(2026, 9, 9)),
        ])
        rows = A.cohort_retention(frame, date(2026, 11, 6))
        assert [r['retention'][0] for r in rows] == [100.0, 100.0]

    def test_later_months_are_measured(self):
        frame = self.purchases([
            (1, date(2026, 6, 20)), (1, date(2026, 7, 2)),
            (2, date(2026, 6, 3)), (2, date(2026, 8, 3)),
        ])
        june = A.cohort_retention(frame, date(2026, 11, 6))[0]
        assert june['label'] == 'Jun 2026' and june['size'] == 2
        assert june['retention'][1:3] == [50.0, 50.0]
        assert june['retention'][3] == 0.0

    def test_months_not_yet_reached_are_null_and_the_current_month_is_excluded(self):
        frame = self.purchases([(1, date(2026, 9, 10)), (1, date(2026, 11, 2))])
        sept = A.cohort_retention(frame, date(2026, 11, 6))[0]
        # September and October are whole months; November is still running.
        assert sept['retention'][:2] == [100.0, 0.0]
        assert all(v is None for v in sept['retention'][2:])

    def test_at_most_twelve_cohorts(self):
        rows = [(i, date(2024, 1, 1) + timedelta(days=31 * i)) for i in range(30)]
        assert len(A.cohort_retention(self.purchases(rows), date(2026, 11, 6))) == 12


# --------------------------------------------------------------------------- pipeline


def opp(created, amount, history, closed=None, stage=None):
    return {
        'id': id(history), 'amount': amount, 'created': created, 'closed': closed,
        'stage': stage or history[-1][0], 'history': history,
    }


D = date(2026, 1, 1)
DEALS = [
    # won after 40 days, closed in March
    opp(D, 100.0, [('lead', D), ('qualified', D + timedelta(5)), ('proposal', D + timedelta(15)),
                   ('negotiation', D + timedelta(30)), ('closed-won', D + timedelta(70))],
        closed=D + timedelta(70)),
    # lost at proposal in March
    opp(D, 50.0, [('lead', D), ('qualified', D + timedelta(10)), ('proposal', D + timedelta(20)),
                  ('closed-lost', D + timedelta(65))], closed=D + timedelta(65)),
    # still open at negotiation
    opp(D + timedelta(30), 70.0, [('lead', D + timedelta(30)), ('qualified', D + timedelta(40)),
                                  ('proposal', D + timedelta(50)), ('negotiation', D + timedelta(60))]),
]


class TestPipelineCalculations:
    def test_win_rate_is_won_over_closed_in_the_window(self):
        k = A.pipeline_kpis(DEALS, date(2026, 3, 1), date(2026, 3, 31))
        assert k['winRate'] == 50.0
        assert k['avgDealSize'] == 100.0
        assert k['avgCycleTime'] == 70.0
        assert (k['dealsWon'], k['dealsLost']) == (1, 1)

    def test_nothing_closed_means_null_not_zero(self):
        k = A.pipeline_kpis(DEALS, date(2026, 1, 1), date(2026, 1, 31))
        assert k['winRate'] is None and k['avgCycleTime'] is None and k['avgDealSize'] is None

    def test_open_value_follows_the_history(self):
        assert A.open_value_on(DEALS, date(2026, 2, 1)) == 220.0
        assert A.open_value_on(DEALS, date(2026, 3, 31)) == 70.0

    def test_pipeline_change_compares_the_two_window_ends(self):
        k = A.pipeline_kpis(DEALS, date(2026, 3, 1), date(2026, 3, 31))
        before = A.open_value_on(DEALS, date(2026, 2, 28))
        assert k['pipelineChange'] == round((70.0 - before) / before * 100, 1)

    def test_flow_conserves_deals(self):
        flow = A.pipeline_flow(DEALS, date(2026, 6, 30))
        out_of = lambda n: sum(l['value'] for l in flow['links'] if l['source'] == n)  # noqa: E731
        into = lambda n: sum(l['value'] for l in flow['links'] if l['target'] == n)  # noqa: E731
        assert out_of(0) == flow['created'] == 3
        for middle in (1, 2, 3):
            assert into(middle) == out_of(middle)
        assert into(4) == 1 and into(5) == 1 and into(6) == 1

    def test_stage_durations(self):
        rows = {r['stage']: r for r in A.stage_durations(DEALS, date(2026, 6, 30))}
        assert rows['Lead']['avgDays'] == 8.3  # (5 + 10 + 10) over 3, to one decimal
        assert rows['Negotiation']['avgDays'] == 40.0

    def test_stage_conversion_ignores_deals_still_in_the_stage(self):
        rows = {r['fromStage']: r for r in A.stage_conversion(DEALS, date(2026, 6, 30))}
        assert rows['Proposal']['rate'] == 66.7  # two advanced, one lost
        assert rows['Negotiation']['rate'] == 100.0  # the open deal hasn't left yet
        assert rows['Negotiation']['toStage'] == 'Won'

    def test_quota_is_prorated_by_days(self):
        assert A.prorated(365_000, date(2026, 1, 1), date(2026, 1, 10)) == pytest.approx(10_000)


# --------------------------------------------------------------------------- endpoints


def _window(days=90):
    from app import db
    from app.models import Transaction

    end = db.session.query(db.func.max(Transaction.transaction_date)).scalar()
    return end - timedelta(days=days), end


def _revenue(start, end):
    from app import db
    from app.models import Transaction

    return float(db.session.query(db.func.sum(Transaction.amount)).filter(
        Transaction.transaction_date.between(start, end),
        Transaction.status == 'completed',
    ).scalar() or 0)


def _q(start, end, **extra):
    q = f'?start_date={start.isoformat()}&end_date={end.isoformat()}'
    return q + ''.join(f'&{k}={v}' for k, v in extra.items())


class TestEndpointsReconcile:
    def test_summary_trends_line_up(self, client, ctx):
        start, end = _window()
        body = client.get(f'/api/dashboard/summary{_q(start, end)}').get_json()
        lengths = {len(v) for v in body['trends'].values()}
        assert len(lengths) == 1 and lengths.pop() > 1
        assert body['kpis']['totalRevenue']['value'] == pytest.approx(_revenue(start, end), rel=1e-9)
        sparkline = sum(p['value'] for p in body['trends']['revenue'])
        assert sparkline <= body['kpis']['totalRevenue']['value'] + 0.01

    def test_comparison_sums_match_the_database(self, client, ctx):
        start, end = _window()
        body = client.get(f'/api/revenue/comparison{_q(start, end, granularity="week")}').get_json()
        first = date.fromisoformat(body['startDate'])
        last = date.fromisoformat(body['endDate'])
        assert first.weekday() == 0 and last.weekday() == 6
        assert body['current'] == pytest.approx(_revenue(first, last), rel=1e-9)
        assert body['previous'] == pytest.approx(
            _revenue(first - timedelta(days=364), last - timedelta(days=364)), rel=1e-9)

    def test_category_trends_add_up(self, client, ctx):
        start, end = _window()
        body = client.get(f'/api/revenue/category-trends{_q(start, end, granularity="week")}').get_json()
        assert len(body['keys']) <= 6
        total = sum(p[k] for p in body['points'] for k in body['keys'])
        first = date.fromisoformat(body['points'][0]['date'])
        last = date.fromisoformat(body['points'][-1]['date']) + timedelta(days=6)
        assert total == pytest.approx(_revenue(first, last), rel=1e-6)

    def test_region_totals_match_their_series(self, client, ctx):
        start, end = _window(365)
        body = client.get(f'/api/revenue/region-trends{_q(start, end, granularity="month")}').get_json()
        for row in body['totals']:
            assert row['revenue'] == pytest.approx(
                sum(p[row['region']] for p in body['points']), rel=1e-6)

    def test_calendar_covers_whole_weeks(self, client, ctx):
        start, end = _window()
        body = client.get(f'/api/revenue/calendar?end_date={end.isoformat()}').get_json()
        first = date.fromisoformat(body['startDate'])
        assert first.weekday() == 0 and body['days'][-1]['date'] == end.isoformat()
        assert sum(d['revenue'] for d in body['days']) == pytest.approx(_revenue(first, end), rel=1e-6)

    def test_order_sizes_count_every_order(self, client, ctx):
        from app import db
        from app.models import Transaction

        start, end = _window()
        bands = client.get(f'/api/revenue/order-sizes{_q(start, end)}').get_json()
        count = db.session.query(db.func.count(Transaction.id)).filter(
            Transaction.transaction_date.between(start, end), Transaction.status == 'completed').scalar()
        assert sum(b['orders'] for b in bands) == count

    def test_cohorts_start_at_one_hundred(self, client, ctx):
        start, end = _window()
        rows = client.get(f'/api/customers/cohorts?end_date={end.isoformat()}').get_json()
        assert 0 < len(rows) <= 12
        for row in rows:
            assert row['size'] > 0
            assert row['retention'][0] == 100.0
            seen = [v for v in row['retention'] if v is not None]
            assert all(0 <= v <= 100 for v in seen)
            # Nulls only at the end, never in the middle.
            assert row['retention'][:len(seen)] == seen

    def test_risk_value_points(self, client, ctx):
        body = client.get('/api/customers/risk-value').get_json()
        assert body['points']
        assert len(body['points']) + body['withoutRevenue'] == body['scored']
        assert all(0 <= p['riskScore'] <= 1 and p['annualRevenue'] > 0 for p in body['points'])

    def test_overview_counts_only_customers_at_risk(self, client, ctx):
        from app.routes.forecasting import get_at_risk_customers_with_scores

        start, end = _window()
        body = client.get(f'/api/customers/overview{_q(start, end)}').get_json()
        scored = get_at_risk_customers_with_scores()
        assert body['atRisk'] == sum(1 for c in scored if c['riskScore'] >= 0.5)
        assert body['atRisk'] < len(scored)

    def test_pipeline_kpis_match_the_rows(self, client, ctx):
        from app import db
        from app.models import Pipeline

        start, end = _window()
        body = client.get(f'/api/operations/pipeline-kpis{_q(start, end)}').get_json()
        won = db.session.query(db.func.count(Pipeline.id)).filter(
            Pipeline.stage == 'closed-won', Pipeline.closed_at.between(start, end)).scalar()
        lost = db.session.query(db.func.count(Pipeline.id)).filter(
            Pipeline.stage == 'closed-lost', Pipeline.closed_at.between(start, end)).scalar()
        assert (body['dealsWon'], body['dealsLost']) == (won, lost)
        assert body['winRate'] == pytest.approx(100 * won / (won + lost), abs=0.05)
        assert body['avgCycleTime'] > 0

    def test_pipeline_flow_counts_each_deal_once(self, client, ctx):
        start, end = _window()
        body = client.get(f'/api/operations/pipeline-flow?end_date={end.isoformat()}').get_json()
        out_of_lead = sum(l['value'] for l in body['links'] if l['source'] == 0)
        outcomes = sum(l['value'] for l in body['links'] if l['target'] in (4, 5, 6))
        assert out_of_lead == body['created']
        assert outcomes == body['created']

    def test_cycle_time_comes_from_history(self, client, ctx):
        start, end = _window()
        rows = client.get(f'/api/operations/cycle-time?end_date={end.isoformat()}').get_json()
        assert [r['stage'] for r in rows] == ['Lead', 'Qualified', 'Proposal', 'Negotiation']
        assert all(r['avgDays'] and r['avgDays'] > 0 for r in rows)

    def test_attainment_uses_the_prorated_quota(self, client, ctx):
        start, end = _window()
        reps = client.get(f'/api/operations/sales-performance{_q(start, end)}').get_json()
        days = (end - start).days + 1
        for rep in reps:
            assert rep['periodQuota'] == pytest.approx(rep['quota'] * days / 365, abs=0.01)
            if rep['attainment'] is not None:
                assert rep['attainment'] == pytest.approx(
                    rep['achieved'] / rep['periodQuota'] * 100, abs=0.06)
