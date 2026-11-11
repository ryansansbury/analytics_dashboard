import { Layers, Trophy, Coins, Timer } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard, KPIGrid } from '../components/cards/KPICard';
import { ChartCard, StatCard } from '../components/cards/ChartCard';
import { AttainmentBars } from '../components/charts/AttainmentBars';
import { BarChart } from '../components/charts/BarChart';
import { RankedBars } from '../components/charts/RankedBars';
import { SankeyChart } from '../components/charts/SankeyChart';
import { format, parseISO, subDays } from 'date-fns';
import { daysInclusive, formatCurrency, formatDate, formatDateRange, getOrdinalColor } from '../utils/formatters';
import {
  useCycleTime,
  usePipelineFlow,
  usePipelineKpis,
  usePipelineOutlook,
  useSalesPerformance,
} from '../hooks/useApi';
import { useFilters } from '../hooks/useFilters';

export function Operations() {
  const { filters } = useFilters();
  const { startDate, endDate } = filters.dateRange;
  const comparison = `vs prior ${daysInclusive(startDate, endDate)} days`;

  const kpis = usePipelineKpis();
  const flow = usePipelineFlow();
  const stages = useCycleTime();
  const reps = useSalesPerformance();
  const outlook = usePipelineOutlook();

  const k = kpis.data;
  const totals = (outlook.data ?? []).reduce(
    (t, m) => ({ worst: t.worst + m.worst, weighted: t.weighted + m.weighted, best: t.best + m.best }),
    { worst: 0, weighted: 0, best: 0 },
  );
  const stageRows = (stages.data ?? []).filter((s) => s.avgDays != null);
  const linkRows = (flow.data?.links ?? []).map((l) => ({
    from: flow.data!.nodes[l.source].name,
    to: flow.data!.nodes[l.target].name,
    deals: l.value,
    amount: l.amount,
  }));

  return (
    <>
      <Header title="Sales Operations" />
      <div className="mx-auto max-w-[1680px] space-y-4 p-4 lg:p-6">
        <KPIGrid>
          <KPICard
            label="Open pipeline"
            value={k?.pipelineValue ?? null}
            changePercent={k?.pipelineChange}
            comparison={`vs ${formatDate(format(subDays(parseISO(startDate), 1), 'yyyy-MM-dd'), 'MMM d, yyyy')}`}
            caption={k ? `${k.openDeals} deals open at the end of the period` : undefined}
            format="currency"
            icon={<Layers className="h-3.5 w-3.5" />}
            loading={kpis.isLoading}
          />
          <KPICard
            label="Win rate"
            value={k?.winRate ?? null}
            changePercent={k?.winRateChange}
            changeUnit="pts"
            comparison={comparison}
            caption={k ? `${k.dealsWon} won and ${k.dealsLost} lost in the period` : undefined}
            format="percent"
            icon={<Trophy className="h-3.5 w-3.5" />}
            loading={kpis.isLoading}
          />
          <KPICard
            label="Average won deal"
            value={k?.avgDealSize ?? null}
            changePercent={k?.dealSizeChange}
            comparison={comparison}
            caption="Deals closed won in the period"
            format="currency"
            icon={<Coins className="h-3.5 w-3.5" />}
            loading={kpis.isLoading}
          />
          <KPICard
            label="Sales cycle"
            value={k?.avgCycleTime ?? null}
            changePercent={k?.cycleTimeChange}
            invert
            comparison={comparison}
            caption="From first contact to the win"
            format="days"
            icon={<Timer className="h-3.5 w-3.5" />}
            loading={kpis.isLoading}
          />
        </KPIGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="h-[420px] lg:col-span-2"
            title="Where new deals went"
            subtitle={
              flow.data
                ? `${flow.data.created.toLocaleString()} deals created from ${formatDateRange(flow.data.startDate, flow.data.endDate)} and followed to today`
                : undefined
            }
            loading={flow.isLoading}
            error={flow.error}
            table={{
              filename: 'pipeline-flow',
              rows: linkRows,
              columns: [
                { key: 'from', header: 'From' },
                { key: 'to', header: 'To' },
                { key: 'deals', header: 'Deals', align: 'right' },
                { key: 'amount', header: 'Deal value', align: 'right', format: (r) => formatCurrency(r.amount) },
              ],
            }}
          >
            {flow.data && (
              <div className="h-full overflow-x-auto">
                <div className="h-full min-w-[560px]">
                  <SankeyChart flow={flow.data} />
                </div>
              </div>
            )}
          </ChartCard>

          <ChartCard
            className="h-[420px]"
            title="Days in each stage"
            subtitle="Average time before a deal moved on or closed in the last 12 months"
            loading={stages.isLoading}
            error={stages.error}
            flow
            table={{
              filename: 'days-in-stage',
              rows: stageRows,
              columns: [
                { key: 'stage', header: 'Stage' },
                { key: 'avgDays', header: 'Average days', align: 'right' },
                { key: 'count', header: 'Deals measured', align: 'right' },
              ],
            }}
          >
            <RankedBars
              keepOrder
              rows={stageRows.map((s, i) => ({
                key: s.stage,
                label: s.stage,
                value: s.avgDays ?? 0,
                display: `${(s.avgDays ?? 0).toFixed(1)} days`,
                detail: `${s.count.toLocaleString()} deals left this stage`,
                color: getOrdinalColor(i, stageRows.length),
              }))}
            />
            <p className="mt-4 text-[11px] leading-relaxed text-gray-500">
              Measured from each deal's stage history. A deal that stalled counts for exactly the days it spent.
            </p>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="h-[620px] lg:col-span-2"
            title="Quota attainment"
            subtitle="Each rep's bookings against their quota for these dates"
            loading={reps.isLoading}
            error={reps.error}
            flow
            table={{
              filename: 'quota-attainment',
              rows: reps.data ?? [],
              columns: [
                { key: 'name', header: 'Rep' },
                { key: 'team', header: 'Team' },
                { key: 'region', header: 'Region' },
                { key: 'achieved', header: 'Booked', align: 'right', format: (r) => formatCurrency(r.achieved) },
                { key: 'periodQuota', header: 'Quota for the period', align: 'right', format: (r) => formatCurrency(r.periodQuota) },
                { key: 'attainment', header: 'Attainment', align: 'right', format: (r) => (r.attainment == null ? '—' : `${r.attainment}%`) },
              ],
            }}
          >
            <AttainmentBars reps={reps.data ?? []} />
          </ChartCard>

          <ChartCard
            className="h-[620px]"
            title="Pipeline outlook"
            subtitle="Open deals by expected close month"
            loading={outlook.isLoading}
            error={outlook.error}
            table={{
              filename: 'pipeline-outlook',
              rows: outlook.data ?? [],
              columns: [
                { key: 'month', header: 'Month' },
                { key: 'worst', header: 'Commit', align: 'right', format: (r) => formatCurrency(r.worst) },
                { key: 'weighted', header: 'Expected', align: 'right', format: (r) => formatCurrency(r.weighted) },
                { key: 'best', header: 'Best case', align: 'right', format: (r) => formatCurrency(r.best) },
              ],
            }}
          >
            <div className="flex h-full flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                <StatCard title="Commit" value={formatCurrency(totals.worst, true)} subtitle="Negotiation, weighted" />
                <StatCard title="Expected" value={formatCurrency(totals.weighted, true)} subtitle="All open, weighted" />
                <StatCard title="Best case" value={formatCurrency(totals.best, true)} subtitle="All open, full value" />
              </div>
              <div className="min-h-0 flex-1">
                <BarChart
                  data={(outlook.data ?? []).map((m) => ({ ...m }))}
                  xKey="month"
                  yKeys={['worst', 'weighted', 'best']}
                  labels={{ worst: 'Commit', weighted: 'Expected', best: 'Best case' }}
                  colors={['var(--color-ordinal-5)', 'var(--color-ordinal-3)', 'var(--color-ordinal-1)']}
                />
              </div>
              <p className="text-[11px] leading-relaxed text-gray-500">
                Each deal counts at its stage's probability of closing. Commit takes only the deals already in
                negotiation, and best case counts every open deal at full value.
              </p>
            </div>
          </ChartCard>
        </div>
      </div>
    </>
  );
}
