import { DollarSign, Users, TrendingUp, ShoppingCart, Target, Activity } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard, KPIGrid } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { AreaChart } from '../components/charts/AreaChart';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/PieChart';
import { FunnelChart } from '../components/charts/FunnelChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency, CHART_COLORS } from '../utils/formatters';
import {
  useDashboardSummary,
  useRevenueTrends,
  useRevenueByCategory,
  usePipeline,
  useTopProducts,
} from '../hooks/useApi';
import { useFilters } from '../hooks/useFilters';

// Determine appropriate granularity based on date range
function getGranularity(preset?: string): 'day' | 'week' | 'month' {
  switch (preset) {
    case 'last7d':
    case 'last30d':
      return 'day';
    case 'last90d':
      return 'week';
    case 'ytd':
    case 'lastYear':
    default:
      return 'month';
  }
}

// Get proper adjective form for granularity
function getGranularityLabel(granularity: 'day' | 'week' | 'month'): string {
  switch (granularity) {
    case 'day':
      return 'Daily';
    case 'week':
      return 'Weekly';
    case 'month':
      return 'Monthly';
  }
}

export function Dashboard() {
  const { filters } = useFilters();

  // Determine granularity based on date range
  const granularity = getGranularity(filters.dateRange.preset);

  // Fetch data from API
  const { data: summaryData, isLoading: summaryLoading } = useDashboardSummary();
  const { data: revenueTrends, isLoading: trendsLoading } = useRevenueTrends(granularity);
  const { data: categoryData, isLoading: categoryLoading } = useRevenueByCategory();
  const { data: pipelineData, isLoading: pipelineLoading } = usePipeline();
  const { data: topProducts, isLoading: productsLoading } = useTopProducts(5);

  // Transform data for charts
  const kpis = summaryData?.kpis || {
    totalRevenue: { value: 0, changePercent: 0 },
    totalCustomers: { value: 0, changePercent: 0 },
    avgOrderValue: { value: 0, changePercent: 0 },
    pipelineValue: { value: 0, changePercent: 0 },
  };

  const trendData = (revenueTrends || []).map(item => ({
    date: item.date,
    revenue: item.revenue,
    orders: item.orders,
  }));

  const chartCategoryData = (categoryData || []).map(item => ({
    category: item.category,
    value: item.value,
    percentage: item.percentage,
  }));

  const funnelData = (pipelineData || []).map((item, index, arr) => ({
    stage: item.stage,
    value: item.value,
    count: item.count,
    conversionRate: index === 0 ? 100 : Math.round((item.count / arr[0].count) * 100),
  }));

  const productTableData = (topProducts || []).map((item) => ({
    id: item.id,
    name: item.name,
    revenue: item.revenue,
    units: item.unitsSold,
  }));

  return (
    <div className="min-h-screen">
      <Header
        title="Executive Dashboard"
        subtitle={`Data from ${filters.dateRange.startDate} to ${filters.dateRange.endDate}`}
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <KPIGrid>
          <KPICard
            label="Total Revenue"
            value={kpis.totalRevenue?.value || 0}
            changePercent={kpis.totalRevenue?.changePercent || 0}
            format="currency"
            icon={<DollarSign className="h-5 w-5" />}
            loading={summaryLoading}
          />
          <KPICard
            label="Total Customers"
            value={kpis.totalCustomers?.value || 0}
            changePercent={kpis.totalCustomers?.changePercent || 0}
            format="number"
            icon={<Users className="h-5 w-5" />}
            loading={summaryLoading}
          />
          <KPICard
            label="Avg Order Value"
            value={kpis.avgOrderValue?.value || 0}
            changePercent={kpis.avgOrderValue?.changePercent || 0}
            format="currency"
            icon={<ShoppingCart className="h-5 w-5" />}
            loading={summaryLoading}
          />
          <KPICard
            label="Conversion Rate"
            value={3.2}
            changePercent={0.4}
            format="percent"
            icon={<Target className="h-5 w-5" />}
            loading={summaryLoading}
          />
          <KPICard
            label="Pipeline Value"
            value={kpis.pipelineValue?.value || 0}
            changePercent={kpis.pipelineValue?.changePercent || 0}
            format="currency"
            icon={<TrendingUp className="h-5 w-5" />}
            loading={summaryLoading}
          />
          <KPICard
            label="Growth Rate"
            value={kpis.totalRevenue?.changePercent || 0}
            changePercent={0}
            format="percent"
            icon={<Activity className="h-5 w-5" />}
            loading={summaryLoading}
          />
        </KPIGrid>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard
            title="Revenue Trend"
            subtitle={`${getGranularityLabel(granularity)} revenue over the selected period`}
            className="lg:col-span-2"
            loading={trendsLoading}
          >
            <AreaChart
              data={trendData}
              xKey="date"
              yKeys={['revenue']}
              labels={{ revenue: 'Revenue' }}
              height={320}
            />
          </ChartCard>

          <ChartCard
            title="Revenue by Category"
            subtitle="Distribution by product category"
            loading={categoryLoading}
          >
            <DonutChart
              data={chartCategoryData}
              nameKey="category"
              valueKey="value"
              height={320}
            />
          </ChartCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Sales Pipeline"
            subtitle="Opportunity value by stage"
            loading={pipelineLoading}
          >
            <FunnelChart data={funnelData} height={320} />
          </ChartCard>

          <ChartCard
            title="Top Products"
            subtitle="Best performing products by revenue"
            loading={productsLoading}
          >
            <DataTable
              data={productTableData}
              keyExtractor={(row) => row.id}
              columns={[
                { key: 'name', header: 'Product', sortable: true },
                {
                  key: 'revenue',
                  header: 'Revenue',
                  sortable: true,
                  align: 'right',
                  render: (value) => formatCurrency(value as number, true),
                },
                {
                  key: 'units',
                  header: 'Units',
                  sortable: true,
                  align: 'right',
                  render: (value) => (value as number).toLocaleString(),
                },
              ]}
              compact
            />
          </ChartCard>
        </div>

        {/* Revenue Bar Chart */}
        <ChartCard
          title={`${getGranularityLabel(granularity)} Revenue Comparison`}
          subtitle={`Revenue breakdown by ${granularity}`}
          loading={trendsLoading}
        >
          <BarChart
            data={trendData}
            xKey="date"
            yKeys={['revenue']}
            labels={{ revenue: 'Revenue' }}
            height={280}
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
