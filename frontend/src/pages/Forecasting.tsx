import { TrendingUp, AlertCircle, BarChart3, Calendar } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { AreaChart } from '../components/charts/AreaChart';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/PieChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency } from '../utils/formatters';
import { useRevenueForecast, useChurnRisk, useSeasonality, useForecastingKpis, useModelPerformance, useRevenueAtRisk } from '../hooks/useApi';
import { useFilters } from '../hooks/useFilters';

export function Forecasting() {
  const { filters } = useFilters();

  // Fetch real data from API - all data varies by selected date range
  const { data: revenueForecast, isLoading: forecastLoading } = useRevenueForecast(6);
  const { data: churnRiskData, isLoading: churnLoading } = useChurnRisk(17);
  const { data: seasonalityData, isLoading: seasonalityLoading } = useSeasonality();
  const { data: kpis, isLoading: kpisLoading } = useForecastingKpis();
  const { data: modelPerformance, isLoading: modelLoading } = useModelPerformance();
  const { data: revenueAtRisk, isLoading: riskLoading } = useRevenueAtRisk();

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

  // Model metrics from API or defaults
  const modelMetrics = modelPerformance || {
    accuracy: 94.2,
    mape: 5.8,
    r2Score: 0.942,
    rmse: 32450,
    dataPoints: '24 mo',
    lastUpdate: 'Dec 20',
    confidence: 95,
  };

  // Growth projections by quarter
  const growthProjections = [
    { quarter: 'Q1 2026', projected: 12.5, historical: 10.2 },
    { quarter: 'Q2 2026', projected: 15.8, historical: 11.5 },
    { quarter: 'Q3 2026', projected: 18.2, historical: 14.8 },
    { quarter: 'Q4 2026', projected: 22.5, historical: 18.5 },
  ];

  // Revenue by segment forecast
  const segmentForecast = [
    { segment: 'Enterprise', value: 2850000, percentage: 45 },
    { segment: 'Mid-Market', value: 1580000, percentage: 28 },
    { segment: 'SMB', value: 920000, percentage: 17 },
    { segment: 'Startup', value: 450000, percentage: 10 },
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
    <div className="h-full flex flex-col overflow-hidden">
      <Header
        title="Forecasting"
        subtitle={`${filters.dateRange.startDate} to ${filters.dateRange.endDate}`}
      />

      {/* Content area with fixed row heights */}
      <div className="flex-1 p-3 flex flex-col gap-2 min-h-0 overflow-hidden">
        {/* Row 1: KPIs - fixed height */}
        <div className="flex-shrink-0 grid grid-cols-4 gap-2">
          <KPICard
            label="Predicted Revenue (6mo)"
            value={kpis?.predictedRevenue || 4500000}
            changePercent={kpis?.predictedChange || 12.5}
            format="currency"
            icon={<TrendingUp className="h-4 w-4" />}
            loading={kpisLoading}
          />
          <KPICard
            label="At-Risk Customers"
            value={kpis?.atRiskCount || churnData.length || 8}
            changePercent={kpis?.atRiskChange || -5.2}
            format="number"
            icon={<AlertCircle className="h-4 w-4" />}
            loading={kpisLoading || churnLoading}
          />
          <KPICard
            label="Model Accuracy"
            value={kpis?.modelAccuracy || 94.2}
            changePercent={kpis?.accuracyChange || 1.2}
            format="percent"
            icon={<BarChart3 className="h-4 w-4" />}
            loading={kpisLoading}
          />
          <KPICard
            label="Forecast Period"
            value={kpis?.forecastPeriod || 6}
            changePercent={kpis?.predictedChange ? kpis.predictedChange * 0.1 : 1.5}
            format="number"
            icon={<Calendar className="h-4 w-4" />}
          />
        </div>

        {/* Row 2: Revenue Forecast + Seasonality - 30% (matching dashboard) */}
        <div className="flex-[30] min-h-0 grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <ChartCard
              title="Revenue Forecast"
              subtitle="6-month ML prediction"
              loading={forecastLoading}
            >
              <div className="mb-2 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5" style={{ backgroundColor: '#10B981' }} />
                  <span className="text-gray-400">Actual</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0.5" style={{ backgroundImage: 'linear-gradient(to right, #10B981 50%, transparent 50%)', backgroundSize: '4px 2px' }} />
                  <span className="text-gray-400">Predicted</span>
                </div>
              </div>
              <AreaChart
                data={forecastData.filter(d => d.actual || d.predicted)}
                xKey="date"
                yKeys={['actual', 'predicted']}
                labels={{ actual: 'Actual Revenue', predicted: 'Predicted Revenue' }}
                colors={['#10B981', '#10B981']}
                showLegend={false}
                dashedKeys={['predicted']}
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Seasonal Index"
            subtitle="Monthly pattern"
            loading={seasonalityLoading}
          >
            <BarChart
              data={seasonalData}
              xKey="month"
              yKeys={['index']}
              labels={{ index: 'Index' }}
              formatY="number"
              colorByValue
            />
          </ChartCard>
        </div>

        {/* Row 3: Growth Projections + Model Performance + Segment Forecast - 30% */}
        <div className="flex-[30] min-h-0 grid grid-cols-3 gap-2">
          <ChartCard title="Growth Projections" subtitle="Quarterly outlook">
            <BarChart
              data={growthProjections}
              xKey="quarter"
              yKeys={['projected', 'historical']}
              labels={{ projected: 'Projected', historical: 'Historical' }}
              formatY="percent"
              colors={['#10B981', '#3B82F6']}
            />
          </ChartCard>

          <ChartCard title="Model Performance" subtitle="Accuracy metrics" loading={modelLoading}>
            <div className="h-full grid grid-cols-2 gap-3 content-center">
              <div className="text-center p-2 bg-gray-800/50 rounded-lg">
                <div className="text-2xl font-bold text-white">{modelMetrics.accuracy}%</div>
                <div className="text-xs text-gray-400">Accuracy</div>
              </div>
              <div className="text-center p-2 bg-gray-800/50 rounded-lg">
                <div className="text-2xl font-bold text-white">{modelMetrics.r2Score}</div>
                <div className="text-xs text-gray-400">R² Score</div>
              </div>
              <div className="text-center p-2 bg-gray-800/50 rounded-lg">
                <div className="text-2xl font-bold text-white">{modelMetrics.mape}%</div>
                <div className="text-xs text-gray-400">MAPE</div>
              </div>
              <div className="text-center p-2 bg-gray-800/50 rounded-lg">
                <div className="text-2xl font-bold text-white">{modelMetrics.confidence}%</div>
                <div className="text-xs text-gray-400">Confidence</div>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Segment Forecast" subtitle="Revenue distribution">
            <DonutChart
              data={segmentForecast}
              nameKey="segment"
              valueKey="value"
              formatValue="currency"
            />
          </ChartCard>
        </div>

        {/* Row 4: Churn Risk + Revenue at Risk - 40% */}
        <div className="flex-[40] min-h-0 grid grid-cols-2 gap-2">
          <ChartCard
            title="Churn Risk Predictions"
            subtitle="At-risk customers"
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
                  header: 'Risk',
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
                  key: 'recommendation',
                  header: 'Action',
                  render: (value) => (
                    <span className="px-1.5 py-0.5 text-xs rounded-full bg-primary-500/20 text-primary-400">
                      {value as string}
                    </span>
                  ),
                },
              ]}
              compact
            />
          </ChartCard>

          <ChartCard title="Revenue at Risk" subtitle="By risk category" loading={riskLoading}>
            <div className="h-full flex flex-col justify-between gap-1.5">
              <div className="flex-1 min-h-0 flex items-center justify-between px-3 bg-danger/10 rounded-lg border border-danger/20">
                <div>
                  <div className="text-sm font-medium text-danger">High Risk</div>
                  <div className="text-xs text-gray-400">{revenueAtRisk?.highRisk.customers || 7} customers · {revenueAtRisk?.highRisk.threshold || '65%+ risk'}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">{formatCurrency(revenueAtRisk?.highRisk.value || 1200000)}</div>
                </div>
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-between px-3 bg-warning/10 rounded-lg border border-warning/20">
                <div>
                  <div className="text-sm font-medium text-warning">Medium Risk</div>
                  <div className="text-xs text-gray-400">{revenueAtRisk?.mediumRisk.customers || 6} customers · {revenueAtRisk?.mediumRisk.threshold || '50-65% risk'}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">{formatCurrency(revenueAtRisk?.mediumRisk.value || 680000)}</div>
                </div>
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-between px-3 bg-success/10 rounded-lg border border-success/20">
                <div>
                  <div className="text-sm font-medium text-success">Low Risk</div>
                  <div className="text-xs text-gray-400">{revenueAtRisk?.lowRisk.customers || 4} customers · {revenueAtRisk?.lowRisk.threshold || '<50% risk'}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white">{formatCurrency(revenueAtRisk?.lowRisk.value || 320000)}</div>
                </div>
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-between px-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="text-sm font-medium text-gray-300">Total Revenue at Risk</div>
                <div className="text-xl font-bold text-white">{formatCurrency(revenueAtRisk?.total || 2200000)}</div>
              </div>
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
