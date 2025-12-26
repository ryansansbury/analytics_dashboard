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

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
      new: number;
      churned: number;
      atRisk: number;
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

  getCohorts: () => fetchApi<CohortData[]>('/customers/cohorts'),

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
  getPipeline: () => fetchApi<PipelineStage[]>('/operations/pipeline'),

  getSalesPerformance: () => fetchApi<SalesRep[]>('/operations/sales-performance'),

  getConversionRates: () =>
    fetchApi<{ fromStage: string; toStage: string; rate: number }[]>(
      '/operations/conversion-rates'
    ),

  getCycleTime: () =>
    fetchApi<{ stage: string; avgDays: number }[]>('/operations/cycle-time'),

  getOpportunities: (stage?: string, limit = 20) =>
    fetchApi<PipelineOpportunity[]>(
      `/operations/opportunities${buildQueryString({ stage, limit })}`
    ),
};

// Forecasting API
export const forecastingApi = {
  getRevenueForecast: (periods = 6) =>
    fetchApi<ForecastDataPoint[]>(
      `/forecasting/revenue${buildQueryString({ periods })}`
    ),

  getPipelineForecast: () =>
    fetchApi<{ month: string; weighted: number; best: number; worst: number }[]>(
      '/forecasting/pipeline'
    ),

  getChurnRisk: (limit = 10) =>
    fetchApi<ChurnRiskCustomer[]>(
      `/forecasting/churn-risk${buildQueryString({ limit })}`
    ),

  getSeasonality: () =>
    fetchApi<{ month: string; index: number; trend: number }[]>(
      '/forecasting/seasonality'
    ),
};

// Health check
export const healthApi = {
  check: () => fetchApi<{ status: string; timestamp: string }>('/health'),
};
