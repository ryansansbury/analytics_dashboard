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
    queryKey: ['dashboard', 'summary', filters.dateRange],
    queryFn: () => dashboardApi.getSummary(filters.dateRange),
    staleTime: 5 * 60 * 1000,
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
    queryKey: ['revenue', 'trends', filters.dateRange, granularity],
    queryFn: () => revenueApi.getTrends(filters.dateRange, granularity),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useRevenueByCategory(
  options?: Omit<UseQueryOptions<CategoryData[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['revenue', 'by-category', filters.dateRange],
    queryFn: () => revenueApi.getByCategory(filters.dateRange),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useRevenueByRegion(
  options?: Omit<UseQueryOptions<RegionData[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['revenue', 'by-region', filters.dateRange],
    queryFn: () => revenueApi.getByRegion(filters.dateRange),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useRevenueByChannel(
  options?: Omit<UseQueryOptions<ChannelData[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['revenue', 'by-channel', filters.dateRange],
    queryFn: () => revenueApi.getByChannel(filters.dateRange),
    staleTime: 5 * 60 * 1000,
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
    queryKey: ['revenue', 'top-products', filters.dateRange, limit],
    queryFn: () => revenueApi.getTopProducts(filters.dateRange, limit),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// Customer hooks
export function useCustomerOverview(
  options?: Omit<
    UseQueryOptions<{ total: number; new: number; churned: number; atRisk: number }>,
    'queryKey' | 'queryFn'
  >
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['customers', 'overview', filters.dateRange],
    queryFn: () => customerApi.getOverview(filters.dateRange),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useCustomerSegments(
  options?: Omit<UseQueryOptions<CustomerSegment[]>, 'queryKey' | 'queryFn'>
) {
  const { filters } = useFilters();

  return useQuery({
    queryKey: ['customers', 'segments', filters.dateRange],
    queryFn: () => customerApi.getSegments(filters.dateRange),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useCustomerCohorts(
  options?: Omit<UseQueryOptions<CohortData[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['customers', 'cohorts'],
    queryFn: () => customerApi.getCohorts(),
    staleTime: 10 * 60 * 1000,
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
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// Operations hooks
export function usePipeline(
  options?: Omit<UseQueryOptions<PipelineStage[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['operations', 'pipeline'],
    queryFn: () => operationsApi.getPipeline(),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useSalesPerformance(
  options?: Omit<UseQueryOptions<SalesRep[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['operations', 'sales-performance'],
    queryFn: () => operationsApi.getSalesPerformance(),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

// Forecasting hooks
export function useRevenueForecast(
  periods = 6,
  options?: Omit<UseQueryOptions<ForecastDataPoint[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['forecasting', 'revenue', periods],
    queryFn: () => forecastingApi.getRevenueForecast(periods),
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useChurnRisk(
  limit = 10,
  options?: Omit<UseQueryOptions<ChurnRiskCustomer[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['forecasting', 'churn-risk', limit],
    queryFn: () => forecastingApi.getChurnRisk(limit),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
}
