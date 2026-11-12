import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  currencyAxisFormatter,
  formatCurrency,
  formatDateShort,
  numberAxisFormatter,
  percentAxisFormatter,
} from '../../utils/formatters';
import { CHART_CHROME, getChartColor } from '../../utils/formatters';
import { AXIS, Legend, TooltipBox } from './chrome';
import { REDUCED_MOTION } from '../../utils/motion';
import { useNarrow, usePhone } from '../../hooks/useNarrow';

type ValueFormat = 'currency' | 'number' | 'percent';

const AXIS_FORMAT: Record<ValueFormat, (v: number) => string> = {
  currency: currencyAxisFormatter,
  number: numberAxisFormatter,
  percent: percentAxisFormatter,
};

const VALUE_FORMAT: Record<ValueFormat, (v: number) => string> = {
  currency: (v) => formatCurrency(v),
  number: (v) => v.toLocaleString(),
  percent: (v) => `${v.toFixed(1)}%`,
};

interface AreaChartProps<T> {
  data: T[];
  xKey: keyof T;
  yKeys: (keyof T)[];
  labels?: Record<string, string>;
  height?: number | '100%';
  showGrid?: boolean;
  /**
   * Optional per-series colour override, in slot order.
   *
   * Entries past the end fall through to the standard palette slot for that
   * index. There is no modulo: cycling a short override across many series
   * repaints identities the reader has already learned.
   */
  colors?: string[];
  showLegend?: boolean;
  formatY?: ValueFormat;
  /** Tick text for the x axis. Defaults to "Mar 2" from an ISO date. */
  formatX?: (value: string) => string;
  stacked?: boolean;
  gradient?: boolean;
  dashedKeys?: (keyof T)[];
  /**
   * Draw an uncertainty band between two keys, behind the series lines.
   *
   * Points where either bound is null are skipped, so a band can cover only the
   * forecast portion of a series while the measured history has none. Measured
   * values carry no uncertainty to draw.
   */
  band?: { lower: keyof T; upper: keyof T; label?: string };
  /** Hide the y axis, for small multiples that share a scale shown elsewhere. */
  hideYAxis?: boolean;
  /** Fix the y domain, so several charts share one scale. */
  yDomain?: [number, number];
  /** Tooltip total row for stacked series. */
  showTotal?: boolean;
}

export function AreaChart<T extends Record<string, unknown>>({
  data,
  xKey,
  yKeys,
  labels = {},
  height = '100%',
  showGrid = true,
  colors,
  showLegend,
  formatY = 'currency',
  formatX = formatDateShort,
  stacked = false,
  gradient = true,
  dashedKeys = [],
  band,
  hideYAxis = false,
  yDomain,
  showTotal = false,
}: AreaChartProps<T>) {
  /** Override wins for the slots it covers; the palette fills the rest. */
  const seriesColor = (i: number) => colors?.[i] ?? getChartColor(i);

  /*
   * A legend is always present for two or more series, so identity never rests
   * on colour alone. It defaults off for a single series because the card title
   * already names it and a one-entry legend is chrome with no content. An
   * explicit prop still wins either way.
   */
  const legendVisible = showLegend ?? yKeys.length >= 2;
  const formatValue = VALUE_FORMAT[formatY];

  // Fewer tick labels when there are many points, so they never collide. On a
  // phone even a dozen weekly labels collide, so the axis keeps the first and
  // the last and only the ones between that fit.
  const narrow = useNarrow();
  const phone = usePhone();
  const xAxisInterval = narrow ? 'preserveStartEnd' : data.length > 20 ? Math.ceil(data.length / 10) - 1 : 0;
  const gradientId = (key: keyof T) => `area-${String(key).replace(/[^a-zA-Z0-9]/g, '')}`;

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      {/* Right margin so the final x-axis tick is not clipped by the plot edge.
        * With zero margin the last label rendered as "Ja" instead of "Jan 1". */}
      <RechartsAreaChart data={data} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
        <defs>
          {yKeys.map((key, index) => (
            <linearGradient key={String(key)} id={gradientId(key)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={seriesColor(index)} stopOpacity={stacked ? 0.85 : 0.3} />
              <stop offset="95%" stopColor={seriesColor(index)} stopOpacity={stacked ? 0.65 : 0} />
            </linearGradient>
          ))}
        </defs>

        {showGrid && <CartesianGrid stroke={CHART_CHROME.grid} strokeWidth={1} vertical={false} />}

        <XAxis
          dataKey={String(xKey)}
          {...AXIS}
          fontSize={phone ? 11 : 10}
          tickFormatter={(value) => formatX(String(value))}
          interval={xAxisInterval}
          minTickGap={8}
        />

        <YAxis
          {...AXIS}
          hide={hideYAxis}
          tickFormatter={AXIS_FORMAT[formatY]}
          width={56}
          domain={yDomain ?? [0, 'auto']}
        />

        <Tooltip
          cursor={{ stroke: CHART_CHROME.axis, strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const rows = payload
              .filter((p) => p.value != null && !Array.isArray(p.value))
              .map((p) => ({
                name: labels[String(p.dataKey)] ?? String(p.name),
                value: formatValue(Number(p.value)),
                color: String(p.color ?? ''),
                dashed: dashedKeys.includes(p.dataKey as keyof T),
              }))
              .reverse();
            const total = rows.length > 1 && showTotal
              ? formatValue(payload.reduce((s, p) => s + (Array.isArray(p.value) ? 0 : Number(p.value) || 0), 0))
              : null;
            return (
              <TooltipBox
                title={formatX(String(label))}
                rows={rows}
                footer={total ? `Total ${total}` : undefined}
              />
            );
          }}
        />

        {/* Uncertainty band, drawn first so it sits behind the lines.
          *
          * A range Area: the array dataKey gives Recharts a low and a high per
          * point. Deliberately recessive - a soft fill, no stroke, no dots. The
          * band is context for the forecast, not a series of its own, so it
          * carries no legend entry and never competes with the data. */}
        {band && (
          <Area
            type="monotone"
            dataKey={(row: T) => {
              const lo = row[band.lower];
              const hi = row[band.upper];
              return lo == null || hi == null ? null : [Number(lo), Number(hi)];
            }}
            name={band.label ?? 'Confidence range'}
            stroke="none"
            fill={seriesColor(0)}
            fillOpacity={0.14}
            activeDot={false}
            dot={false}
            legendType="none"
            isAnimationActive={false}
            connectNulls={false}
          />
        )}

        {yKeys.map((key, index) => (
          <Area
            key={String(key)}
            type="monotone"
            dataKey={String(key)}
            name={labels[String(key)] ?? String(key)}
            stackId={stacked ? 'stack' : undefined}
            stroke={stacked ? 'var(--color-surface)' : seriesColor(index)}
            strokeWidth={stacked ? 1 : 2}
            strokeDasharray={dashedKeys.includes(key) ? '5 5' : undefined}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
            /*
             * A dashed series is a projection, so it draws as a line only.
             *
             * Filling it was actively misleading in two ways. A filled area
             * reads as measured volume, which a forecast is not. And where a
             * backtest overlaps the actuals, two translucent fills stack into a
             * smear in which neither line can be read.
             *
             * When a band is present nothing is filled. On a chart that runs
             * measured history into a forecast, filling the measured half
             * produced a solid block that fell off a cliff to the axis the
             * moment the actuals stopped, which read as the data breaking
             * rather than as history ending. The band is the fill; a second one
             * competes with it.
             *
             * Stacked layers are filled solid with a hairline of the surface
             * between them, which is the 2px gap a stacked chart needs so
             * neighbouring layers never merge.
             */
            fill={
              dashedKeys.includes(key) || band
                ? 'none'
                : gradient
                  ? `url(#${gradientId(key)})`
                  : seriesColor(index)
            }
            fillOpacity={dashedKeys.includes(key) || band ? 0 : gradient ? 1 : stacked ? 0.9 : 0.1}
            isAnimationActive={!REDUCED_MOTION}
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );

  /*
   * The legend is plain HTML above the plot, in the order the keys arrive,
   * which is largest first. Recharts' own legend sorted entries
   * alphabetically, drew each swatch in the series' stroke (the white hairline
   * between stacked layers, so the swatches vanished), and ran off the edge
   * of a narrow card.
   */
  if (!legendVisible) return chart;
  return (
    <div className="flex h-full flex-col gap-2">
      <Legend
        items={yKeys.map((key, i) => ({
          key: String(key),
          label: labels[String(key)] ?? String(key),
          color: seriesColor(i),
          dashed: dashedKeys.includes(key),
          line: !stacked && !dashedKeys.includes(key),
        }))}
      />
      <div className="min-h-0 flex-1">{chart}</div>
    </div>
  );
}
