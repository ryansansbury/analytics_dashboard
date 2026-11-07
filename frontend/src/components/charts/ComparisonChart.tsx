/**
 * This period's revenue beside the same period a year earlier.
 *
 * Two lines on one axis, which is legitimate here because both are the same
 * measure in the same unit. The current year is the solid series colour; last
 * year is a dashed muted line, a reference rather than a competitor. Both are
 * labelled at their right-hand end and in the legend, so neither relies on
 * colour or dash alone.
 */

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ComparisonPoint } from '../../types';
import { CHART_CHROME, currencyAxisFormatter, formatChange, formatCurrency } from '../../utils/formatters';
import { AXIS, Legend, TooltipBox } from './chrome';

const CURRENT = 'var(--color-chart-1)';
const PREVIOUS = 'var(--color-ink-muted)';

interface ComparisonChartProps {
  data: ComparisonPoint[];
  height?: number | '100%';
  /** Shorten month labels on the axis, "Dec 2025" to "Dec". */
  monthly?: boolean;
}

export function ComparisonChart({ data, height = '100%', monthly = false }: ComparisonChartProps) {
  const tick = (label: string) => (monthly ? label.split(' ')[0] : label);
  const last = data.length - 1;

  const endLabel = (text: string, color: string) =>
    function EndLabel(props: { x?: number | string; y?: number | string; index?: number }) {
      if (props.index !== last || props.x == null || props.y == null) return null;
      return (
        <text x={Number(props.x) + 8} y={Number(props.y)} dy={4} fontSize={11} fill="var(--color-ink-secondary)">
          <tspan fill={color}>●</tspan> {text}
        </text>
      );
    };

  return (
    <div className="flex h-full flex-col gap-2">
      <Legend
        items={[
          { key: 'current', label: 'This year', color: CURRENT, line: true },
          { key: 'previous', label: 'Same period last year', color: PREVIOUS, dashed: true },
        ]}
      />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 8, right: 76, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
            <XAxis
              dataKey="label"
              {...AXIS}
              fontSize={10}
              tickFormatter={tick}
              interval="preserveStartEnd"
              minTickGap={10}
            />
            <YAxis {...AXIS} tickFormatter={currencyAxisFormatter} width={56} domain={[0, 'auto']} />
            <Tooltip
              cursor={{ stroke: CHART_CHROME.axis, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as ComparisonPoint;
                const change = point.previous ? ((point.current - point.previous) / point.previous) * 100 : null;
                return (
                  <TooltipBox
                    title={point.label}
                    rows={[
                      { name: 'This year', value: formatCurrency(point.current), color: CURRENT },
                      { name: point.previousLabel, value: formatCurrency(point.previous), color: PREVIOUS, dashed: true },
                    ]}
                    footer={change == null ? undefined : `${formatChange(change)} on last year`}
                  />
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="previous"
              name="Same period last year"
              stroke={PREVIOUS}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 4, stroke: 'var(--color-surface)', strokeWidth: 2 }}
              label={endLabel('Last year', PREVIOUS)}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              name="This year"
              stroke={CURRENT}
              strokeWidth={2.25}
              dot={false}
              activeDot={{ r: 4.5, stroke: 'var(--color-surface)', strokeWidth: 2 }}
              label={endLabel('This year', CURRENT)}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
