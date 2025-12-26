import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useFilters } from './useFilters';
import {
  dashboardApi,
  revenueApi,
  customerApi,
  operationsApi,
  forecastingApi,
} from '../services/api';
import type {
  DashboardSummary,
  RevenueTrend,
  CategoryData,
  ChannelData,
  RegionData,
  Product,
  CustomerSegment,
  CohortData,
  SalesRep,
  PipelineStage,
  ForecastDataPoint,
  ChurnRiskCustomer,
  Customer,
} from '../types';

// Dashboard hooks
export function useDashboardSummary(
  options?: Omit<UseQueryOptions<DashboardSummary>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['dashboard', 'summary', filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => dashboardApi.getSummary(filters.dateRange),
    staleTime: 30 * 1000, // 30 seconds for more responsive updates
    placeholderData: keepPreviousData,
    ...options,
  });
}

// Revenue hooks
export function useRevenueTrends(
  granularity: 'day' | 'week' | 'month' = 'day',
  options?: Omit<UseQueryOptions<RevenueTrend[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['revenue', 'trends', filters.dateRange.startDate, filters.dateRange.endDate, granularity],
    queryFn: () => revenueApi.getTrends(filters.dateRange, granularity),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useRevenueByCategory(
  options?: Omit<UseQueryOptions<CategoryData[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['revenue', 'by-category', filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => revenueApi.getByCategory(filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useRevenueByRegion(
  options?: Omit<UseQueryOptions<RegionData[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['revenue', 'by-region', filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => revenueApi.getByRegion(filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useRevenueByChannel(
  options?: Omit<UseQueryOptions<ChannelData[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['revenue', 'by-channel', filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => revenueApi.getByChannel(filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useTopProducts(
  limit = 10,
  options?: Omit<UseQueryOptions<Product[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['revenue', 'top-products', filters.dateRange.startDate, filters.dateRange.endDate, limit],
    queryFn: () => revenueApi.getTopProducts(filters.dateRange, limit),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// Customer hooks
export function useCustomerOverview(
  options?: Omit<
    UseQueryOptions<{
      total: number;
      totalChange: number;
      new: number;
      newChange: number;
      churned: number;
      churnedChange: number;
      atRisk: number;
      atRiskChange: number;
    }>,
    'queryKey' | 'queryFn'
  >
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['customers', 'overview', filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => customerApi.getOverview(filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useCustomerSegments(
  options?: Omit<UseQueryOptions<CustomerSegment[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['customers', 'segments', filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => customerApi.getSegments(filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useCustomerCohorts(
  options?: Omit<UseQueryOptions<CohortData[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['customers', 'cohorts', filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => customerApi.getCohorts(filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useAtRiskCustomers(
  limit = 10,
  options?: Omit<UseQueryOptions<Customer[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['customers', 'at-risk', limit],
    queryFn: () => customerApi.getAtRisk(limit),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// Operations hooks
export function usePipeline(
  options?: Omit<UseQueryOptions<PipelineStage[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['operations', 'pipeline', filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => operationsApi.getPipeline(filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useSalesPerformance(
  options?: Omit<UseQueryOptions<SalesRep[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['operations', 'sales-performance', filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => operationsApi.getSalesPerformance(filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useCycleTime(
  options?: Omit<UseQueryOptions<{ stage: string; avgDays: number }[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['operations', 'cycle-time', filters.dateRange.startDate],
    queryFn: () => operationsApi.getCycleTime(filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function usePipelineKpis(
  options?: Omit<
    UseQueryOptions<{
      pipelineValue: number;
      pipelineChange: number;
      avgCycleTime: number;
      cycleTimeChange: number;
      winRate: number;
      winRateChange: number;
      avgDealSize: number;
      dealSizeChange: number;
    }>,
    'queryKey' | 'queryFn'
  >
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['operations', 'pipeline-kpis', filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => operationsApi.getPipelineKpis(filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// Forecasting hooks
export function useRevenueForecast(
  periods = 6,
  options?: Omit<UseQueryOptions<ForecastDataPoint[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['forecasting', 'revenue', periods, filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => forecastingApi.getRevenueForecast(periods, filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useChurnRisk(
  limit = 10,
  options?: Omit<UseQueryOptions<ChurnRiskCustomer[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['forecasting', 'churn-risk', limit, filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => forecastingApi.getChurnRisk(limit, filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useSeasonality(
  options?: Omit<UseQueryOptions<{ month: string; index: number; trend: number }[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['forecasting', 'seasonality', filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => forecastingApi.getSeasonality(filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useForecastingKpis(
  options?: Omit<
    UseQueryOptions<{
      predictedRevenue: number;
      predictedChange: number;
      atRiskCount: number;
      atRiskChange: number;
      modelAccuracy: number;
      accuracyChange: number;
      forecastPeriod: number;
    }>,
    'queryKey' | 'queryFn'
  >
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['forecasting', 'kpis', filters.dateRange.startDate, filters.dateRange.endDate],
    queryFn: () => forecastingApi.getKpis(filters.dateRange),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}
