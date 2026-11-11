import { CalendarClock, Target, AlertTriangle, ShieldAlert } from 'lucide-react';
import { format, parseISO, subMonths } from 'date-fns';
import { Header } from '../components/layout/Header';
import { KPICard, KPIGrid } from '../components/cards/KPICard';
import { ChartCard, StatCard } from '../components/cards/ChartCard';
import { ForecastChart } from '../components/charts/ForecastChart';
import { RankedBars } from '../components/charts/RankedBars';
import { RiskScatter } from '../components/charts/RiskScatter';
import { SeasonalityChart } from '../components/charts/SeasonalityChart';
import { formatCurrency, formatDate, formatMonthYear } from '../utils/formatters';
import { labelFor } from '../utils/colors';
import {
  useForecastingKpis,
  useModelPerformance,
  useRevenueAtRisk,
  useRevenueForecast,
  useRiskValue,
  useSeasonality,
} from '../hooks/useApi';
import type { ForecastPoint, RiskPoint } from '../types';

/** Feature names from the model, in words. */
const FEATURE_WORDS: Record<string, string> = {
  recency_days: 'Days since last order',
  monetary_total: 'Total spend',
  monetary_avg: 'Average order size',
  tenure_days: 'Time as a customer',
  spend_trend: 'Share of spend in the last 90 days',
  refund_rate: 'Refund rate',
  frequency: 'Number of orders',
  active_months: 'Months with an order',
};

/** One-hot columns arrive as "region_Asia Pacific", named for the field they came from. */
const CATEGORICAL: [string, string][] = [
  ['acquisition_channel_', 'Channel'],
  ['segment_', 'Segment'],
  ['industry_', 'Industry'],
  ['region_', 'Region'],
];

function featureLabel(name: string): string {
  if (FEATURE_WORDS[name]) return FEATURE_WORDS[name];
  for (const [prefix, field] of CATEGORICAL) {
    if (name.startsWith(prefix)) return `${field}: ${labelFor(name.slice(prefix.length))}`;
  }
  return name;
}

export function Forecasting() {
  const kpis = useForecastingKpis();
  const model = useModelPerformance();
  const forecast = useRevenueForecast();
  const seasonality = useSeasonality();
  const risk = useRiskValue();
  const atRisk = useRevenueAtRisk();

  const k = kpis.data;
  const revenue = model.data?.revenue;
  const churn = model.data?.churn;
  const tiers = atRisk.data;
  const modelRows = [
    ...(revenue
      ? [
          { measure: 'Forecast error, this model', value: `${revenue.mape.toFixed(1)}%` },
          { measure: 'Forecast error, same month last year', value: `${revenue.seasonalNaiveMape.toFixed(1)}%` },
          { measure: 'Forecast error, repeat last month', value: `${revenue.naiveMape.toFixed(1)}%` },
        ]
      : []),
    ...(churn
      ? [
          { measure: 'Churn ROC AUC', value: churn.rocAuc.toFixed(3) },
          { measure: 'Churn precision', value: `${(churn.precision * 100).toFixed(1)}%` },
          { measure: 'Churn recall', value: `${(churn.recall * 100).toFixed(1)}%` },
          { measure: 'Churn base rate', value: `${(churn.baseRate * 100).toFixed(1)}%` },
          ...Object.entries(churn.topFeatures).map(([name, weight]) => ({
            measure: `Churn driver, ${featureLabel(name)}`,
            value: `${(weight * 100).toFixed(1)}%`,
          })),
        ]
      : []),
  ];

  const predicted = k?.predictedMonth ? parseISO(k.predictedMonth) : null;
  const month = predicted ? format(predicted, 'MMMM') : null;
  const priorMonth = predicted ? format(subMonths(predicted, 1), 'MMMM') : null;

  return (
    <>
      <Header title="Forecasting" subtitle="Models trained on all history and scored as of the latest data" />
      <div className="mx-auto max-w-[1680px] space-y-4 p-4 lg:p-6">
        <KPIGrid>
          <KPICard
            label={month ? `${month} forecast` : 'Next month forecast'}
            value={k?.predictedRevenue ?? null}
            changePercent={k?.predictedChange}
            comparison={priorMonth ? `vs ${priorMonth}'s actual revenue` : undefined}
            format="currency"
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            loading={kpis.isLoading}
          />
          <KPICard
            label="Forecast error"
            value={revenue?.mape ?? null}
            caption={revenue ? `Repeating last month misses by ${revenue.naiveMape.toFixed(1)}%` : undefined}
            format="percent"
            icon={<Target className="h-3.5 w-3.5" />}
            loading={model.isLoading}
          />
          <KPICard
            label="Customers at risk"
            value={k?.atRiskCount ?? null}
            caption={k ? `${Math.round(k.atRiskThreshold * 100)}% or higher chance of no order in 90 days` : undefined}
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            loading={kpis.isLoading}
          />
          <KPICard
            label="Revenue at risk"
            value={tiers?.total ?? null}
            caption="Their revenue over the last 12 months"
            format="currency"
            icon={<ShieldAlert className="h-3.5 w-3.5" />}
            loading={atRisk.isLoading}
          />
        </KPIGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="h-[400px] lg:col-span-2"
            title="Revenue forecast"
            subtitle={
              revenue
                ? `Six months ahead. Backtested on ${revenue.holdoutMonths} held-out months and ${revenue.improvementOverNaive.toFixed(0)}% more accurate than repeating last month`
                : 'Six months ahead'
            }
            loading={forecast.isLoading}
            error={forecast.error}
            table={{
              filename: 'revenue-forecast',
              rows: forecast.data ?? [],
              columns: [
                { key: 'date', header: 'Month', format: (r: ForecastPoint) => formatMonthYear(r.date) },
                { key: 'actual', header: 'Actual', align: 'right', format: (r: ForecastPoint) => (r.actual == null ? '' : formatCurrency(r.actual)) },
                { key: 'backtest', header: 'Backtest', align: 'right', format: (r: ForecastPoint) => (r.backtest == null ? '' : formatCurrency(r.backtest)) },
                { key: 'predicted', header: 'Forecast', align: 'right', format: (r: ForecastPoint) => (r.predicted == null || r.actual != null ? '' : formatCurrency(r.predicted)) },
                { key: 'lowerBound', header: '80% low', align: 'right', format: (r: ForecastPoint) => (r.actual != null || r.lowerBound == null ? '' : formatCurrency(r.lowerBound)) },
                { key: 'upperBound', header: '80% high', align: 'right', format: (r: ForecastPoint) => (r.actual != null || r.upperBound == null ? '' : formatCurrency(r.upperBound)) },
                { key: 'lower95', header: '95% low', align: 'right', format: (r: ForecastPoint) => (r.actual != null || r.lower95 == null ? '' : formatCurrency(r.lower95)) },
                { key: 'upper95', header: '95% high', align: 'right', format: (r: ForecastPoint) => (r.actual != null || r.upper95 == null ? '' : formatCurrency(r.upper95)) },
              ],
            }}
          >
            <ForecastChart data={forecast.data ?? []} />
          </ChartCard>

          <ChartCard
            className="h-[400px]"
            title="Seasonality"
            subtitle="Each calendar month against an average month over two years"
            loading={seasonality.isLoading}
            error={seasonality.error}
            table={{
              filename: 'seasonality',
              rows: seasonality.data ?? [],
              columns: [
                { key: 'month', header: 'Month' },
                { key: 'index', header: 'Index', align: 'right', format: (r) => r.index.toFixed(2) },
              ],
            }}
          >
            <SeasonalityChart data={seasonality.data ?? []} />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="h-[440px] lg:col-span-2"
            title="Churn risk against customer value"
            subtitle={
              risk.data?.scored != null
                ? `All ${risk.data.scored.toLocaleString()} live customers. Up and to the right is worth a call this week`
                : undefined
            }
            loading={risk.isLoading}
            error={risk.error}
            table={{
              filename: 'churn-risk-by-customer',
              rows: [...(risk.data?.points ?? [])].sort((a, b) => b.riskScore - a.riskScore),
              columns: [
                { key: 'company', header: 'Account' },
                { key: 'segment', header: 'Segment', format: (r: RiskPoint) => labelFor(r.segment) },
                { key: 'riskScore', header: 'Churn probability', align: 'right', format: (r: RiskPoint) => `${Math.round(r.riskScore * 100)}%` },
                { key: 'annualRevenue', header: 'Last 12 months', align: 'right', format: (r: RiskPoint) => formatCurrency(r.annualRevenue) },
              ],
            }}
          >
            <RiskScatter points={risk.data?.points ?? []} threshold={risk.data?.threshold ?? 0.5} />
          </ChartCard>

          <ChartCard
            className="h-[440px]"
            title="Revenue at risk"
            subtitle="Last 12 months of revenue from customers in each risk tier"
            loading={atRisk.isLoading}
            error={atRisk.error}
            flow
            table={{
              filename: 'revenue-at-risk',
              rows: tiers ? [tiers.highRisk, tiers.mediumRisk, tiers.lowRisk] : [],
              columns: [
                { key: 'label', header: 'Tier' },
                { key: 'threshold', header: 'Churn probability' },
                { key: 'customers', header: 'Customers', align: 'right' },
                { key: 'value', header: 'Revenue', align: 'right', format: (r) => formatCurrency(r.value) },
              ],
            }}
          >
            {tiers && (
              <div className="space-y-5">
                <RankedBars
                  keepOrder
                  rows={[
                    { tier: tiers.highRisk, color: 'var(--color-status-critical)' },
                    { tier: tiers.mediumRisk, color: 'var(--color-status-serious)' },
                  ].map(({ tier, color }) => ({
                    key: tier.label,
                    label: tier.label,
                    value: tier.value,
                    display: formatCurrency(tier.value, true),
                    detail: `${tier.customers} customers, ${tier.threshold}`,
                    color,
                  }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <StatCard title="At risk" value={formatCurrency(tiers.total, true)} subtitle={`${tiers.totalCustomers} customers`} />
                  <StatCard
                    title="Low risk"
                    value={formatCurrency(tiers.lowRisk.value, true)}
                    subtitle={`${tiers.lowRisk.customers.toLocaleString()} customers`}
                  />
                </div>
                <p className="text-[11px] leading-relaxed text-gray-500">
                  Risk is the churn model's probability that a customer places no order in the next 90 days. The tiers
                  count what those customers spent over the last year. That is what losing them would cost.
                </p>
              </div>
            )}
          </ChartCard>
        </div>

        <ChartCard
          title="How the models were checked"
          subtitle="Every figure measured on data the model never trained on"
          loading={model.isLoading}
          error={model.error}
          flow
          table={{
            filename: 'model-checks',
            rows: modelRows,
            columns: [
              { key: 'measure', header: 'Measure' },
              { key: 'value', header: 'Value', align: 'right' },
            ],
          }}
        >
          {model.data?.available === false ? (
            <p className="text-sm text-gray-400">No model is available: {model.data.reason}</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {revenue && (
                <section>
                  <h4 className="mb-1 text-xs font-semibold text-white">Revenue forecast error</h4>
                  <p className="mb-3 text-[11px] text-gray-500">
                    Mean absolute percentage error on the last {revenue.holdoutMonths} months where lower is better
                  </p>
                  <RankedBars
                    keepOrder
                    rows={[
                      { key: 'model', label: 'This model', value: revenue.mape, color: 'var(--color-chart-1)' },
                      { key: 'seasonal', label: 'Same month last year', value: revenue.seasonalNaiveMape, color: 'var(--color-ink-muted)' },
                      { key: 'naive', label: 'Repeat last month', value: revenue.naiveMape, color: 'var(--color-ink-muted)' },
                    ].map((r) => ({ ...r, display: `${r.value.toFixed(1)}%` }))}
                  />
                  <p className="mt-3 text-[11px] text-gray-500">{revenue.model}</p>
                </section>
              )}
              {churn && (
                <section>
                  <h4 className="mb-1 text-xs font-semibold text-white">Churn model</h4>
                  <p className="mb-3 text-[11px] text-gray-500">
                    Trained on customers as they stood on {churn.cutoff ? formatDate(churn.cutoff) : 'the cutoff'} and labeled
                    by whether they ordered in the {churn.horizonDays} days after
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <StatCard title="ROC AUC" value={churn.rocAuc.toFixed(2)} subtitle="0.5 is a coin flip" />
                    <StatCard title="Base rate" value={`${(churn.baseRate * 100).toFixed(0)}%`} subtitle="Went quiet for 90 days" />
                    <StatCard title="Precision" value={`${(churn.precision * 100).toFixed(0)}%`} subtitle="Flagged who did go quiet" />
                    <StatCard title="Recall" value={`${(churn.recall * 100).toFixed(0)}%`} subtitle="Went quiet and were flagged" />
                  </div>
                </section>
              )}
              {churn && (
                <section>
                  <h4 className="mb-1 text-xs font-semibold text-white">What drives churn risk</h4>
                  <p className="mb-3 text-[11px] text-gray-500">How much of the model's fit each feature contributes</p>
                  <RankedBars
                    dense
                    labelWidth="48%"
                    rows={Object.entries(churn.topFeatures)
                      .slice(0, 6)
                      .map(([name, weight]) => ({
                        key: name,
                        label: featureLabel(name),
                        value: weight,
                        display: `${(weight * 100).toFixed(0)}%`,
                      }))}
                  />
                </section>
              )}
            </div>
          )}
        </ChartCard>
      </div>
    </>
  );
}
