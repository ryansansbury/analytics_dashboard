/**
 * Response types for every endpoint the pages call.
 *
 * Each interface describes what the Flask API actually returns, checked
 * against the handlers in backend/app/routes. An earlier version declared
 * shapes the API had never sent (a `revenueTrend` on the dashboard summary, a
 * flat `confidence` on model performance), so the compiler approved code that
 * rendered `undefined` on the page. Null appears wherever the API returns null
 * for a figure it can't measure, and the UI shows a dash there, never a zero.
 */

// ============================================================================
// Filters
// ============================================================================

export type DatePresetName = 'last7d' | 'last30d' | 'last90d' | 'ytd' | 'lastYear' | 'custom';
export type Granularity = 'day' | 'week' | 'month';

export interface DateRange {
  startDate: string;
  endDate: string;
  preset?: DatePresetName;
}

export interface FilterState {
  dateRange: DateRange;
  region?: string;
  segment?: string;
  category?: string;
}

// ============================================================================
// Shared shapes
// ============================================================================

/** A headline figure and its change against the prior window of equal length. */
export interface Metric {
  value: number | null;
  previousValue?: number;
  change?: number;
  /** Null when there is no prior observation to compare against. */
  changePercent: number | null;
}

export interface SeriesPoint {
  date: string;
  value: number | null;
}

/** One bucket of a series split by a dimension: `date`, `label`, then one number per key. */
export type SplitPoint = { date: string; label: string } & Record<string, number | string>;

export interface SplitSeries {
  granularity: Granularity;
  /** Largest first over the whole window. A key's position fixes its colour. */
  keys: string[];
  points: SplitPoint[];
}

// ============================================================================
// Executive
// ============================================================================

export interface DashboardSummary {
  kpis: {
    totalRevenue: Metric;
    totalCustomers: Metric;
    totalOrders: Metric;
    avgOrderValue: Metric;
    pipelineValue: Metric;
  };
  /** One point per whole bucket of the window, for the tiles' sparklines. */
  trends: {
    revenue: SeriesPoint[];
    customers: SeriesPoint[];
    aov: SeriesPoint[];
    pipeline: SeriesPoint[];
  };
  granularity: Granularity;
  dateRange: {
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
  };
}

// ============================================================================
// Revenue
// ============================================================================

export interface ComparisonPoint {
  date: string;
  label: string;
  previousDate: string;
  previousLabel: string;
  current: number;
  previous: number;
}

export interface RevenueComparison {
  granularity: Granularity;
  points: ComparisonPoint[];
  current: number;
  previous: number;
  change: number | null;
  startDate: string;
  endDate: string;
}

export interface RegionTrends extends SplitSeries {
  totals: { region: string; revenue: number; previous: number; change: number | null }[];
}

export interface CalendarDay {
  date: string;
  week: number;
  weekday: number;
  revenue: number;
}

export interface RevenueCalendar {
  startDate: string;
  endDate: string;
  days: CalendarDay[];
  max: number;
}

export interface OrderSizeBand {
  band: string;
  min: number;
  max: number | null;
  orders: number;
  revenue: number;
  orderShare: number | null;
  revenueShare: number | null;
}

export interface CategoryData {
  category: string;
  value: number;
  percentage: number;
}

export interface ChannelData {
  channel: string;
  value: number;
  percentage: number;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  revenue: number;
  unitsSold: number;
  growth: number | null;
  avgPrice: number;
}

// ============================================================================
// Customers
// ============================================================================

export interface CustomerOverview {
  total: number;
  totalChange: number | null;
  new: number;
  newChange: number | null;
  churned: number;
  churnedScope: string;
  churnedChange: number | null;
  atRisk: number;
  atRiskThreshold: number;
  atRiskChange: number | null;
}

export interface CustomerSegment {
  segment: string;
  count: number;
  revenue: number;
  percentage: number;
}

export interface Cohort {
  cohort: string;
  label: string;
  size: number;
  /** Percent of the cohort ordering in each month after its first. Null where not reached yet. */
  retention: (number | null)[];
}

export interface LifetimeValueBand {
  range: string;
  count: number;
  percentage: number;
}

export interface ScoredCustomer {
  id: number;
  name: string;
  company: string;
  segment: string;
  lifetimeValue: number;
  annualRevenue: number;
  riskScore: number;
  daysSinceActivity: number;
  recommendation: string;
}

export interface RiskPoint {
  id: number;
  company: string;
  segment: string;
  riskScore: number;
  annualRevenue: number;
}

export interface RiskValue {
  points: RiskPoint[];
  threshold: number;
  scored: number;
  withoutRevenue: number;
}

// ============================================================================
// Operations
// ============================================================================

export interface PipelineStage {
  stage: string;
  value: number;
  count: number;
  conversionRate: number | null;
}

export interface PipelineKpis {
  pipelineValue: number;
  pipelineChange: number | null;
  openDeals: number;
  winRate: number | null;
  /** Percentage points, since win rate is already a percentage. */
  winRateChange: number | null;
  avgDealSize: number | null;
  dealSizeChange: number | null;
  avgCycleTime: number | null;
  cycleTimeChange: number | null;
  dealsWon: number;
  dealsLost: number;
}

export interface PipelineFlow {
  nodes: { name: string }[];
  links: { source: number; target: number; value: number; amount: number }[];
  created: number;
  startDate: string;
  endDate: string;
}

export interface StageDuration {
  stage: string;
  avgDays: number | null;
  count: number;
}

export interface SalesRep {
  id: number;
  name: string;
  team: string;
  region: string;
  quota: number;
  periodQuota: number;
  achieved: number;
  deals: number;
  attainment: number | null;
}

export interface PipelineOutlook {
  month: string;
  weighted: number;
  best: number;
  worst: number;
}

// ============================================================================
// Forecasting
// ============================================================================

export interface ForecastPoint {
  date: string;
  actual: number | null;
  predicted: number | null;
  /** The 80% interval. */
  lowerBound: number | null;
  upperBound: number | null;
  lower95: number | null;
  upper95: number | null;
  /** What the model predicted for a holdout month it never trained on. */
  backtest: number | null;
}

export interface ForecastKpis {
  predictedRevenue: number | null;
  predictedChange: number | null;
  predictedMonth: string | null;
  atRiskCount: number;
  atRiskThreshold: number;
  atRiskChange: number | null;
  modelAccuracy: number | null;
  accuracyChange: number | null;
  forecastPeriod: number;
}

export interface SeasonalityPoint {
  month: string;
  index: number;
  trend: number | null;
}

export interface ModelPerformance {
  available: boolean;
  reason?: string;
  accuracy?: number;
  mape?: number;
  r2Score?: number;
  rmse?: number;
  dataPoints?: string;
  revenue?: {
    model: string;
    validation: string;
    mape: number;
    naiveMape: number;
    seasonalNaiveMape: number;
    improvementOverNaive: number;
    rmse: number;
    mae: number;
    r2Score: number;
    trainMonths: number;
    holdoutMonths: number;
  };
  churn?: {
    model: string;
    label: string;
    horizonDays: number;
    cutoff: string | null;
    validation: string;
    rocAuc: number;
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    averagePrecision: number;
    brierScore: number;
    baseRate: number;
    trainRows: number;
    holdoutRows: number;
    topFeatures: Record<string, number>;
  };
}

export interface RiskTier {
  value: number;
  customers: number;
  label: string;
  threshold: string;
}

export interface RevenueAtRisk {
  highRisk: RiskTier;
  mediumRisk: RiskTier;
  lowRisk: RiskTier;
  /** High and medium together. */
  total: number;
  totalCustomers: number;
  scoredCustomers: number;
  basis: string;
}
