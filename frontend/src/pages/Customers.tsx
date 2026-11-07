import { Users, UserPlus, AlertTriangle, UserMinus } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard, KPIGrid } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { BarChart } from '../components/charts/BarChart';
import { CohortHeatmap } from '../components/charts/CohortHeatmap';
import { RankedBars } from '../components/charts/RankedBars';
import { DataTable } from '../components/tables/DataTable';
import { colorFor, colorsFor, labelFor } from '../utils/colors';
import { daysInclusive, formatCurrency, formatNumber, formatShare } from '../utils/formatters';
import {
  useAtRiskCustomers,
  useCohorts,
  useCustomerAcquisition,
  useCustomerOverview,
  useCustomerSegments,
  useLifetimeValue,
} from '../hooks/useApi';
import { useFilters } from '../hooks/useFilters';
import type { Cohort, SplitPoint } from '../types';

const SEGMENT_ORDER = ['enterprise', 'mid-market', 'smb'];

export function Customers() {
  const { filters } = useFilters();
  const { startDate, endDate } = filters.dateRange;
  const comparison = `vs prior ${daysInclusive(startDate, endDate)} days`;

  const overview = useCustomerOverview();
  const cohorts = useCohorts();
  const segments = useCustomerSegments();
  const acquisition = useCustomerAcquisition();
  const ltv = useLifetimeValue();
  const atRisk = useAtRiskCustomers(10);

  const o = overview.data;
  const threshold = Math.round((o?.atRiskThreshold ?? 0.5) * 100);
  const channelKeys = acquisition.data?.keys ?? [];
  const monthly = acquisition.data?.granularity === 'month';
  const segmentRows = [...(segments.data ?? [])].sort(
    (a, b) => SEGMENT_ORDER.indexOf(a.segment) - SEGMENT_ORDER.indexOf(b.segment),
  );

  return (
    <>
      <Header title="Customers" />
      <div className="mx-auto max-w-[1680px] space-y-4 p-4 lg:p-6">
        <KPIGrid>
          <KPICard
            label="Active customers"
            value={o?.total ?? null}
            changePercent={o?.totalChange}
            comparison={comparison}
            caption="Placed a completed order in the period"
            icon={<Users className="h-3.5 w-3.5" />}
            loading={overview.isLoading}
          />
          <KPICard
            label="New customers"
            value={o?.new ?? null}
            changePercent={o?.newChange}
            comparison={comparison}
            caption="First order in the period"
            icon={<UserPlus className="h-3.5 w-3.5" />}
            loading={overview.isLoading}
          />
          <KPICard
            label="At risk"
            value={o?.atRisk ?? null}
            caption={`${threshold}% or higher chance of no order in 90 days`}
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            loading={overview.isLoading}
          />
          <KPICard
            label="Churned"
            value={o?.churned ?? null}
            caption="All time as recorded on the account"
            icon={<UserMinus className="h-3.5 w-3.5" />}
            loading={overview.isLoading}
          />
        </KPIGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="h-[480px] lg:col-span-2"
            title="Retention by first-purchase cohort"
            subtitle="Percent of each month's new customers who ordered again in each month after"
            loading={cohorts.isLoading}
            error={cohorts.error}
            flow
            table={{
              filename: 'cohort-retention',
              rows: cohorts.data ?? [],
              columns: [
                { key: 'label', header: 'Cohort' },
                { key: 'size', header: 'Customers', align: 'right' },
                ...Array.from({ length: 12 }, (_, m) => ({
                  key: `m${m}`,
                  header: `M${m}`,
                  align: 'right' as const,
                  format: (r: Cohort) => (r.retention[m] == null ? '' : `${r.retention[m]}%`),
                  raw: (r: Cohort) => r.retention[m] ?? '',
                })),
              ],
            }}
          >
            <CohortHeatmap cohorts={cohorts.data ?? []} />
          </ChartCard>

          <ChartCard
            className="h-[480px]"
            title="Revenue by segment"
            subtitle="Customers active in the period and what they spent"
            loading={segments.isLoading}
            error={segments.error}
            flow
            table={{
              filename: 'revenue-by-segment',
              rows: segmentRows,
              columns: [
                { key: 'segment', header: 'Segment', format: (r) => labelFor(r.segment) },
                { key: 'count', header: 'Customers', align: 'right' },
                { key: 'revenue', header: 'Revenue', align: 'right', format: (r) => formatCurrency(r.revenue) },
              ],
            }}
          >
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">Revenue</p>
                <RankedBars
                  keepOrder
                  rows={segmentRows.map((s) => ({
                    key: s.segment,
                    label: labelFor(s.segment),
                    value: s.revenue,
                    display: formatCurrency(s.revenue, true),
                    color: colorFor('segment', s.segment),
                  }))}
                />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">Active customers</p>
                <RankedBars
                  keepOrder
                  rows={segmentRows.map((s) => ({
                    key: s.segment,
                    label: labelFor(s.segment),
                    value: s.count,
                    display: formatNumber(s.count),
                    color: colorFor('segment', s.segment),
                  }))}
                />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">Revenue per customer</p>
                <RankedBars
                  keepOrder
                  rows={segmentRows.map((s) => ({
                    key: s.segment,
                    label: labelFor(s.segment),
                    value: s.count ? s.revenue / s.count : 0,
                    display: formatCurrency(s.count ? s.revenue / s.count : 0, true),
                    color: colorFor('segment', s.segment),
                  }))}
                />
              </div>
            </div>
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="h-[320px] lg:col-span-2"
            title="New customers by acquisition channel"
            subtitle={monthly ? 'Counted in whole months' : acquisition.data?.granularity === 'week' ? 'Counted in whole weeks' : 'Counted by day'}
            loading={acquisition.isLoading}
            error={acquisition.error}
            table={{
              filename: 'new-customers-by-channel',
              rows: acquisition.data?.points ?? [],
              columns: [
                { key: 'label', header: 'Period' },
                ...channelKeys.map((key) => ({
                  key,
                  header: key,
                  align: 'right' as const,
                  format: (r: SplitPoint) => String(r[key]),
                })),
              ],
            }}
          >
            <BarChart
              data={acquisition.data?.points ?? []}
              xKey="label"
              yKeys={channelKeys}
              labels={Object.fromEntries(channelKeys.map((key) => [key, key]))}
              colors={colorsFor('acquisition', channelKeys)}
              formatY="number"
              formatX={(label) => (monthly ? label.split(' ')[0] : label)}
              stacked
              showTotal
            />
          </ChartCard>

          <ChartCard
            className="h-[320px]"
            title="Lifetime value"
            subtitle="Every customer to date by revenue so far"
            loading={ltv.isLoading}
            error={ltv.error}
            flow
            table={{
              filename: 'lifetime-value',
              rows: ltv.data ?? [],
              columns: [
                { key: 'range', header: 'Lifetime value' },
                { key: 'count', header: 'Customers', align: 'right' },
                { key: 'percentage', header: 'Share', align: 'right', format: (r) => `${r.percentage}%` },
              ],
            }}
          >
            {/* Bands as rows, so every band's name fits on its line. As columns in a
              * third-width card the seven labels ran into each other. */}
            <RankedBars
              keepOrder
              dense
              labelWidth="36%"
              rows={(ltv.data ?? []).map((b) => ({
                key: b.range,
                label: b.range,
                value: b.count,
                display: b.count.toLocaleString(),
                share: formatShare(b.percentage),
              }))}
            />
          </ChartCard>
        </div>

        <ChartCard
          title="Accounts most likely to stop buying"
          subtitle="Live customers ranked by the churn model's probability of no order in the next 90 days"
          loading={atRisk.isLoading}
          error={atRisk.error}
          flow
          noPadding
        >
          <DataTable
            data={(atRisk.data ?? []).map((c) => ({ ...c }))}
            keyExtractor={(row) => Number(row.id)}
            className="[&>table]:min-w-[640px]"
            compact
            columns={[
              { key: 'company', header: 'Account', sortable: true },
              { key: 'segment', header: 'Segment', sortable: true, render: (v) => labelFor(String(v)) },
              {
                key: 'riskScore',
                header: 'Churn probability',
                sortable: true,
                align: 'right',
                render: (v) => <RiskCell value={Number(v)} />,
              },
              {
                key: 'daysSinceActivity',
                header: 'Last order',
                sortable: true,
                align: 'right',
                render: (v) => `${Number(v)} days ago`,
              },
              {
                key: 'annualRevenue',
                header: 'Last 12 months',
                sortable: true,
                align: 'right',
                render: (v) => formatCurrency(Number(v), true),
              },
              {
                key: 'lifetimeValue',
                header: 'Lifetime',
                sortable: true,
                align: 'right',
                render: (v) => formatCurrency(Number(v), true),
              },
              { key: 'recommendation', header: 'Next step' },
            ]}
          />
        </ChartCard>
      </div>
    </>
  );
}

function RiskCell({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="hidden h-1.5 w-16 rounded-full bg-gray-800 sm:block" aria-hidden="true">
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, background: 'var(--color-status-critical)' }}
        />
      </span>
      <span className="w-9 tabular-nums">{pct}%</span>
    </span>
  );
}
