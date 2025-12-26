import { Header } from '../components/layout/Header';
import { ChartCard } from '../components/cards/ChartCard';
import { AreaChart } from '../components/charts/AreaChart';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/PieChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency, CHART_COLORS } from '../utils/formatters';
import {
  useRevenueTrends,
  useRevenueByCategory,
  useRevenueByRegion,
  useRevenueByChannel,
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

export function Revenue() {
  const { filters } = useFilters();

  // Determine granularity based on date range
  const granularity = getGranularity(filters.dateRange.preset);

  // Fetch data from API
  const { data: revenueTrends, isLoading: trendsLoading } = useRevenueTrends(granularity);
  const { data: categoryData, isLoading: categoryLoading } = useRevenueByCategory();
  const { data: regionData, isLoading: regionLoading } = useRevenueByRegion();
  const { data: channelData, isLoading: channelLoading } = useRevenueByChannel();
  const { data: topProducts, isLoading: productsLoading } = useTopProducts(8);

  // Transform data for charts
  const trendData = (revenueTrends || []).map(item => ({
    date: item.date,
    revenue: item.revenue,
    orders: item.orders,
  }));

  const chartCategoryData = (categoryData || []).map(item => ({
    category: item.category,
    value: item.value,
  }));

  const chartRegionData = (regionData || []).map(item => ({
    region: item.region,
    revenue: item.revenue,
    growth: item.growth,
  }));

  const chartChannelData = (channelData || []).map(item => ({
    channel: item.channel,
    value: item.value,
  }));

  const productTableData = (topProducts || []).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    revenue: item.revenue,
    units: item.unitsSold,
    avgPrice: item.avgPrice,
  }));

  return (
    <div className="min-h-screen">
      <Header
        title="Revenue Analytics"
        subtitle={`Data from ${filters.dateRange.startDate} to ${filters.dateRange.endDate}`}
      />

      <div className="p-6 space-y-6">
        {/* Revenue Trend */}
        <ChartCard
          title="Revenue Over Time"
          subtitle={`${getGranularityLabel(granularity)} revenue trend`}
          loading={trendsLoading}
        >
          <AreaChart
            data={trendData}
            xKey="date"
            yKeys={['revenue']}
            labels={{ revenue: 'Revenue' }}
            colors={[CHART_COLORS[0]]}
            height={350}
            showLegend
          />
        </ChartCard>

        {/* Category and Region */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Revenue by Category"
            subtitle="Product category breakdown"
            loading={categoryLoading}
          >
            <BarChart
              data={chartCategoryData}
              xKey="category"
              yKeys={['value']}
              height={300}
              colorByValue
            />
          </ChartCard>

          <ChartCard
            title="Revenue by Region"
            subtitle="Geographic distribution"
            loading={regionLoading}
          >
            <BarChart
              data={chartRegionData}
              xKey="region"
              yKeys={['revenue']}
              height={300}
              horizontal
              colorByValue
            />
          </ChartCard>
        </div>

        {/* Channel Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard
            title="Revenue by Channel"
            subtitle="Sales channel breakdown"
            loading={channelLoading}
          >
            <DonutChart
              data={chartChannelData}
              nameKey="channel"
              valueKey="value"
              height={280}
            />
          </ChartCard>

          <ChartCard
            title="Top Products"
            subtitle="Best performing products"
            className="lg:col-span-2"
            loading={productsLoading}
          >
            <DataTable
              data={productTableData}
              keyExtractor={(row) => row.id}
              columns={[
                { key: 'name', header: 'Product', sortable: true },
                { key: 'category', header: 'Category', sortable: true },
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
                {
                  key: 'avgPrice',
                  header: 'Avg Price',
                  sortable: true,
                  align: 'right',
                  render: (value) => formatCurrency(value as number),
                },
              ]}
            />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
