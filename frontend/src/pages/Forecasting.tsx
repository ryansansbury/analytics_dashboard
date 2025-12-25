import { TrendingUp, AlertCircle, BarChart3, Calendar } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { AreaChart } from '../components/charts/AreaChart';
import { BarChart } from '../components/charts/BarChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency, CHART_COLORS } from '../utils/formatters';

// Mock data
const mockForecastKPIs = {
  predictedRevenue: { value: 5800000, change: 14.2 },
  pipelineForecast: { value: 2400000, change: 8.5 },
  modelAccuracy: { value: 94.2, change: 1.8 },
  forecastPeriod: { value: 6, change: 0 },
};

// Historical + Forecast data
const mockRevenueForecast = [
  { date: '2024-07', actual: 420000, predicted: null, lowerBound: null, upperBound: null },
  { date: '2024-08', actual: 480000, predicted: null, lowerBound: null, upperBound: null },
  { date: '2024-09', actual: 520000, predicted: null, lowerBound: null, upperBound: null },
  { date: '2024-10', actual: 495000, predicted: null, lowerBound: null, upperBound: null },
  { date: '2024-11', actual: 550000, predicted: null, lowerBound: null, upperBound: null },
  { date: '2024-12', actual: 530000, predicted: 530000, lowerBound: 505000, upperBound: 555000 },
  { date: '2025-01', actual: null, predicted: 565000, lowerBound: 525000, upperBound: 605000 },
  { date: '2025-02', actual: null, predicted: 590000, lowerBound: 540000, upperBound: 640000 },
  { date: '2025-03', actual: null, predicted: 620000, lowerBound: 560000, upperBound: 680000 },
  { date: '2025-04', actual: null, predicted: 580000, lowerBound: 510000, upperBound: 650000 },
  { date: '2025-05', actual: null, predicted: 610000, lowerBound: 530000, upperBound: 690000 },
  { date: '2025-06', actual: null, predicted: 650000, lowerBound: 560000, upperBound: 740000 },
];

const mockPipelineForecast = [
  { month: 'Jan 2025', weighted: 850000, best: 1200000, worst: 550000 },
  { month: 'Feb 2025', weighted: 720000, best: 980000, worst: 480000 },
  { month: 'Mar 2025', weighted: 680000, best: 920000, worst: 420000 },
  { month: 'Apr 2025', weighted: 520000, best: 750000, worst: 320000 },
  { month: 'May 2025', weighted: 380000, best: 580000, worst: 220000 },
  { month: 'Jun 2025', weighted: 250000, best: 420000, worst: 120000 },
];

const mockSeasonality = [
  { month: 'Jan', index: 0.92 },
  { month: 'Feb', index: 0.88 },
  { month: 'Mar', index: 0.95 },
  { month: 'Apr', index: 0.90 },
  { month: 'May', index: 0.98 },
  { month: 'Jun', index: 1.02 },
  { month: 'Jul', index: 0.95 },
  { month: 'Aug', index: 1.05 },
  { month: 'Sep', index: 1.12 },
  { month: 'Oct', index: 1.08 },
  { month: 'Nov', index: 1.18 },
  { month: 'Dec', index: 1.15 },
];

const mockChurnRisk = [
  { id: 1, company: 'Acme Corporation', segment: 'Enterprise', ltv: 125000, riskScore: 0.85, daysSinceActivity: 45, recommendation: 'Executive outreach' },
  { id: 2, company: 'TechStart Inc', segment: 'Mid-Market', ltv: 48000, riskScore: 0.78, daysSinceActivity: 38, recommendation: 'Product demo' },
  { id: 3, company: 'Global Systems LLC', segment: 'Enterprise', ltv: 95000, riskScore: 0.72, daysSinceActivity: 52, recommendation: 'Success check-in' },
  { id: 4, company: 'DataFlow Analytics', segment: 'Mid-Market', ltv: 32000, riskScore: 0.68, daysSinceActivity: 41, recommendation: 'Feature training' },
  { id: 5, company: 'CloudNet Solutions', segment: 'SMB', ltv: 18000, riskScore: 0.65, daysSinceActivity: 35, recommendation: 'Usage review' },
  { id: 6, company: 'Innovate Labs', segment: 'Mid-Market', ltv: 28000, riskScore: 0.62, daysSinceActivity: 32, recommendation: 'Renewal discussion' },
];

const mockModelMetrics = [
  { metric: 'MAPE (Mean Absolute Percentage Error)', value: '5.8%' },
  { metric: 'R² Score', value: '0.942' },
  { metric: 'RMSE (Root Mean Square Error)', value: '$32,450' },
  { metric: 'Training Data Points', value: '24 months' },
  { metric: 'Last Model Update', value: 'Dec 20, 2024' },
  { metric: 'Confidence Interval', value: '95%' },
];

export function Forecasting() {
  return (
    <div className="min-h-screen">
      <Header
        title="Forecasting"
        subtitle="ML-powered predictions and scenario analysis"
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Predicted Revenue (6mo)"
            value={mockForecastKPIs.predictedRevenue.value}
            changePercent={mockForecastKPIs.predictedRevenue.change}
            format="currency"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <KPICard
            label="Pipeline Forecast"
            value={mockForecastKPIs.pipelineForecast.value}
            changePercent={mockForecastKPIs.pipelineForecast.change}
            format="currency"
            icon={<BarChart3 className="h-5 w-5" />}
          />
          <KPICard
            label="Model Accuracy"
            value={mockForecastKPIs.modelAccuracy.value}
            changePercent={mockForecastKPIs.modelAccuracy.change}
            format="percent"
            icon={<AlertCircle className="h-5 w-5" />}
          />
          <KPICard
            label="Forecast Period"
            value={mockForecastKPIs.forecastPeriod.value}
            format="number"
            icon={<Calendar className="h-5 w-5" />}
          />
        </div>

        {/* Revenue Forecast */}
        <ChartCard
          title="Revenue Forecast"
          subtitle="Historical data with 6-month ML prediction and confidence intervals"
        >
          <div className="mb-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[0] }} />
              <span className="text-gray-400">Actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[1] }} />
              <span className="text-gray-400">Predicted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5" style={{ backgroundColor: CHART_COLORS[1], opacity: 0.3 }} />
              <span className="text-gray-400">Confidence Band</span>
            </div>
          </div>
          <AreaChart
            data={mockRevenueForecast.filter(d => d.actual || d.predicted)}
            xKey="date"
            yKeys={['actual', 'predicted']}
            labels={{ actual: 'Actual Revenue', predicted: 'Predicted Revenue' }}
            colors={[CHART_COLORS[0], CHART_COLORS[1]]}
            height={350}
            showLegend={false}
          />
        </ChartCard>

        {/* Pipeline Forecast and Seasonality */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Pipeline Forecast Scenarios"
            subtitle="Weighted, best case, and worst case projections"
          >
            <BarChart
              data={mockPipelineForecast}
              xKey="month"
              yKeys={['weighted', 'best', 'worst']}
              labels={{ weighted: 'Weighted', best: 'Best Case', worst: 'Worst Case' }}
              colors={[CHART_COLORS[0], CHART_COLORS[4], CHART_COLORS[3]]}
              height={300}
              showLegend
            />
          </ChartCard>

          <ChartCard
            title="Seasonal Index"
            subtitle="Historical revenue seasonality pattern"
          >
            <BarChart
              data={mockSeasonality}
              xKey="month"
              yKeys={['index']}
              labels={{ index: 'Seasonal Index' }}
              formatY="number"
              height={300}
              colorByValue
            />
          </ChartCard>
        </div>

        {/* Model Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard title="Model Performance" subtitle="Forecasting model metrics">
            <div className="space-y-4">
              {mockModelMetrics.map((item) => (
                <div key={item.metric} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                  <span className="text-sm text-gray-400">{item.metric}</span>
                  <span className="text-sm font-medium text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </ChartCard>

          <ChartCard
            title="Churn Risk Predictions"
            subtitle="ML-identified at-risk customers"
            className="lg:col-span-2"
          >
            <DataTable
              data={mockChurnRisk}
              keyExtractor={(row) => row.id}
              columns={[
                { key: 'company', header: 'Company', sortable: true },
                { key: 'segment', header: 'Segment', sortable: true },
                {
                  key: 'ltv',
                  header: 'LTV',
                  sortable: true,
                  align: 'right',
                  render: (value) => formatCurrency(value as number),
                },
                {
                  key: 'riskScore',
                  header: 'Risk Score',
                  sortable: true,
                  align: 'right',
                  render: (value) => {
                    const score = value as number;
                    const color = score >= 0.7 ? 'text-danger' : score >= 0.5 ? 'text-warning' : 'text-success';
                    return (
                      <span className={`font-medium ${color}`}>
                        {(score * 100).toFixed(0)}%
                      </span>
                    );
                  },
                },
                {
                  key: 'daysSinceActivity',
                  header: 'Days Inactive',
                  sortable: true,
                  align: 'right',
                },
                {
                  key: 'recommendation',
                  header: 'Action',
                  render: (value) => (
                    <span className="px-2 py-1 text-xs rounded-full bg-primary-500/20 text-primary-400">
                      {value as string}
                    </span>
                  ),
                },
              ]}
              compact
            />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
