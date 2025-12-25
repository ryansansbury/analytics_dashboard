// API Response Types

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

// KPI Types
export interface KPI {
  label: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  format: 'currency' | 'number' | 'percent';
  trend: 'up' | 'down' | 'neutral';
}

export interface DashboardKPIs {
  totalRevenue: KPI;
  totalCustomers: KPI;
  avgOrderValue: KPI;
  conversionRate: KPI;
  pipelineValue: KPI;
  customerGrowth: KPI;
}

// Time Series Data
export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  previousValue?: number;
}

export interface RevenueTrend {
  date: string;
  revenue: number;
  orders: number;
  previousYearRevenue?: number;
}

// Category Data
export interface CategoryData {
  category: string;
  value: number;
  percentage: number;
  color?: string;
}

export interface RegionData {
  region: string;
  revenue: number;
  customers: number;
  growth: number;
}

// Product Data
export interface Product {
  id: number;
  name: string;
  category: string;
  revenue: number;
  unitsSold: number;
  growth: number;
  avgPrice: number;
}

// Customer Data
export interface Customer {
  id: number;
  name: string;
  company: string;
  segment: 'enterprise' | 'mid-market' | 'smb';
  industry: string;
  lifetimeValue: number;
  status: 'active' | 'churned' | 'at-risk';
  acquisitionDate: string;
  region: string;
}

export interface CustomerSegment {
  segment: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface CohortData {
  cohort: string;
  month0: number;
  month1: number;
  month2: number;
  month3: number;
  month4: number;
  month5: number;
  month6: number;
  month7?: number;
  month8?: number;
  month9?: number;
  month10?: number;
  month11?: number;
}

// Sales Team Data
export interface SalesRep {
  id: number;
  name: string;
  team: string;
  region: string;
  quota: number;
  achieved: number;
  attainment: number;
  deals: number;
}

// Pipeline Data
export interface PipelineStage {
  stage: string;
  value: number;
  count: number;
  conversionRate: number;
}

export interface PipelineOpportunity {
  id: number;
  name: string;
  customer: string;
  amount: number;
  stage: string;
  probability: number;
  expectedCloseDate: string;
  salesRep: string;
}

// Forecasting Data
export interface ForecastDataPoint {
  date: string;
  actual?: number;
  predicted: number;
  lowerBound: number;
  upperBound: number;
}

export interface ChurnRiskCustomer {
  id: number;
  name: string;
  company: string;
  riskScore: number;
  lastActivity: string;
  daysSinceActivity: number;
  lifetimeValue: number;
}

// Dashboard Summary
export interface DashboardSummary {
  kpis: DashboardKPIs;
  revenueTrend: RevenueTrend[];
  revenueByCategory: CategoryData[];
  topProducts: Product[];
  pipelineSummary: PipelineStage[];
  recentCustomers: Customer[];
}

// Filter Types
export interface DateRange {
  startDate: string;
  endDate: string;
  preset?: 'last7d' | 'last30d' | 'last90d' | 'ytd' | 'lastYear' | 'custom';
}

export interface FilterState {
  dateRange: DateRange;
  region?: string;
  segment?: string;
  category?: string;
}

// Chart Props
export interface ChartProps {
  data: unknown[];
  loading?: boolean;
  height?: number;
  className?: string;
}
