import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  currencyAxisFormatter,
  formatCurrency,
  numberAxisFormatter,
  percentAxisFormatter,
} from '../../utils/formatters';
import { CHART_CHROME, getChartColor, getOrdinalColor } from '../../utils/formatters';
import { AXIS, Legend, TooltipBox } from './chrome';
import { REDUCED_MOTION } from '../../utils/motion';

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

interface BarChartProps<T> {
  data: T[];
  xKey: keyof T;
  yKeys: (keyof T)[];
  labels?: Record<string, string>;
  height?: number | '100%';
  showGrid?: boolean;
  /** Per-series colour override, in slot order. Never cycled. */
  colors?: string[];
  showLegend?: boolean;
  formatY?: ValueFormat;
  /** Tick text for the category axis. */
  formatX?: (value: string) => string;
  horizontal?: boolean;
  stacked?: boolean;
  /** Colour bars along the ordinal ramp, for ordered categories like stages. */
  ordinal?: boolean;
  angledLabels?: boolean;
  formatXAsDate?: boolean;
  /** Tooltip total row for stacked series. */
  showTotal?: boolean;
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function BarChart<T extends Record<string, unknown>>({
  data,
  xKey,
  yKeys,
  labels = {},
  height = '100%',
  showGrid = true,
  colors,
  showLegend,
  formatY = 'currency',
  formatX,
  horizontal = false,
  stacked = false,
  ordinal = false,
  angledLabels = false,
  formatXAsDate = false,
  showTotal = false,
}: BarChartProps<T>) {
  const seriesColor = (i: number) => colors?.[i] ?? getChartColor(i);

  /*
   * A legend is always present for two or more series, so identity never rests
   * on colour alone, and omitted for one, where the card title names it.
   */
  const legendVisible = showLegend ?? yKeys.length >= 2;
  const formatValue = VALUE_FORMAT[formatY];
  const tickText = formatX ?? (formatXAsDate ? formatDateLabel : undefined);

  const tooltip = (
    <Tooltip
      cursor={{ fill: 'var(--color-grid)', fillOpacity: 0.5 }}
      content={({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        const rows = payload.map((p) => ({
          name: labels[String(p.dataKey)] ?? String(p.name),
          value: formatValue(Number(p.value) || 0),
          color: String(p.payload?.fill ?? p.color ?? ''),
        }));
        const total = stacked && showTotal && rows.length > 1
          ? formatValue(payload.reduce((s, p) => s + (Number(p.value) || 0), 0))
          : null;
        const title = tickText ? tickText(String(label)) : String(label);
        return <TooltipBox title={title} rows={stacked ? rows.reverse() : rows} footer={total ? `Total ${total}` : undefined} />;
      }}
    />
  );

  /*
   * Stacked segments are separated by a 2px surface-coloured stroke, so
   * neighbouring fills never merge into one block. Only the top segment of a
   * stack gets rounded ends; rounding every segment carves notches into the
   * middle of the bar.
   */
  const bars = yKeys.map((key, index) => {
    const top = !stacked || index === yKeys.length - 1;
    const radius: [number, number, number, number] = horizontal
      ? (top ? [0, 4, 4, 0] : [0, 0, 0, 0])
      : (top ? [4, 4, 0, 0] : [0, 0, 0, 0]);
    return (
      <Bar
        key={String(key)}
        dataKey={String(key)}
        name={labels[String(key)] ?? String(key)}
        stackId={stacked ? 'stack' : undefined}
        fill={seriesColor(index)}
        stroke={stacked ? 'var(--color-surface)' : undefined}
        strokeWidth={stacked ? 1 : 0}
        radius={radius}
        maxBarSize={horizontal ? 18 : 48}
        isAnimationActive={!REDUCED_MOTION}
      >
        {ordinal &&
          data.map((_, i) => (
            <Cell key={`cell-${i}`} fill={getOrdinalColor(i, data.length)} />
          ))}
      </Bar>
    );
  });

  const ChartComponent = horizontal ? (
    <RechartsBarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barGap={2}>
      {showGrid && <CartesianGrid stroke={CHART_CHROME.grid} strokeWidth={1} horizontal={false} />}
      <XAxis type="number" {...AXIS} tickFormatter={AXIS_FORMAT[formatY]} />
      <YAxis
        type="category"
        dataKey={String(xKey)}
        {...AXIS}
        width={110}
        tickFormatter={tickText}
      />
      {tooltip}
      {bars}
    </RechartsBarChart>
  ) : (
    <RechartsBarChart
      data={data}
      margin={{ top: 6, right: 6, left: 0, bottom: angledLabels ? 60 : 0 }}
      barGap={2}
    >
      {showGrid && <CartesianGrid stroke={CHART_CHROME.grid} strokeWidth={1} vertical={false} />}
      <XAxis
        dataKey={String(xKey)}
        {...AXIS}
        fontSize={10}
        angle={angledLabels ? -45 : 0}
        textAnchor={angledLabels ? 'end' : 'middle'}
        height={angledLabels ? 80 : 30}
        interval={!formatXAsDate && data.length <= 12 ? 0 : 'preserveStartEnd'}
        minTickGap={6}
        tickFormatter={tickText}
      />
      <YAxis {...AXIS} tickFormatter={AXIS_FORMAT[formatY]} width={56} />
      {tooltip}
      {bars}
    </RechartsBarChart>
  );

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      {ChartComponent}
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
        }))}
      />
      <div className="min-h-0 flex-1">{chart}</div>
    </div>
  );
}
