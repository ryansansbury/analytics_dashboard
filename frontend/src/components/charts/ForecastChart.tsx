/**
 * Monthly revenue, the model's backtest over the months it never trained on,
 * and six months ahead with 80% and 95% intervals.
 *
 * The backtest is the evidence: a dotted line laid over the actuals for the
 * holdout months shows how close the model came before anyone trusts its
 * forecast. The two bands nest, the 95% lighter and wider, both opening from
 * zero width at the last actual month because the last measurement carries
 * no uncertainty.
 */

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ForecastPoint } from '../../types';
import { CHART_CHROME, currencyAxisFormatter, formatCurrency, formatMonthYear } from '../../utils/formatters';
import { AXIS, Legend, TooltipBox } from './chrome';

const ACTUAL = 'var(--color-chart-1)';
// The forecast continues the actual series, so it keeps its colour and changes
// only its dash. The backtest is a different thing, a check, so it gets its own.
const FORECAST = 'var(--color-chart-1)';
const BACKTEST = 'var(--color-chart-2)';

export function ForecastChart({ data, height = '100%' }: { data: ForecastPoint[]; height?: number | '100%' }) {
  const hasBacktest = data.some((d) => d.backtest != null);

  return (
    <div className="flex h-full flex-col gap-2">
      <Legend
        items={[
          { key: 'actual', label: 'Actual', color: ACTUAL, line: true },
          ...(hasBacktest ? [{ key: 'backtest', label: 'Backtest on held-out months', color: BACKTEST, dashed: true }] : []),
          { key: 'forecast', label: 'Forecast', color: FORECAST, dashed: true },
          { key: 'band80', label: '80% interval', color: 'color-mix(in srgb, var(--color-chart-1) 34%, transparent)' },
          { key: 'band95', label: '95% interval', color: 'color-mix(in srgb, var(--color-chart-1) 16%, transparent)' },
        ]}
      />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
            <XAxis
              dataKey="date"
              {...AXIS}
              fontSize={10}
              tickFormatter={(v) => formatMonthYear(String(v), true)}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            {/* A line needs no zero baseline, and starting this one at zero pressed
              * the seasonal swings and the bands into the top half of the card. */}
            <YAxis {...AXIS} tickFormatter={currencyAxisFormatter} width={56} domain={['auto', 'auto']} />
            <Tooltip
              cursor={{ stroke: CHART_CHROME.axis, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as ForecastPoint;
                const rows = [];
                if (p.actual != null) rows.push({ name: 'Actual', value: formatCurrency(p.actual), color: ACTUAL });
                if (p.backtest != null) rows.push({ name: 'Backtest', value: formatCurrency(p.backtest), color: BACKTEST, dashed: true });
                if (p.predicted != null && p.actual == null) {
                  rows.push({ name: 'Forecast', value: formatCurrency(p.predicted), color: FORECAST, dashed: true });
                  if (p.lowerBound != null && p.upperBound != null) {
                    rows.push({ name: '80% range', value: `${formatCurrency(p.lowerBound, true)} to ${formatCurrency(p.upperBound, true)}` });
                  }
                  if (p.lower95 != null && p.upper95 != null) {
                    rows.push({ name: '95% range', value: `${formatCurrency(p.lower95, true)} to ${formatCurrency(p.upper95, true)}` });
                  }
                }
                const miss = p.actual != null && p.backtest != null
                  ? `Backtest missed by ${Math.abs(((p.backtest - p.actual) / p.actual) * 100).toFixed(1)}%`
                  : undefined;
                return <TooltipBox title={formatMonthYear(p.date)} rows={rows} footer={miss} />;
              }}
            />
            <Area
              type="monotone"
              dataKey={(d: ForecastPoint) => (d.lower95 == null || d.upper95 == null ? null : [d.lower95, d.upper95])}
              stroke="none"
              fill={FORECAST}
              fillOpacity={0.12}
              isAnimationActive={false}
              activeDot={false}
              legendType="none"
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey={(d: ForecastPoint) => (d.lowerBound == null || d.upperBound == null ? null : [d.lowerBound, d.upperBound])}
              stroke="none"
              fill={FORECAST}
              fillOpacity={0.22}
              isAnimationActive={false}
              activeDot={false}
              legendType="none"
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke={ACTUAL}
              strokeWidth={2.25}
              dot={{ r: 2.5, fill: ACTUAL, strokeWidth: 0 }}
              activeDot={{ r: 4.5, stroke: 'var(--color-surface)', strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="backtest"
              stroke={BACKTEST}
              strokeWidth={2}
              strokeDasharray="2 3"
              dot={false}
              activeDot={{ r: 4, stroke: 'var(--color-surface)', strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="predicted"
              stroke={FORECAST}
              strokeWidth={2.25}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4.5, stroke: 'var(--color-surface)', strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
