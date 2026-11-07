import { DollarSign, Users, ShoppingCart, Layers } from 'lucide-react';
import clsx from 'clsx';
import { Header } from '../components/layout/Header';
import { KPICard, KPIGrid } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { ComparisonChart } from '../components/charts/ComparisonChart';
import { RankedBars } from '../components/charts/RankedBars';
import { CalendarHeatmap } from '../components/charts/CalendarHeatmap';
import {
  daysInclusive,
  formatChange,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatShare,
  getOrdinalColor,
} from '../utils/formatters';
import {
  useDashboardSummary,
  usePipeline,
  useRevenueByCategory,
  useRevenueCalendar,
  useRevenueComparison,
} from '../hooks/useApi';
import { useFilters } from '../hooks/useFilters';
import type { ComparisonPoint } from '../types';

const BUCKET_WORD = { day: 'Daily', week: 'Weekly', month: 'Monthly' } as const;
const OPEN_STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation'];

export function Dashboard() {
  const { filters } = useFilters();
  const { startDate, endDate } = filters.dateRange;
  const comparison = `vs prior ${daysInclusive(startDate, endDate)} days`;

  const summary = useDashboardSummary();
  const yoy = useRevenueComparison();
  const categories = useRevenueByCategory();
  const calendar = useRevenueCalendar();
  const pipeline = usePipeline();

  const kpis = summary.data?.kpis;
  const trends = summary.data?.trends;
  const values = (series?: { value: number | null }[]) => series?.map((p) => p.value);

  const yoyChange = formatChange(yoy.data?.change);
  const stages = (pipeline.data ?? []).filter((s) => OPEN_STAGES.includes(s.stage));
  const openTotal = stages.reduce((sum, s) => sum + s.value, 0);

  return (
    <>
      <Header title="Executive Overview" />
      <div className="mx-auto max-w-[1680px] space-y-4 p-4 lg:p-6">
        <KPIGrid>
          <KPICard
            label="Revenue"
            value={kpis?.totalRevenue.value ?? null}
            changePercent={kpis?.totalRevenue.changePercent}
            comparison={comparison}
            format="currency"
            trend={values(trends?.revenue)}
            icon={<DollarSign className="h-3.5 w-3.5" />}
            loading={summary.isLoading}
          />
          <KPICard
            label="Active customers"
            value={kpis?.totalCustomers.value ?? null}
            changePercent={kpis?.totalCustomers.changePercent}
            comparison={comparison}
            format="number"
            trend={values(trends?.customers)}
            icon={<Users className="h-3.5 w-3.5" />}
            loading={summary.isLoading}
          />
          <KPICard
            label="Average order"
            value={kpis?.avgOrderValue.value ?? null}
            changePercent={kpis?.avgOrderValue.changePercent}
            comparison={comparison}
            format="currency"
            trend={values(trends?.aov)}
            icon={<ShoppingCart className="h-3.5 w-3.5" />}
            loading={summary.isLoading}
          />
          <KPICard
            label="Open pipeline"
            value={kpis?.pipelineValue.value ?? null}
            changePercent={kpis?.pipelineValue.changePercent}
            comparison={
              summary.data ? `vs ${formatDate(summary.data.dateRange.previousEndDate, 'MMM d, yyyy')}` : undefined
            }
            format="currency"
            trend={values(trends?.pipeline)}
            icon={<Layers className="h-3.5 w-3.5" />}
            loading={summary.isLoading}
          />
        </KPIGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="h-[330px] lg:col-span-2"
            title="Revenue against last year"
            subtitle={
              yoy.data
                ? `${BUCKET_WORD[yoy.data.granularity]} revenue from ${formatDateRange(yoy.data.startDate, yoy.data.endDate)}`
                : undefined
            }
            actions={
              yoyChange && (
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                    (yoy.data?.change ?? 0) >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger',
                  )}
                >
                  {yoyChange} on last year
                </span>
              )
            }
            loading={yoy.isLoading}
            error={yoy.error}
            table={{
              filename: 'revenue-against-last-year',
              rows: yoy.data?.points ?? [],
              columns: [
                { key: 'label', header: 'Period' },
                { key: 'current', header: 'This year', align: 'right', format: (r: ComparisonPoint) => formatCurrency(r.current) },
                { key: 'previous', header: 'Last year', align: 'right', format: (r: ComparisonPoint) => formatCurrency(r.previous) },
                {
                  key: 'change',
                  header: 'Change',
                  align: 'right',
                  format: (r: ComparisonPoint) => formatChange(r.previous ? ((r.current - r.previous) / r.previous) * 100 : null) ?? '—',
                  raw: (r: ComparisonPoint) => (r.previous ? ((r.current - r.previous) / r.previous) * 100 : ''),
                },
              ],
            }}
          >
            <ComparisonChart data={yoy.data?.points ?? []} monthly={yoy.data?.granularity === 'month'} />
          </ChartCard>

          <ChartCard
            className="h-[330px]"
            title="Revenue by category"
            subtitle="Share of revenue in the period"
            loading={categories.isLoading}
            error={categories.error}
            flow
            table={{
              filename: 'revenue-by-category',
              rows: categories.data ?? [],
              columns: [
                { key: 'category', header: 'Category' },
                { key: 'value', header: 'Revenue', align: 'right', format: (r) => formatCurrency(r.value) },
                { key: 'percentage', header: 'Share', align: 'right', format: (r) => `${r.percentage}%` },
              ],
            }}
          >
            <RankedBars
              dense
              rows={(categories.data ?? []).map((c) => ({
                key: c.category,
                label: c.category,
                value: c.value,
                display: formatCurrency(c.value, true),
                share: formatShare(c.percentage),
              }))}
              labelWidth="46%"
            />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="h-[262px] lg:col-span-2"
            title="Daily revenue"
            subtitle={calendar.data ? `Every day from ${formatDateRange(calendar.data.startDate, calendar.data.endDate)}` : undefined}
            loading={calendar.isLoading}
            error={calendar.error}
            flow
            table={{
              filename: 'daily-revenue',
              rows: calendar.data?.days ?? [],
              columns: [
                { key: 'date', header: 'Date', format: (r) => formatDate(r.date, 'EEE, MMM d, yyyy') },
                { key: 'revenue', header: 'Revenue', align: 'right', format: (r) => formatCurrency(r.revenue) },
              ],
            }}
          >
            <CalendarHeatmap days={calendar.data?.days ?? []} />
          </ChartCard>

          <ChartCard
            className="h-[262px]"
            title="Open pipeline by stage"
            subtitle={stages.length ? `${formatCurrency(openTotal, true)} across ${stages.reduce((n, s) => n + s.count, 0)} deals` : undefined}
            loading={pipeline.isLoading}
            error={pipeline.error}
            flow
            table={{
              filename: 'open-pipeline',
              rows: stages,
              columns: [
                { key: 'stage', header: 'Stage' },
                { key: 'count', header: 'Deals', align: 'right' },
                { key: 'value', header: 'Value', align: 'right', format: (r) => formatCurrency(r.value) },
              ],
            }}
          >
            <RankedBars
              keepOrder
              rows={stages.map((s, i) => ({
                key: s.stage,
                label: s.stage,
                value: s.value,
                display: formatCurrency(s.value, true),
                detail: `${s.count} deals`,
                color: getOrdinalColor(i, stages.length),
              }))}
            />
          </ChartCard>
        </div>
      </div>
    </>
  );
}
