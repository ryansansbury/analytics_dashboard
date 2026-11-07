/**
 * Data hooks, one per endpoint, each keyed on exactly the parameters its
 * request sends.
 *
 * A view that looks back a fixed span from the window's end (the calendar, the
 * cohort table, the pipeline flow) keys on the end date alone, so switching
 * presets that share an end date reuses the cached response instead of
 * refetching an identical one.
 */

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useFilters } from './useFilters';
import {
  dashboardApi,
  revenueApi,
  customerApi,
  operationsApi,
  forecastingApi,
} from '../services/api';
import type { DatePresetName, Granularity } from '../types';

const LIVE = { staleTime: 30 * 1000, placeholderData: keepPreviousData };

/**
 * Bucket size for a preset: days up to a month, weeks for a quarter, months
 * beyond. The backend applies the same thresholds when no granularity is
 * sent, so a chart and its query can't disagree about what a point is.
 */
export function granularityFor(preset?: DatePresetName): Granularity {
  switch (preset) {
    case 'last7d':
    case 'last30d':
      return 'day';
    case 'last90d':
      return 'week';
    default:
      return 'month';
  }
}

function useWindow() {
  const { filters } = useFilters();
  const range = filters.dateRange;
  return { range, granularity: granularityFor(range.preset) };
}

// ============================================================================
// Executive
// ============================================================================

export function useDashboardSummary() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['dashboard', 'summary', range.startDate, range.endDate],
    queryFn: () => dashboardApi.getSummary(range),
    ...LIVE,
  });
}

// ============================================================================
// Revenue
// ============================================================================

export function useRevenueComparison() {
  const { range, granularity } = useWindow();
  return useQuery({
    queryKey: ['revenue', 'comparison', range.startDate, range.endDate, granularity],
    queryFn: () => revenueApi.getComparison(range, granularity),
    ...LIVE,
  });
}

export function useCategoryTrends() {
  const { range, granularity } = useWindow();
  return useQuery({
    queryKey: ['revenue', 'category-trends', range.startDate, range.endDate, granularity],
    queryFn: () => revenueApi.getCategoryTrends(range, granularity),
    ...LIVE,
  });
}

export function useRegionTrends() {
  const { range, granularity } = useWindow();
  return useQuery({
    queryKey: ['revenue', 'region-trends', range.startDate, range.endDate, granularity],
    queryFn: () => revenueApi.getRegionTrends(range, granularity),
    ...LIVE,
  });
}

export function useRevenueCalendar() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['revenue', 'calendar', range.endDate],
    queryFn: () => revenueApi.getCalendar(range),
    ...LIVE,
  });
}

export function useRevenueByCategory() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['revenue', 'by-category', range.startDate, range.endDate],
    queryFn: () => revenueApi.getByCategory(range),
    ...LIVE,
  });
}

export function useRevenueByChannel() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['revenue', 'by-channel', range.startDate, range.endDate],
    queryFn: () => revenueApi.getByChannel(range),
    ...LIVE,
  });
}

export function useOrderSizes() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['revenue', 'order-sizes', range.startDate, range.endDate],
    queryFn: () => revenueApi.getOrderSizes(range),
    ...LIVE,
  });
}

export function useTopProducts(limit = 10) {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['revenue', 'top-products', range.startDate, range.endDate, limit],
    queryFn: () => revenueApi.getTopProducts(range, limit),
    ...LIVE,
  });
}

// ============================================================================
// Customers
// ============================================================================

export function useCustomerOverview() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['customers', 'overview', range.startDate, range.endDate],
    queryFn: () => customerApi.getOverview(range),
    ...LIVE,
  });
}

export function useCustomerSegments() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['customers', 'segments', range.startDate, range.endDate],
    queryFn: () => customerApi.getSegments(range),
    ...LIVE,
  });
}

export function useCohorts() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['customers', 'cohorts', range.endDate],
    queryFn: () => customerApi.getCohorts(range),
    ...LIVE,
  });
}

export function useLifetimeValue() {
  return useQuery({
    queryKey: ['customers', 'lifetime-value'],
    queryFn: () => customerApi.getLifetimeValue(),
    ...LIVE,
  });
}

export function useCustomerAcquisition() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['customers', 'acquisition', range.startDate, range.endDate],
    queryFn: () => customerApi.getAcquisition(range),
    ...LIVE,
  });
}

export function useAtRiskCustomers(limit = 10) {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['customers', 'at-risk', limit, range.startDate, range.endDate],
    queryFn: () => customerApi.getAtRisk(range, limit),
    ...LIVE,
  });
}

export function useRiskValue() {
  return useQuery({
    queryKey: ['customers', 'risk-value'],
    queryFn: () => customerApi.getRiskValue(),
    ...LIVE,
  });
}

// ============================================================================
// Operations
// ============================================================================

export function usePipeline() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['operations', 'pipeline', range.startDate, range.endDate],
    queryFn: () => operationsApi.getPipeline(range),
    ...LIVE,
  });
}

export function usePipelineKpis() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['operations', 'pipeline-kpis', range.startDate, range.endDate],
    queryFn: () => operationsApi.getPipelineKpis(range),
    ...LIVE,
  });
}

export function usePipelineFlow() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['operations', 'pipeline-flow', range.endDate],
    queryFn: () => operationsApi.getPipelineFlow(range),
    ...LIVE,
  });
}

export function useSalesPerformance() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['operations', 'sales-performance', range.startDate, range.endDate],
    queryFn: () => operationsApi.getSalesPerformance(range),
    ...LIVE,
  });
}

export function useCycleTime() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['operations', 'cycle-time', range.endDate],
    queryFn: () => operationsApi.getCycleTime(range),
    ...LIVE,
  });
}

export function usePipelineOutlook() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['operations', 'outlook', range.startDate, range.endDate],
    queryFn: () => operationsApi.getOutlook(range),
    ...LIVE,
  });
}

// ============================================================================
// Forecasting
// ============================================================================

export function useRevenueForecast() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['forecasting', 'revenue', range.startDate, range.endDate],
    queryFn: () => forecastingApi.getRevenueForecast(range),
    ...LIVE,
  });
}

export function useForecastingKpis() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['forecasting', 'kpis', range.startDate, range.endDate],
    queryFn: () => forecastingApi.getKpis(range),
    ...LIVE,
  });
}

export function useSeasonality() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['forecasting', 'seasonality', range.startDate, range.endDate],
    queryFn: () => forecastingApi.getSeasonality(range),
    ...LIVE,
  });
}

export function useModelPerformance() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['forecasting', 'model-performance', range.startDate, range.endDate],
    queryFn: () => forecastingApi.getModelPerformance(range),
    ...LIVE,
  });
}

export function useRevenueAtRisk() {
  const { range } = useWindow();
  return useQuery({
    queryKey: ['forecasting', 'revenue-at-risk', range.startDate, range.endDate],
    queryFn: () => forecastingApi.getRevenueAtRisk(range),
    ...LIVE,
  });
}
