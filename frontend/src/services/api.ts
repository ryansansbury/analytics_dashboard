/**
 * API Service Layer
 *
 * One function per endpoint the pages call, grouped by domain.
 *
 * API Base URL:
 * - Development: Uses VITE_API_URL env var or defaults to '/api'
 * - Production: Relative '/api' path (same-origin with Flask backend)
 * - Static demo: VITE_STATIC_DATA=true reads pre-generated JSON instead of the
 *   network. See services/staticData.ts. Every function below is unchanged in
 *   that mode; only the transport differs.
 *
 * The query string is the static demo's cache key, so parameter order matters
 * and must match `endpoints_for` in backend/scripts/snapshot.py. Several views
 * don't depend on the window's start and send only `end_date`, and a few send
 * nothing, so every date preset shares one snapshot file for them.
 *
 * Error Handling:
 *   All functions throw on non-2xx responses with the error message from the server.
 */

import type {
  CategoryData,
  ChannelData,
  Cohort,
  CustomerOverview,
  CustomerSegment,
  DashboardSummary,
  DateRange,
  ForecastKpis,
  ForecastPoint,
  Granularity,
  LifetimeValueBand,
  ModelPerformance,
  OrderSizeBand,
  PipelineFlow,
  PipelineKpis,
  PipelineOutlook,
  PipelineStage,
  Product,
  RegionTrends,
  RevenueAtRisk,
  RevenueCalendar,
  RevenueComparison,
  RiskValue,
  SalesRep,
  ScoredCustomer,
  SeasonalityPoint,
  SplitSeries,
  StageDuration,
} from '../types';
import { IS_STATIC, fetchStatic } from './staticData';

/**
 * Base URL for API requests - configurable via environment variable.
 *
 * Pinned in static mode: the path is the snapshot's cache key, so letting a
 * stray VITE_API_URL prepend a host would change every key and miss every file.
 */
const API_BASE = IS_STATIC ? '/api' : import.meta.env.VITE_API_URL || '/api';

/**
 * Generic fetch wrapper with error handling and JSON parsing
 *
 * The single point where the static demo diverges from the live app. Routing
 * here rather than per-function means the two modes cannot drift: any endpoint
 * added below is snapshotted by the same rule as every other.
 */
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  if (IS_STATIC) {
    return fetchStatic<T>(`${API_BASE}${endpoint}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const filtered = Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return filtered.length > 0 ? `?${filtered.join('&')}` : '';
}

/** start_date then end_date, the order every windowed endpoint uses. */
function windowed(dateRange: DateRange, extra: Record<string, string | number | undefined> = {}) {
  return buildQueryString({ start_date: dateRange.startDate, end_date: dateRange.endDate, ...extra });
}

/** Only the window's end, for views that always look back a fixed span from it. */
function ending(dateRange: DateRange) {
  return buildQueryString({ end_date: dateRange.endDate });
}

export const dashboardApi = {
  getSummary: (dateRange: DateRange) =>
    fetchApi<DashboardSummary>(`/dashboard/summary${windowed(dateRange)}`),
};

export const revenueApi = {
  getComparison: (dateRange: DateRange, granularity: Granularity) =>
    fetchApi<RevenueComparison>(`/revenue/comparison${windowed(dateRange, { granularity })}`),

  getCategoryTrends: (dateRange: DateRange, granularity: Granularity) =>
    fetchApi<SplitSeries>(`/revenue/category-trends${windowed(dateRange, { granularity })}`),

  getRegionTrends: (dateRange: DateRange, granularity: Granularity) =>
    fetchApi<RegionTrends>(`/revenue/region-trends${windowed(dateRange, { granularity })}`),

  getCalendar: (dateRange: DateRange) =>
    fetchApi<RevenueCalendar>(`/revenue/calendar${ending(dateRange)}`),

  getByCategory: (dateRange: DateRange) =>
    fetchApi<CategoryData[]>(`/revenue/by-category${windowed(dateRange)}`),

  getByChannel: (dateRange: DateRange) =>
    fetchApi<ChannelData[]>(`/revenue/by-channel${windowed(dateRange)}`),

  getOrderSizes: (dateRange: DateRange) =>
    fetchApi<OrderSizeBand[]>(`/revenue/order-sizes${windowed(dateRange)}`),

  getTopProducts: (dateRange: DateRange, limit = 10) =>
    fetchApi<Product[]>(`/revenue/top-products${windowed(dateRange, { limit })}`),
};

export const customerApi = {
  getOverview: (dateRange: DateRange) =>
    fetchApi<CustomerOverview>(`/customers/overview${windowed(dateRange)}`),

  getSegments: (dateRange: DateRange) =>
    fetchApi<CustomerSegment[]>(`/customers/segments${windowed(dateRange)}`),

  getCohorts: (dateRange: DateRange) =>
    fetchApi<Cohort[]>(`/customers/cohorts${ending(dateRange)}`),

  /** Every customer to date, so it takes no window. */
  getLifetimeValue: () =>
    fetchApi<LifetimeValueBand[]>('/customers/lifetime-value'),

  getAcquisition: (dateRange: DateRange) =>
    fetchApi<SplitSeries>(`/customers/acquisition${windowed(dateRange)}`),

  getAtRisk: (dateRange: DateRange, limit = 10) =>
    fetchApi<ScoredCustomer[]>(`/customers/at-risk${buildQueryString({
      limit,
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
    })}`),

  /** Scored as of the latest data, so it takes no window. */
  getRiskValue: () =>
    fetchApi<RiskValue>('/customers/risk-value'),
};

export const operationsApi = {
  getPipeline: (dateRange: DateRange) =>
    fetchApi<PipelineStage[]>(`/operations/pipeline${windowed(dateRange)}`),

  getPipelineKpis: (dateRange: DateRange) =>
    fetchApi<PipelineKpis>(`/operations/pipeline-kpis${windowed(dateRange)}`),

  getPipelineFlow: (dateRange: DateRange) =>
    fetchApi<PipelineFlow>(`/operations/pipeline-flow${ending(dateRange)}`),

  getSalesPerformance: (dateRange: DateRange) =>
    fetchApi<SalesRep[]>(`/operations/sales-performance${windowed(dateRange)}`),

  getCycleTime: (dateRange: DateRange) =>
    fetchApi<StageDuration[]>(`/operations/cycle-time${ending(dateRange)}`),

  getOutlook: (dateRange: DateRange) =>
    fetchApi<PipelineOutlook[]>(`/forecasting/pipeline${windowed(dateRange)}`),
};

export const forecastingApi = {
  getRevenueForecast: (dateRange: DateRange, periods = 6) =>
    fetchApi<ForecastPoint[]>(`/forecasting/revenue${buildQueryString({
      periods,
      start_date: dateRange.startDate,
      end_date: dateRange.endDate,
    })}`),

  getKpis: (dateRange: DateRange) =>
    fetchApi<ForecastKpis>(`/forecasting/kpis${windowed(dateRange)}`),

  getSeasonality: (dateRange: DateRange) =>
    fetchApi<SeasonalityPoint[]>(`/forecasting/seasonality${windowed(dateRange)}`),

  /**
   * Measured metrics for both trained models.
   *
   * The nested `revenue` and `churn` objects are the real shape. A flat
   * `confidence` field this type once declared was never returned, so the UI
   * rendered `undefined%` and TypeScript had no way to catch it.
   */
  getModelPerformance: (dateRange: DateRange) =>
    fetchApi<ModelPerformance>(`/forecasting/model-performance${windowed(dateRange)}`),

  getRevenueAtRisk: (dateRange: DateRange) =>
    fetchApi<RevenueAtRisk>(`/forecasting/revenue-at-risk${windowed(dateRange)}`),
};

export const healthApi = {
  check: () => fetchApi<{ status: string; timestamp: string }>('/health'),
};
