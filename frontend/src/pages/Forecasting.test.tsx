/**
 * The Forecasting page must not invent numbers.
 *
 * This page was the last place fabricated data survived. The backend had every
 * `random.uniform()` removed, but the page still carried a hardcoded quarterly
 * "Growth Projections" series, a hardcoded "Segment Forecast" donut, and a
 * fallback metrics object of `{accuracy: 94.2, r2Score: 0.942, confidence: 95}`
 * that rendered whenever a request failed. Later it labelled next month's
 * forecast "Predicted Revenue (6mo)" and gave a constant six-month horizon a
 * change badge computed from an unrelated figure.
 *
 * These tests pin the rule: every figure shown comes from the response, the
 * label says what the figure is, and a missing figure renders a dash rather
 * than a plausible-looking constant.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Forecasting } from './Forecasting';
import { FilterProvider } from '../hooks/useFilters';

const MODEL_PERFORMANCE = {
  available: true,
  revenue: {
    model: 'Ridge regression on trend, seasonality, quarter-end, and 2 lags',
    validation: 'chronological holdout',
    mape: 5.95,
    naiveMape: 22.02,
    seasonalNaiveMape: 20.83,
    improvementOverNaive: 73.0,
    rmse: 1210000,
    mae: 990000,
    r2Score: 0.8493,
    trainMonths: 16,
    holdoutMonths: 5,
  },
  churn: {
    model: 'Gradient-boosted classifier on RFM and account features',
    label: 'no completed order in the 90 days after the cutoff',
    horizonDays: 90,
    cutoff: '2026-08-08',
    validation: 'stratified holdout',
    rocAuc: 0.7794,
    accuracy: 0.84,
    precision: 0.6098,
    recall: 0.3205,
    f1: 0.42,
    averagePrecision: 0.5117,
    brierScore: 0.12,
    baseRate: 0.1874,
    trainRows: 1248,
    holdoutRows: 417,
    topFeatures: { recency_days: 0.2857, monetary_total: 0.2265, 'region_Asia Pacific': 0.01 },
  },
};

const FORECAST = [
  { date: '2026-09-01', actual: 23796174.59, predicted: null, lowerBound: null, upperBound: null, lower95: null, upper95: null, backtest: 23017031.12 },
  { date: '2026-10-01', actual: 20546280.63, predicted: 20546280.63, lowerBound: 20546280.63, upperBound: 20546280.63, lower95: 20546280.63, upper95: 20546280.63, backtest: 20076959.69 },
  { date: '2026-11-01', actual: null, predicted: 18789541.4, lowerBound: 17e6, upperBound: 20.5e6, lower95: 16.4e6, upper95: 21.2e6, backtest: null },
];

const KPIS = {
  predictedRevenue: 18789541.4,
  predictedChange: -8.6,
  predictedMonth: '2026-11-01',
  atRiskCount: 190,
  atRiskThreshold: 0.5,
  atRiskChange: null,
  modelAccuracy: 84,
  accuracyChange: null,
  forecastPeriod: 6,
};

const AT_RISK = {
  highRisk: { value: 5100374, customers: 136, label: 'High risk', threshold: '65% or higher' },
  mediumRisk: { value: 2196664, customers: 54, label: 'Medium risk', threshold: '50% to 65%' },
  lowRisk: { value: 190000000, customers: 1470, label: 'Low risk', threshold: 'Under 50%' },
  total: 7297039,
  totalCustomers: 190,
  scoredCustomers: 1660,
  basis: 'completed revenue in the last 12 months',
};

/** Serve each endpoint the page asks for; `failing` fails the model and forecast requests. */
function mockFetch(failing = false) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

    if (url.includes('/forecasting/model-performance')) {
      return failing ? new Response('{}', { status: 500 }) : json(MODEL_PERFORMANCE);
    }
    if (url.includes('/forecasting/revenue-at-risk')) return json(AT_RISK);
    if (url.includes('/forecasting/revenue')) return failing ? new Response('{}', { status: 500 }) : json(FORECAST);
    if (url.includes('/forecasting/kpis')) return failing ? new Response('{}', { status: 500 }) : json(KPIS);
    if (url.includes('/customers/risk-value')) {
      return json({ points: [], threshold: 0.5, scored: 1660, withoutRevenue: 0 });
    }
    return json([]);
  }) as typeof fetch;
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <FilterProvider>
        <MemoryRouter>
          <Forecasting />
        </MemoryRouter>
      </FilterProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => mockFetch());

describe('the headline figures', () => {
  it('names the month the forecast is for, not a six-month window', async () => {
    renderPage();
    expect(await screen.findByText('November forecast')).toBeInTheDocument();
    expect(screen.getByText('$18.8M')).toBeInTheDocument();
    expect(screen.queryByText(/Predicted Revenue \(6mo\)/)).not.toBeInTheDocument();
  });

  it('compares the forecast with the month before, signed', async () => {
    renderPage();
    expect(await screen.findByText('-8.6%')).toBeInTheDocument();
    expect(screen.getByText("vs October's actual revenue")).toBeInTheDocument();
  });

  it('counts only customers at or above the threshold as at risk', async () => {
    renderPage();
    expect(await screen.findByText('190')).toBeInTheDocument();
    expect(screen.queryByText('1.7K')).not.toBeInTheDocument();
  });

  it('totals revenue at risk from the high and medium tiers only', async () => {
    renderPage();
    // The tile and the tier panel's total both show it.
    expect((await screen.findAllByText('$7.3M')).length).toBe(2);
  });

  it('shows the backtest error beside its naive baseline', async () => {
    renderPage();
    const mape = `${(5.95).toFixed(1)}%`;
    expect((await screen.findAllByText(mape)).length).toBeGreaterThan(0);
    expect(screen.getByText(/Repeating last month misses by 22\.0%/)).toBeInTheDocument();
  });

  it('never renders a forecast-period badge', async () => {
    renderPage();
    await screen.findByText('November forecast');
    expect(screen.queryByText('Forecast Period')).not.toBeInTheDocument();
  });

  it('renders dashes, not constants, when the requests fail', async () => {
    mockFetch(true);
    renderPage();
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2));
    expect(screen.queryByText('94.2%')).not.toBeInTheDocument();
    expect(screen.queryByText('$18.8M')).not.toBeInTheDocument();
  });
});

describe('how the models were checked', () => {
  it('reports both models from the response', async () => {
    renderPage();
    expect(await screen.findByText('0.78')).toBeInTheDocument();
    expect(screen.getByText('19%')).toBeInTheDocument();
    expect(screen.getByText('This model')).toBeInTheDocument();
    expect(screen.getByText('Repeat last month')).toBeInTheDocument();
  });

  it('says what the churn label means and when it was cut', async () => {
    renderPage();
    expect(await screen.findByText(/as they stood on Aug 8, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/ordered in the 90 days after/)).toBeInTheDocument();
  });

  it('puts the features in words', async () => {
    renderPage();
    expect(await screen.findByText('Days since last order')).toBeInTheDocument();
    expect(screen.getByText('Region: Asia Pacific')).toBeInTheDocument();
  });
});
