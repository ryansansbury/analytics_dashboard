import { DollarSign, Users, TrendingUp, ShoppingCart, Target, Activity } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard, KPIGrid } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { AreaChart } from '../components/charts/AreaChart';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/PieChart';
import { FunnelChart } from '../components/charts/FunnelChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency, formatPercent, CHART_COLORS } from '../utils/formatters';

// Mock data - will be replaced with API calls
const mockKPIs = {
  totalRevenue: { value: 4250000, change: 12.5 },
  totalCustomers: { value: 1847, change: 8.3 },
  avgOrderValue: { value: 2300, change: -2.1 },
  conversionRate: { value: 3.2, change: 0.4 },
  pipelineValue: { value: 8500000, change: 15.2 },
  growthRate: { value: 18.5, change: 3.2 },
};

const mockRevenueTrend = [
  { date: '2024-01', revenue: 320000, orders: 142 },
  { date: '2024-02', revenue: 345000, orders: 156 },
  { date: '2024-03', revenue: 380000, orders: 168 },
  { date: '2024-04', revenue: 355000, orders: 152 },
  { date: '2024-05', revenue: 410000, orders: 175 },
  { date: '2024-06', revenue: 445000, orders: 192 },
  { date: '2024-07', revenue: 420000, orders: 185 },
  { date: '2024-08', revenue: 480000, orders: 210 },
  { date: '2024-09', revenue: 520000, orders: 228 },
  { date: '2024-10', revenue: 495000, orders: 215 },
  { date: '2024-11', revenue: 550000, orders: 240 },
  { date: '2024-12', revenue: 530000, orders: 232 },
];

const mockCategoryData = [
  { category: 'Enterprise Software', value: 1850000, percentage: 43.5 },
  { category: 'Professional Services', value: 980000, percentage: 23.1 },
  { category: 'Cloud Infrastructure', value: 720000, percentage: 16.9 },
  { category: 'Data Analytics', value: 450000, percentage: 10.6 },
  { category: 'Security Solutions', value: 250000, percentage: 5.9 },
];

const mockPipelineData = [
  { stage: 'Lead', value: 8500000, count: 245, conversionRate: 100 },
  { stage: 'Qualified', value: 5200000, count: 156, conversionRate: 63.7 },
  { stage: 'Proposal', value: 3100000, count: 89, conversionRate: 57.1 },
  { stage: 'Negotiation', value: 1800000, count: 42, conversionRate: 47.2 },
  { stage: 'Closed Won', value: 950000, count: 28, conversionRate: 66.7 },
];

const mockTopProducts = [
  { id: 1, name: 'Enterprise Suite Pro', revenue: 1250000, units: 45, growth: 15.2 },
  { id: 2, name: 'Cloud Platform Standard', revenue: 890000, units: 120, growth: 22.8 },
  { id: 3, name: 'Analytics Dashboard', revenue: 650000, units: 85, growth: 18.5 },
  { id: 4, name: 'Security Gateway', revenue: 420000, units: 62, growth: -3.2 },
  { id: 5, name: 'API Integration Kit', revenue: 380000, units: 210, growth: 45.1 },
];

export function Dashboard() {
  return (
    <div className="min-h-screen">
      <Header
        title="Executive Dashboard"
        subtitle="Overview of key business metrics and performance indicators"
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <KPIGrid>
          <KPICard
            label="Total Revenue"
            value={mockKPIs.totalRevenue.value}
            changePercent={mockKPIs.totalRevenue.change}
            format="currency"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <KPICard
            label="Total Customers"
            value={mockKPIs.totalCustomers.value}
            changePercent={mockKPIs.totalCustomers.change}
            format="number"
            icon={<Users className="h-5 w-5" />}
          />
          <KPICard
            label="Avg Order Value"
            value={mockKPIs.avgOrderValue.value}
            changePercent={mockKPIs.avgOrderValue.change}
            format="currency"
            icon={<ShoppingCart className="h-5 w-5" />}
          />
          <KPICard
            label="Conversion Rate"
            value={mockKPIs.conversionRate.value}
            changePercent={mockKPIs.conversionRate.change}
            format="percent"
            icon={<Target className="h-5 w-5" />}
          />
          <KPICard
            label="Pipeline Value"
            value={mockKPIs.pipelineValue.value}
            changePercent={mockKPIs.pipelineValue.change}
            format="currency"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <KPICard
            label="Growth Rate"
            value={mockKPIs.growthRate.value}
            changePercent={mockKPIs.growthRate.change}
            format="percent"
            icon={<Activity className="h-5 w-5" />}
          />
        </KPIGrid>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard
            title="Revenue Trend"
            subtitle="Monthly revenue over the past 12 months"
            className="lg:col-span-2"
          >
            <AreaChart
              data={mockRevenueTrend}
              xKey="date"
              yKeys={['revenue']}
              labels={{ revenue: 'Revenue' }}
              height={320}
            />
          </ChartCard>

          <ChartCard title="Revenue by Category" subtitle="Distribution by product category">
            <DonutChart
              data={mockCategoryData}
              nameKey="category"
              valueKey="value"
              height={320}
              showLabels
            />
          </ChartCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Sales Pipeline" subtitle="Opportunity value by stage">
            <FunnelChart data={mockPipelineData} height={320} />
          </ChartCard>

          <ChartCard title="Top Products" subtitle="Best performing products by revenue">
            <DataTable
              data={mockTopProducts}
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
                {
                  key: 'growth',
                  header: 'Growth',
                  sortable: true,
                  align: 'right',
                  render: (value) => {
                    const v = value as number;
                    const color = v >= 0 ? 'text-success' : 'text-danger';
                    return <span className={color}>{formatPercent(v)}</span>;
                  },
                },
              ]}
              compact
            />
          </ChartCard>
        </div>

        {/* Monthly Revenue Bar Chart */}
        <ChartCard
          title="Monthly Revenue Comparison"
          subtitle="Revenue and order count by month"
        >
          <BarChart
            data={mockRevenueTrend}
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
