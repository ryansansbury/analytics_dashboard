import { DollarSign, ShoppingCart, Users, CreditCard } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { AreaChart } from '../components/charts/AreaChart';
import { BarChart } from '../components/charts/BarChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency, CHART_COLORS } from '../utils/formatters';
import {
  useDashboardSummary,
  useRevenueTrends,
  useRevenueByCategory,
  useRevenueByRegion,
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

export function Revenue() {
  const { filters } = useFilters();

  // Determine granularity based on date range
  const granularity = getGranularity(filters.dateRange.preset);

  // Fetch data from API
  const { data: summaryData, isLoading: summaryLoading } = useDashboardSummary();
  const { data: revenueTrends, isLoading: trendsLoading } = useRevenueTrends(granularity);
  const { data: categoryData, isLoading: categoryLoading } = useRevenueByCategory();
  const { data: regionData, isLoading: regionLoading } = useRevenueByRegion();
  const { data: topProducts, isLoading: productsLoading } = useTopProducts(18);

  // Extract KPI data
  const kpis = summaryData?.kpis;
  const totalRevenue = kpis?.totalRevenue?.value || 0;
  const revenueChange = kpis?.totalRevenue?.changePercent || 0;
  const totalCustomers = kpis?.totalCustomers?.value || 0;
  const customerChange = kpis?.totalCustomers?.changePercent || 0;
  const avgOrderValue = kpis?.avgOrderValue?.value || 0;
  const aovChange = kpis?.avgOrderValue?.changePercent || 0;

  // Calculate additional metrics from trends
  const totalOrders = (revenueTrends || []).reduce((sum, item) => sum + (item.orders || 0), 0);

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

  const productTableData = (topProducts || []).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    revenue: item.revenue,
    units: item.unitsSold,
    avgPrice: item.avgPrice,
  }));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Header
        title="Revenue Analytics"
        subtitle={`${filters.dateRange.startDate} to ${filters.dateRange.endDate}`}
      />

      {/* Content area with fixed row heights */}
      <div className="flex-1 p-3 flex flex-col gap-2 min-h-0 overflow-hidden">
        {/* Row 1: KPIs - fixed height, 4 columns to match other pages */}
        <div className="flex-shrink-0 grid grid-cols-4 gap-2">
          <KPICard
            label="Total Revenue"
            value={totalRevenue}
            changePercent={revenueChange}
            format="currency"
            icon={<DollarSign className="h-4 w-4" />}
            loading={summaryLoading}
          />
          <KPICard
            label="Avg Order Value"
            value={avgOrderValue}
            changePercent={aovChange}
            format="currency"
            icon={<CreditCard className="h-4 w-4" />}
            loading={summaryLoading}
          />
          <KPICard
            label="Total Orders"
            value={totalOrders}
            changePercent={8.2}
            format="number"
            icon={<ShoppingCart className="h-4 w-4" />}
            loading={trendsLoading}
          />
          <KPICard
            label="Active Customers"
            value={totalCustomers}
            changePercent={customerChange}
            format="number"
            icon={<Users className="h-4 w-4" />}
            loading={summaryLoading}
          />
        </div>

        {/* Row 2: Revenue Trend + Region - 35% */}
        <div className="flex-[35] min-h-0 grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <ChartCard
              title="Revenue Over Time"
              subtitle={`${getGranularityLabel(granularity)} trend`}
              loading={trendsLoading}
            >
              <AreaChart
                data={trendData}
                xKey="date"
                yKeys={['revenue']}
                labels={{ revenue: 'Revenue' }}
                colors={[CHART_COLORS[0]]}
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Revenue by Region"
            subtitle="Geographic breakdown"
            loading={regionLoading}
          >
            <BarChart
              data={chartRegionData}
              xKey="region"
              yKeys={['revenue']}
              colorByValue
            />
          </ChartCard>
        </div>

        {/* Row 3: Category + Products - 65% */}
        <div className="flex-[65] min-h-0 grid grid-cols-2 gap-2">
          <ChartCard
            title="Revenue by Category"
            subtitle="Product breakdown"
            loading={categoryLoading}
          >
            <BarChart
              data={chartCategoryData}
              xKey="category"
              yKeys={['value']}
              colorByValue
              horizontal
            />
          </ChartCard>

          <div>
            <ChartCard
              title="Top Products"
              subtitle="Best performers"
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
                compact
              />
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}
