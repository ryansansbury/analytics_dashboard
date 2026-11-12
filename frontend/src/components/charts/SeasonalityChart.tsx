/**
 * Each calendar month's revenue against the average month, as bars above and
 * below a zero line.
 *
 * Diverging, so two hues for the two directions and the axis as the neutral
 * midpoint. The index (1.18) is shown as what it means, 18% above an average
 * month, because a bar chart of numbers hovering near 1.0 starts its bars at
 * zero and hides every difference that matters.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeasonalityPoint } from '../../types';
import { CHART_CHROME, formatChange } from '../../utils/formatters';
import { AXIS, Legend, TooltipBox } from './chrome';
import { useNarrow, usePhone } from '../../hooks/useNarrow';

const ABOVE = 'var(--color-chart-1)';
const BELOW = 'var(--color-chart-2)';

export function SeasonalityChart({ data, height = '100%' }: { data: SeasonalityPoint[]; height?: number | '100%' }) {
  const rows = data.map((d) => ({ month: d.month, deviation: Math.round((d.index - 1) * 1000) / 10 }));
  const extent = Math.max(10, ...rows.map((r) => Math.ceil(Math.abs(r.deviation) / 10) * 10));
  // All twelve months stay named. A phone on its side has the room to draw them
  // a size up, and an upright one keeps the desktop's size so no two touch.
  const phone = usePhone();
  const narrow = useNarrow();
  const roomy = phone && !narrow;

  return (
    <div className="flex h-full flex-col gap-2">
      <Legend
        items={[
          { key: 'above', label: 'Above an average month', color: ABOVE },
          { key: 'below', label: 'Below', color: BELOW },
        ]}
      />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_CHROME.grid} vertical={false} />
            <XAxis dataKey="month" {...AXIS} fontSize={roomy ? 11 : 10} interval={0} />
            <YAxis {...AXIS} width={44} domain={[-extent, extent]} tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`} />
            <ReferenceLine y={0} stroke="var(--color-ink-muted)" />
            <Tooltip
              cursor={{ fill: 'var(--color-grid)', fillOpacity: 0.5 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as { month: string; deviation: number };
                return (
                  <TooltipBox
                    title={r.month}
                    rows={[{
                      name: 'Against an average month',
                      value: formatChange(r.deviation) ?? '',
                      color: r.deviation >= 0 ? ABOVE : BELOW,
                    }]}
                  />
                );
              }}
            />
            <Bar dataKey="deviation" maxBarSize={28} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.month} fill={r.deviation >= 0 ? ABOVE : BELOW} radius={(r.deviation >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]) as never} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
