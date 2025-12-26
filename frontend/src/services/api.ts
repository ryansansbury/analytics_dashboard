/**
 * API Service Layer
 *
 * Centralized API client for all backend communication. This module provides:
 * - Type-safe API functions organized by domain (dashboard, revenue, customers, etc.)
 * - Automatic error handling and JSON parsing
 * - Query string building for filter parameters
 *
 * API Base URL:
 * - Development: Uses VITE_API_URL env var or defaults to '/api'
 * - Production: Relative '/api' path (same-origin with Flask backend)
 *
 * Usage Example:
 *   const data = await revenueApi.getTrends({ startDate: '2024-01-01', endDate: '2024-12-31' });
 *
 * Error Handling:
 *   All functions throw on non-2xx responses with the error message from the server.
 */

import type {
  DashboardSummary,
  RevenueTrend,
  CategoryData,
  ChannelData,
  RegionData,
  Product,
  Customer,
  CustomerSegment,
  CohortData,
  SalesRep,
  PipelineStage,
  PipelineOpportunity,
  ForecastDataPoint,
  ChurnRiskCustomer,
  DateRange,
} from '../types';

/** Base URL for API requests - configurable via environment variable */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Generic fetch wrapper with error handling and JSON parsing
 *
 * @param endpoint - API endpoint path (e.g., '/dashboard/summary')
 * @param options - Standard fetch options (method, headers, body, etc.)
 * @returns Parsed JSON response typed as T
 * @throws Error with message from server on non-2xx response
 */
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
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

// Dashboard API
export const dashboardApi = {
  getSummary: (dateRange: DateRange) =>
    fetchApi<DashboardSummary>(
      `/dashboard/summary${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      })}`
    ),

  getKPIs: (dateRange: DateRange) =>
    fetchApi<DashboardSummary['kpis']>(
      `/dashboard/kpis${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      })}`
    ),
};

// Revenue API
export const revenueApi = {
  getTrends: (dateRange: DateRange, granularity: 'day' | 'week' | 'month' = 'day') =>
    fetchApi<RevenueTrend[]>(
      `/revenue/trends${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        granularity,
      })}`
    ),

  getByCategory: (dateRange: DateRange) =>
    fetchApi<CategoryData[]>(
      `/revenue/by-category${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      })}`
    ),

  getByRegion: (dateRange: DateRange) =>
    fetchApi<RegionData[]>(
      `/revenue/by-region${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      })}`
    ),

  getByChannel: (dateRange: DateRange) =>
    fetchApi<ChannelData[]>(
      `/revenue/by-channel${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      })}`
    ),

  getTopProducts: (dateRange: DateRange, limit = 10) =>
    fetchApi<Product[]>(
      `/revenue/top-products${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
        limit,
      })}`
    ),
};

// Customer API
export const customerApi = {
  getOverview: (dateRange: DateRange) =>
    fetchApi<{
      total: number;
      totalChange: number;
      new: number;
      newChange: number;
      churned: number;
      churnedChange: number;
      atRisk: number;
      atRiskChange: number;
    }>(
      `/customers/overview${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      })}`
    ),

  getSegments: (dateRange: DateRange) =>
    fetchApi<CustomerSegment[]>(
      `/customers/segments${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      })}`
    ),

  getCohorts: (dateRange: DateRange) =>
    fetchApi<CohortData[]>(
      `/customers/cohorts${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      })}`
    ),

  getLifetimeValue: () =>
    fetchApi<{ range: string; count: number; percentage: number }[]>(
      '/customers/lifetime-value'
    ),

  getAcquisition: (dateRange: DateRange) =>
    fetchApi<{ date: string; channel: string; count: number }[]>(
      `/customers/acquisition${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      })}`
    ),

  getAtRisk: (limit = 10) =>
    fetchApi<Customer[]>(`/customers/at-risk${buildQueryString({ limit })}`),
};

// Operations API
export const operationsApi = {
  getPipeline: (dateRange: DateRange) =>
    fetchApi<PipelineStage[]>(
      `/operations/pipeline${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      })}`
    ),

  getPipelineKpis: (dateRange: DateRange) =>
    fetchApi<{
      pipelineValue: number;
      pipelineChange: number;
      avgCycleTime: number;
      cycleTimeChange: number;
      winRate: number;
      winRateChange: number;
      avgDealSize: number;
      dealSizeChange: number;
    }>(
      `/operations/pipeline-kpis${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      })}`
    ),

  getSalesPerformance: (dateRange: DateRange) =>
    fetchApi<SalesRep[]>(
      `/operations/sales-performance${buildQueryString({
        start_date: dateRange.startDate,
        end_date: dateRange.endDate,
      })}`
    ),

  getConversionRates: () =>
    fetchApi<{ fromStage: string; toStage: string; rate: number }[]>(
      '/operations/conversion-rates'
    ),

  getCycleTime: (dateRange: DateRange) =>
    fetchApi<{ stage: string; avgDays: number }[]>(
      `/operations/cycle-time${buildQueryString({
        start_date: dateRange.startDate,
      })}`
    ),

  getOpportunities: (stage?: string, limit = 20) =>
    fetchApi<PipelineOpportunity[]>(
      `/operations/opportunities${buildQueryString({ stage, limit })}`
    ),
};

// Forecasting API
export const forecastingApi = {
  getRevenueForecast: (periods = 6, dateRange?: DateRange) =>
    fetchApi<ForecastDataPoint[]>(
      `/forecasting/revenue${buildQueryString({
        periods,
        start_date: dateRange?.startDate,
        end_date: dateRange?.endDate,
      })}`
    ),

  getPipelineForecast: (dateRange?: DateRange) =>
    fetchApi<{ month: string; weighted: number; best: number; worst: number }[]>(
      `/forecasting/pipeline${buildQueryString({
        start_date: dateRange?.startDate,
        end_date: dateRange?.endDate,
      })}`
    ),

  getChurnRisk: (limit = 10, dateRange?: DateRange) =>
    fetchApi<ChurnRiskCustomer[]>(
      `/forecasting/churn-risk${buildQueryString({
        limit,
        start_date: dateRange?.startDate,
        end_date: dateRange?.endDate,
      })}`
    ),

  getSeasonality: (dateRange?: DateRange) =>
    fetchApi<{ month: string; index: number; trend: number }[]>(
      `/forecasting/seasonality${buildQueryString({
        start_date: dateRange?.startDate,
        end_date: dateRange?.endDate,
      })}`
    ),

  getKpis: (dateRange?: DateRange) =>
    fetchApi<{
      predictedRevenue: number;
      predictedChange: number;
      atRiskCount: number;
      atRiskChange: number;
      modelAccuracy: number;
      accuracyChange: number;
      forecastPeriod: number;
    }>(
      `/forecasting/kpis${buildQueryString({
        start_date: dateRange?.startDate,
        end_date: dateRange?.endDate,
      })}`
    ),
};

// Health check
export const healthApi = {
  check: () => fetchApi<{ status: string; timestamp: string }>('/health'),
};
