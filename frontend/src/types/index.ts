/**
 * TypeScript Type Definitions
 *
 * Centralized type definitions for the Analytics Dashboard frontend.
 * These interfaces define the shape of data flowing between the API
 * and React components.
 *
 * Organization:
 * - API Types: Generic response wrappers
 * - KPI Types: Key Performance Indicator structures
 * - Time Series: Temporal data points for charts
 * - Revenue Types: Revenue breakdowns and trends
 * - Customer Types: Customer profiles and segments
 * - Sales Types: Pipeline and sales rep data
 * - Forecast Types: Predictive analytics structures
 * - Filter Types: Global filter state definitions
 * - Component Props: Shared component interfaces
 */

// ============================================================================
// API Response Types
// ============================================================================

/** Generic API response wrapper (not currently used - API returns data directly) */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

// ============================================================================
// KPI (Key Performance Indicator) Types
// ============================================================================

/**
 * Individual KPI metric with current value and period-over-period comparison
 * Used in KPICard components across all dashboard pages
 */
export interface KPI {
  label: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  format: 'currency' | 'number' | 'percent';
  trend: 'up' | 'down' | 'neutral';
}

/** Collection of KPIs displayed on the executive dashboard */
export interface DashboardKPIs {
  totalRevenue: KPI;
  totalCustomers: KPI;
  avgOrderValue: KPI;
  conversionRate: KPI;
  pipelineValue: KPI;
  customerGrowth: KPI;
}

// ============================================================================
// Time Series Data
// ============================================================================

/** Generic time series data point for line/area charts */
export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  previousValue?: number;
}

/** Revenue trend data point - used in revenue trend charts */
export interface RevenueTrend {
  date: string;
  revenue: number;
  orders: number;
}

// ============================================================================
// Revenue Breakdown Types
// ============================================================================

/** Revenue breakdown by product category (donut chart) */
export interface CategoryData {
  category: string;
  value: number;
  percentage: number;
}

/** Revenue breakdown by sales channel */
export interface ChannelData {
  channel: string;
  value: number;
  percentage: number;
}

/** Revenue breakdown by geographic region */
export interface RegionData {
  region: string;
  revenue: number;
  customers: number;
  growth: number;
}

// ============================================================================
// Product Types
// ============================================================================

/** Product performance metrics for top products table */
export interface Product {
  id: number;
  name: string;
  category: string;
  revenue: number;
  unitsSold: number;
  growth: number;
  avgPrice: number;
}

// ============================================================================
// Customer Types
// ============================================================================

/**
 * Customer profile with segmentation and lifecycle data
 * Segment tiers: enterprise (large), mid-market, smb (small business)
 * Status tracks customer health: active, at-risk (warning), churned (lost)
 */
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
  daysSinceActivity?: number;
  riskScore?: number;
}

/** Customer segment summary for segment distribution charts */
export interface CustomerSegment {
  segment: string;
  count: number;
  revenue: number;
  percentage: number;
}

/**
 * Cohort retention data - tracks customer retention over 12 months
 * Each month field (month0-month11) contains the retention percentage
 * month0 is always 100% (acquisition), subsequent months show retention
 */
export interface CohortData {
  cohort: string;
  month0: number;
  month1: number;
  month2: number;
  month3: number;
  month4: number;
  month5: number;
  month6: number;
  month7: number;
  month8: number;
  month9: number;
  month10: number;
  month11: number;
}

// ============================================================================
// Sales Team Types
// ============================================================================

/**
 * Sales representative performance metrics
 * Attainment is calculated as (achieved / quota * 100)
 */
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

// ============================================================================
// Pipeline Types
// ============================================================================

/** Sales pipeline stage summary for funnel chart */
export interface PipelineStage {
  stage: string;
  value: number;
  count: number;
  conversionRate: number;
}

/** Individual sales opportunity in the pipeline */
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

// ============================================================================
// Forecasting Types
// ============================================================================

/**
 * Forecast data point with prediction confidence bounds
 * Used in revenue forecasting chart with uncertainty visualization
 */
export interface ForecastDataPoint {
  date: string;
  actual?: number;
  predicted: number;
  lowerBound: number;
  upperBound: number;
}

/** Customer churn risk assessment for proactive retention */
export interface ChurnRiskCustomer {
  id: number;
  name: string;
  company: string;
  segment: string;
  riskScore: number;
  lastActivity?: string;
  daysSinceActivity: number;
  lifetimeValue: number;
  recommendation: string;
}

// ============================================================================
// Dashboard Summary Type
// ============================================================================

/**
 * Complete dashboard summary response
 * Contains all data needed to render the executive dashboard in one API call
 */
export interface DashboardSummary {
  kpis: DashboardKPIs;
  revenueTrend: RevenueTrend[];
  revenueByCategory: CategoryData[];
  topProducts: Product[];
  pipelineSummary: PipelineStage[];
  recentCustomers: Customer[];
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Date range selection for filtering dashboard data
 * Preset options provide quick selection (last 7 days, YTD, etc.)
 */
export interface DateRange {
  startDate: string;
  endDate: string;
  preset?: 'last7d' | 'last30d' | 'last90d' | 'ytd' | 'lastYear' | 'custom';
}

/** Global filter state shared across all dashboard pages */
export interface FilterState {
  dateRange: DateRange;
  region?: string;
  segment?: string;
  category?: string;
}

// ============================================================================
// Component Props
// ============================================================================

/** Base props shared by chart components */
export interface ChartProps {
  data: unknown[];
  loading?: boolean;
  height?: number;
  className?: string;
}
