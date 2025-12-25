import { Header } from '../components/layout/Header';
import { ChartCard } from '../components/cards/ChartCard';
import { AreaChart } from '../components/charts/AreaChart';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/PieChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency, formatPercent, CHART_COLORS } from '../utils/formatters';

// Mock data
const mockRevenueTrend = [
  { date: '2024-01', revenue: 320000, previousYear: 280000 },
  { date: '2024-02', revenue: 345000, previousYear: 295000 },
  { date: '2024-03', revenue: 380000, previousYear: 320000 },
  { date: '2024-04', revenue: 355000, previousYear: 310000 },
  { date: '2024-05', revenue: 410000, previousYear: 340000 },
  { date: '2024-06', revenue: 445000, previousYear: 360000 },
  { date: '2024-07', revenue: 420000, previousYear: 375000 },
  { date: '2024-08', revenue: 480000, previousYear: 390000 },
  { date: '2024-09', revenue: 520000, previousYear: 420000 },
  { date: '2024-10', revenue: 495000, previousYear: 435000 },
  { date: '2024-11', revenue: 550000, previousYear: 460000 },
  { date: '2024-12', revenue: 530000, previousYear: 480000 },
];

const mockCategoryData = [
  { category: 'Enterprise Software', value: 1850000 },
  { category: 'Professional Services', value: 980000 },
  { category: 'Cloud Infrastructure', value: 720000 },
  { category: 'Data Analytics', value: 450000 },
  { category: 'Security Solutions', value: 250000 },
];

const mockRegionData = [
  { region: 'North America', revenue: 2100000, growth: 15.2 },
  { region: 'Europe', revenue: 1250000, growth: 12.8 },
  { region: 'Asia Pacific', revenue: 620000, growth: 28.5 },
  { region: 'Latin America', revenue: 180000, growth: 8.3 },
  { region: 'Middle East', revenue: 100000, growth: 22.1 },
];

const mockChannelData = [
  { channel: 'Direct Sales', value: 2800000 },
  { channel: 'Online', value: 850000 },
  { channel: 'Partners', value: 600000 },
];

const mockTopProducts = [
  { id: 1, name: 'Enterprise Suite Pro', category: 'Software', revenue: 1250000, units: 45, avgPrice: 27778, growth: 15.2 },
  { id: 2, name: 'Cloud Platform Standard', category: 'Cloud', revenue: 890000, units: 120, avgPrice: 7417, growth: 22.8 },
  { id: 3, name: 'Analytics Dashboard', category: 'Analytics', revenue: 650000, units: 85, avgPrice: 7647, growth: 18.5 },
  { id: 4, name: 'Security Gateway', category: 'Security', revenue: 420000, units: 62, avgPrice: 6774, growth: -3.2 },
  { id: 5, name: 'API Integration Kit', category: 'Integration', revenue: 380000, units: 210, avgPrice: 1810, growth: 45.1 },
  { id: 6, name: 'Data Warehouse Solution', category: 'Analytics', revenue: 340000, units: 28, avgPrice: 12143, growth: 12.4 },
  { id: 7, name: 'Mobile SDK', category: 'Development', revenue: 280000, units: 340, avgPrice: 824, growth: 35.6 },
  { id: 8, name: 'Compliance Manager', category: 'Security', revenue: 220000, units: 44, avgPrice: 5000, growth: 8.9 },
];

export function Revenue() {
  return (
    <div className="min-h-screen">
      <Header
        title="Revenue Analytics"
        subtitle="Detailed analysis of revenue performance across all dimensions"
      />

      <div className="p-6 space-y-6">
        {/* Revenue Trend with YoY Comparison */}
        <ChartCard
          title="Revenue Over Time"
          subtitle="Current year vs previous year comparison"
        >
          <AreaChart
            data={mockRevenueTrend}
            xKey="date"
            yKeys={['revenue', 'previousYear']}
            labels={{ revenue: 'Current Year', previousYear: 'Previous Year' }}
            colors={[CHART_COLORS[0], CHART_COLORS[3]]}
            height={350}
            showLegend
          />
        </ChartCard>

        {/* Category and Region */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Revenue by Category" subtitle="Product category breakdown">
            <BarChart
              data={mockCategoryData}
              xKey="category"
              yKeys={['value']}
              height={300}
              colorByValue
            />
          </ChartCard>

          <ChartCard title="Revenue by Region" subtitle="Geographic distribution">
            <BarChart
              data={mockRegionData}
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
          <ChartCard title="Revenue by Channel" subtitle="Sales channel breakdown">
            <DonutChart
              data={mockChannelData}
              nameKey="channel"
              valueKey="value"
              height={280}
            />
          </ChartCard>

          <ChartCard
            title="Top Products"
            subtitle="Best performing products"
            className="lg:col-span-2"
          >
            <DataTable
              data={mockTopProducts}
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
            />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
