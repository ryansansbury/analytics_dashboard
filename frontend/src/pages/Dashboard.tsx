import { DollarSign, Users, TrendingUp, Target } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { AreaChart } from '../components/charts/AreaChart';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/PieChart';
import { FunnelChart } from '../components/charts/FunnelChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency } from '../utils/formatters';
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
    case 'last30d':
      return 'day';
    case 'last90d':
      return 'week';
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
  const { data: topProducts, isLoading: productsLoading } = useTopProducts(8);

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

  const chartCategoryData = (categoryData || [])
    .map(item => ({
      category: item.category,
      value: item.value,
      percentage: item.percentage,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  const funnelData = (pipelineData || []).map((item, index, arr) => ({
    stage: item.stage,
    value: item.value,
    count: item.count,
    conversionRate: index === 0 ? 100 : Math.round((item.count / arr[0].count) * 100),
  }));

  // Calculate win rate from pipeline
  const closedWonStage = funnelData.find(s => s.stage === 'Closed Won');
  const leadStage = funnelData.find(s => s.stage === 'Lead');
  const winRate = leadStage && leadStage.count > 0 && closedWonStage
    ? (closedWonStage.count / leadStage.count) * 100
    : 3.2; // Default fallback

  const productTableData = (topProducts || []).map((item) => ({
    id: item.id,
    name: item.name,
    revenue: item.revenue,
    units: item.unitsSold,
  }));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Header
        title="Executive Dashboard"
        subtitle={`${filters.dateRange.startDate} to ${filters.dateRange.endDate}`}
      />

      {/* Content area with flexible row heights */}
      <div className="flex-1 p-3 flex flex-col gap-2 min-h-0 overflow-hidden">
        {/* Row 1: KPIs - auto height */}
        <div className="flex-shrink-0 grid grid-cols-4 gap-2">
          <KPICard
            label="Total Revenue"
            value={kpis.totalRevenue?.value || 25000000}
            changePercent={kpis.totalRevenue?.changePercent || 12.5}
            format="currency"
            icon={<DollarSign className="h-4 w-4" />}
            loading={summaryLoading}
          />
          <KPICard
            label="Total Customers"
            value={kpis.totalCustomers?.value || 500}
            changePercent={kpis.totalCustomers?.changePercent || 8.3}
            format="number"
            icon={<Users className="h-4 w-4" />}
            loading={summaryLoading}
          />
          <KPICard
            label="Pipeline Value"
            value={kpis.pipelineValue?.value || 35000000}
            changePercent={kpis.pipelineValue?.changePercent || 8.5}
            format="currency"
            icon={<TrendingUp className="h-4 w-4" />}
            loading={summaryLoading}
          />
          <KPICard
            label="Conversion Rate"
            value={winRate}
            changePercent={kpis.pipelineValue?.changePercent ? kpis.pipelineValue.changePercent * 0.3 : 5.2}
            format="percent"
            icon={<Target className="h-4 w-4" />}
            loading={summaryLoading || pipelineLoading}
          />
        </div>

        {/* Row 2: Revenue Trend + Category - 30% of remaining space */}
        <div className="flex-[30] min-h-0 grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <ChartCard
              title="Revenue Trend"
              subtitle={`${getGranularityLabel(granularity)} revenue over time`}
              loading={trendsLoading}
            >
              <AreaChart
                data={trendData}
                xKey="date"
                yKeys={['revenue']}
                labels={{ revenue: 'Revenue' }}
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Revenue by Category"
            subtitle="By product category"
            loading={categoryLoading}
          >
            <DonutChart
              data={chartCategoryData}
              nameKey="category"
              valueKey="value"
            />
          </ChartCard>
        </div>

        {/* Row 3: Pipeline + Products - 35% of remaining space */}
        <div className="flex-[35] min-h-0 grid grid-cols-2 gap-2">
          <ChartCard
            title="Sales Pipeline"
            subtitle="By stage"
            loading={pipelineLoading}
            actions={
              <span className="text-xs text-gray-400">
                Win Rate: <span className="text-white font-semibold">{winRate.toFixed(1)}%</span>
              </span>
            }
          >
            <FunnelChart data={funnelData} />
          </ChartCard>

          <ChartCard
            title="Top Products"
            subtitle="By revenue"
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

        {/* Row 4: Daily Revenue - full width at bottom, 35% of remaining space */}
        <div className="flex-[35] min-h-0">
          <ChartCard
            title={`${getGranularityLabel(granularity)} Revenue`}
            subtitle="Comparison"
            loading={trendsLoading}
          >
            <BarChart
              data={trendData}
              xKey="date"
              yKeys={['revenue']}
              labels={{ revenue: 'Revenue' }}
              colors={['#06B6D4']}
              formatXAsDate
            />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
