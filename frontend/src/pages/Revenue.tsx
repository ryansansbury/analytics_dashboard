import { DollarSign, ShoppingCart, Receipt, UserRound } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard, KPIGrid } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { AreaChart } from '../components/charts/AreaChart';
import { BarChart } from '../components/charts/BarChart';
import { SmallMultiples } from '../components/charts/SmallMultiples';
import { DataTable } from '../components/tables/DataTable';
import { colorFor, colorsFor, labelFor } from '../utils/colors';
import { daysInclusive, formatChange, formatCurrency } from '../utils/formatters';
import {
  useCategoryTrends,
  useDashboardSummary,
  useOrderSizes,
  useRegionTrends,
  useRevenueByChannel,
  useTopProducts,
} from '../hooks/useApi';
import { useFilters } from '../hooks/useFilters';
import type { SplitPoint } from '../types';

const BUCKET_WORD = { day: 'Daily', week: 'Weekly', month: 'Monthly' } as const;

function ratio(a: number | null | undefined, b: number | null | undefined): number | null {
  return a == null || !b ? null : a / b;
}

function change(now: number | null, before: number | null): number | null {
  return now == null || !before ? null : ((now - before) / before) * 100;
}

export function Revenue() {
  const { filters } = useFilters();
  const { startDate, endDate } = filters.dateRange;
  const comparison = `vs prior ${daysInclusive(startDate, endDate)} days`;

  const summary = useDashboardSummary();
  const categories = useCategoryTrends();
  const regions = useRegionTrends();
  const channels = useRevenueByChannel();
  const sizes = useOrderSizes();
  const products = useTopProducts(10);

  const k = summary.data?.kpis;
  const t = summary.data?.trends;

  // Revenue per active customer, now and in the prior window, from figures
  // the summary already measured.
  const perCustomer = ratio(k?.totalRevenue.value, k?.totalCustomers.value);
  const perCustomerBefore = ratio(k?.totalRevenue.previousValue, k?.totalCustomers.previousValue);
  const perCustomerTrend = t?.revenue.map((p, i) => ratio(p.value, t.customers[i]?.value));
  const ordersTrend = t?.revenue.map((p, i) => ratio(p.value, t.aov[i]?.value));

  const monthly = categories.data?.granularity === 'month';
  const tick = (label: string) => (monthly ? label.split(' ')[0] : label);
  const categoryKeys = categories.data?.keys ?? [];
  const categoryLabels = Object.fromEntries(categoryKeys.map((key) => [key, key]));

  return (
    <>
      <Header title="Revenue" />
      <div className="mx-auto max-w-[1680px] space-y-4 p-4 lg:p-6">
        <KPIGrid>
          <KPICard
            label="Revenue"
            value={k?.totalRevenue.value ?? null}
            changePercent={k?.totalRevenue.changePercent}
            comparison={comparison}
            format="currency"
            trend={t?.revenue.map((p) => p.value)}
            icon={<DollarSign className="h-3.5 w-3.5" />}
            loading={summary.isLoading}
          />
          <KPICard
            label="Orders"
            value={k?.totalOrders.value ?? null}
            changePercent={k?.totalOrders.changePercent}
            comparison={comparison}
            format="number"
            trend={ordersTrend}
            icon={<Receipt className="h-3.5 w-3.5" />}
            loading={summary.isLoading}
          />
          <KPICard
            label="Average order"
            value={k?.avgOrderValue.value ?? null}
            changePercent={k?.avgOrderValue.changePercent}
            comparison={comparison}
            format="currency"
            trend={t?.aov.map((p) => p.value)}
            icon={<ShoppingCart className="h-3.5 w-3.5" />}
            loading={summary.isLoading}
          />
          <KPICard
            label="Revenue per customer"
            value={perCustomer}
            changePercent={change(perCustomer, perCustomerBefore)}
            comparison={comparison}
            format="currency"
            trend={perCustomerTrend}
            icon={<UserRound className="h-3.5 w-3.5" />}
            loading={summary.isLoading}
          />
        </KPIGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard
            className="h-[360px] lg:col-span-2"
            title="Revenue by category over time"
            subtitle={
              categories.data
                ? `${BUCKET_WORD[categories.data.granularity]} totals for the five largest categories and the rest as Other`
                : undefined
            }
            loading={categories.isLoading}
            error={categories.error}
            table={{
              filename: 'revenue-by-category-over-time',
              rows: categories.data?.points ?? [],
              columns: [
                { key: 'label', header: 'Period' },
                ...categoryKeys.map((key) => ({
                  key,
                  header: key,
                  align: 'right' as const,
                  format: (r: SplitPoint) => formatCurrency(Number(r[key]), true),
                })),
              ],
            }}
          >
            <AreaChart
              data={categories.data?.points ?? []}
              xKey="label"
              yKeys={categoryKeys}
              labels={categoryLabels}
              colors={colorsFor('category', categoryKeys)}
              formatX={tick}
              stacked
              gradient={false}
              showTotal
            />
          </ChartCard>

          <ChartCard
            className="h-[360px]"
            title="Revenue by sales channel"
            subtitle="Where orders were placed as a share of all revenue"
            loading={channels.isLoading}
            error={channels.error}
            flow
            table={{
              filename: 'revenue-by-channel',
              rows: channels.data ?? [],
              columns: [
                { key: 'channel', header: 'Channel', format: (r) => labelFor(r.channel) },
                { key: 'value', header: 'Revenue', align: 'right', format: (r) => formatCurrency(r.value) },
                { key: 'percentage', header: 'Share', align: 'right', format: (r) => `${r.percentage}%` },
              ],
            }}
          >
            {/* Three parts of one whole, so each bar is drawn against 100% rather
              * than against the largest channel. */}
            <ul className="flex h-full flex-col justify-center gap-5">
              {(channels.data ?? []).map((c) => (
                <li key={c.channel}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-gray-300">{labelFor(c.channel)}</span>
                    <span className="text-xs tabular-nums text-gray-500">{c.percentage}% of revenue</span>
                  </div>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-white">{formatCurrency(c.value, true)}</p>
                  <div className="mt-1.5 h-2 rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${c.percentage}%`, background: colorFor('channel', c.channel) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </ChartCard>
        </div>

        <ChartCard
          title="Revenue by region"
          subtitle="Each panel on the same scale with its change against a year earlier"
          loading={regions.isLoading}
          error={regions.error}
          flow
          table={{
            filename: 'revenue-by-region',
            rows: regions.data?.totals ?? [],
            columns: [
              { key: 'region', header: 'Region' },
              { key: 'revenue', header: 'Revenue', align: 'right', format: (r) => formatCurrency(r.revenue) },
              { key: 'previous', header: 'A year earlier', align: 'right', format: (r) => formatCurrency(r.previous) },
              { key: 'change', header: 'Change', align: 'right', format: (r) => formatChange(r.change) ?? '—' },
            ],
          }}
        >
          {regions.data && <SmallMultiples data={regions.data} monthly={regions.data.granularity === 'month'} />}
        </ChartCard>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            className="h-[410px]"
            title="Orders and revenue by order size"
            subtitle="Each size band's share of the orders placed and of the revenue they brought in"
            loading={sizes.isLoading}
            error={sizes.error}
            table={{
              filename: 'order-sizes',
              rows: sizes.data ?? [],
              columns: [
                { key: 'band', header: 'Order size' },
                { key: 'orders', header: 'Orders', align: 'right', format: (r) => r.orders.toLocaleString() },
                { key: 'orderShare', header: 'Share of orders', align: 'right', format: (r) => `${r.orderShare ?? 0}%` },
                { key: 'revenue', header: 'Revenue', align: 'right', format: (r) => formatCurrency(r.revenue, true) },
                { key: 'revenueShare', header: 'Share of revenue', align: 'right', format: (r) => `${r.revenueShare ?? 0}%` },
              ],
            }}
          >
            <BarChart
              data={(sizes.data ?? []).map((b) => ({ ...b, band: b.band.replace(' to ', '–').replace(' and up', '+') }))}
              xKey="band"
              yKeys={['orderShare', 'revenueShare']}
              labels={{ orderShare: 'Share of orders', revenueShare: 'Share of revenue' }}
              formatY="percent"
            />
          </ChartCard>

          <ChartCard
            className="h-[410px]"
            title="Top products"
            subtitle="By revenue in the period"
            loading={products.isLoading}
            error={products.error}
            flow
            noPadding
          >
            <DataTable
              data={(products.data ?? []).map((p) => ({ ...p }))}
              keyExtractor={(row) => Number(row.id)}
              compact
              columns={[
                { key: 'name', header: 'Product', sortable: true },
                { key: 'category', header: 'Category', sortable: true },
                {
                  key: 'revenue',
                  header: 'Revenue',
                  sortable: true,
                  align: 'right',
                  render: (v) => formatCurrency(Number(v), true),
                },
                {
                  key: 'unitsSold',
                  header: 'Units',
                  sortable: true,
                  align: 'right',
                  render: (v) => Number(v).toLocaleString(),
                },
              ]}
            />
          </ChartCard>
        </div>
      </div>
    </>
  );
}
