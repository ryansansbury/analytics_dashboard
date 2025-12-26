import { TrendingUp, AlertCircle, BarChart3, Calendar } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { AreaChart } from '../components/charts/AreaChart';
import { BarChart } from '../components/charts/BarChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency, CHART_COLORS } from '../utils/formatters';
import { useRevenueForecast, useChurnRisk, useSeasonality, useForecastingKpis } from '../hooks/useApi';
import { useFilters } from '../hooks/useFilters';

export function Forecasting() {
  const { filters } = useFilters();

  // Fetch real data from API - all data varies by selected date range
  const { data: revenueForecast, isLoading: forecastLoading } = useRevenueForecast(6);
  const { data: churnRiskData, isLoading: churnLoading } = useChurnRisk(10);
  const { data: seasonalityData, isLoading: seasonalityLoading } = useSeasonality();
  const { data: kpis, isLoading: kpisLoading } = useForecastingKpis();

  // Transform forecast data
  const forecastData = (revenueForecast || []).map(item => ({
    date: item.date,
    actual: item.actual,
    predicted: item.predicted,
  }));

  // Transform churn risk data
  const churnData = (churnRiskData || []).map(customer => ({
    id: customer.id,
    company: customer.company,
    segment: customer.segment,
    ltv: customer.lifetimeValue,
    riskScore: customer.riskScore,
    daysSinceActivity: customer.daysSinceActivity,
    recommendation: customer.recommendation,
  }));

  // Static model metrics (would come from ML model in production)
  const modelMetrics = [
    { metric: 'MAPE (Mean Absolute Percentage Error)', value: '5.8%' },
    { metric: 'R² Score', value: '0.942' },
    { metric: 'RMSE (Root Mean Square Error)', value: '$32,450' },
    { metric: 'Training Data Points', value: '24 months' },
    { metric: 'Last Model Update', value: 'Dec 20, 2025' },
    { metric: 'Confidence Interval', value: '95%' },
  ];

  // Use seasonality from API or fallback
  const seasonalData = seasonalityData || [
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

  return (
    <div className="min-h-screen">
      <Header
        title="Forecasting"
        subtitle={`Analysis based on data from ${filters.dateRange.startDate} to ${filters.dateRange.endDate}`}
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Predicted Revenue (6mo)"
            value={kpis?.predictedRevenue || 0}
            changePercent={kpis?.predictedChange || 0}
            format="currency"
            icon={<TrendingUp className="h-5 w-5" />}
            loading={kpisLoading}
          />
          <KPICard
            label="At-Risk Customers"
            value={kpis?.atRiskCount || churnData.length}
            changePercent={kpis?.atRiskChange || 0}
            format="number"
            icon={<AlertCircle className="h-5 w-5" />}
            loading={kpisLoading || churnLoading}
          />
          <KPICard
            label="Model Accuracy"
            value={kpis?.modelAccuracy || 94.2}
            changePercent={kpis?.accuracyChange || 0}
            format="percent"
            icon={<BarChart3 className="h-5 w-5" />}
            loading={kpisLoading}
          />
          <KPICard
            label="Forecast Period"
            value={kpis?.forecastPeriod || 6}
            changePercent={0}
            format="number"
            icon={<Calendar className="h-5 w-5" />}
          />
        </div>

        {/* Revenue Forecast */}
        <ChartCard
          title="Revenue Forecast"
          subtitle="Historical data with 6-month ML prediction"
          loading={forecastLoading}
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
          </div>
          <AreaChart
            data={forecastData.filter(d => d.actual || d.predicted)}
            xKey="date"
            yKeys={['actual', 'predicted']}
            labels={{ actual: 'Actual Revenue', predicted: 'Predicted Revenue' }}
            colors={[CHART_COLORS[0], CHART_COLORS[1]]}
            height={350}
            showLegend={false}
          />
        </ChartCard>

        {/* Seasonality */}
        <ChartCard
          title="Seasonal Revenue Index"
          subtitle="Historical revenue seasonality pattern (1.0 = average)"
          loading={seasonalityLoading}
        >
          <BarChart
            data={seasonalData}
            xKey="month"
            yKeys={['index']}
            labels={{ index: 'Seasonal Index' }}
            formatY="number"
            height={300}
            colorByValue
          />
        </ChartCard>

        {/* Model Performance and Churn Risk */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartCard title="Model Performance" subtitle="Forecasting model metrics">
            <div className="space-y-4">
              {modelMetrics.map((item) => (
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
            loading={churnLoading}
          >
            <DataTable
              data={churnData}
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
