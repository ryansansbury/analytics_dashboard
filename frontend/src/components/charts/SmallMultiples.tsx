/**
 * One small area chart per region, all on the same scale.
 *
 * Small multiples instead of five lines on one plot: lines for regions of very
 * different size tangle at the bottom of a shared axis, and a stacked area
 * hides each region's own trend under the ones beneath it. Here each panel
 * shows one region's shape, and the shared y scale keeps their sizes honest,
 * so a small region looks small. The panel header carries the total and the
 * change on a year earlier, in words, for the comparison the eye can't make
 * between panels.
 */

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TrendingDown, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import type { RegionTrends } from '../../types';
import { colorFor } from '../../utils/colors';
import { formatChange, formatCurrency } from '../../utils/formatters';
import { TooltipBox } from './chrome';

interface SmallMultiplesProps {
  data: RegionTrends;
  /** Label for the axis ticks and tooltip, from a bucket's ISO date and label. */
  monthly?: boolean;
}

export function SmallMultiples({ data, monthly = false }: SmallMultiplesProps) {
  const max = Math.max(
    0,
    ...data.points.flatMap((p) => data.keys.map((k) => Number(p[k]) || 0)),
  );
  const totals = new Map(data.totals.map((t) => [t.region, t]));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {data.keys.map((region) => {
        const total = totals.get(region);
        const change = total?.change ?? null;
        const color = colorFor('region', region);
        return (
          <figure key={region} className="flex h-[150px] flex-col rounded-lg border border-gray-800 p-2.5">
            <figcaption className="mb-1">
              <p className="truncate text-xs font-medium text-gray-300">{region}</p>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold tabular-nums text-white">
                  {formatCurrency(total?.revenue ?? 0, true)}
                </span>
                {change != null && (
                  <span
                    className={clsx(
                      'inline-flex items-center gap-0.5 text-[11px] font-medium',
                      change >= 0 ? 'text-success' : 'text-danger',
                    )}
                    title="Change on the same period a year earlier"
                  >
                    {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {formatChange(change)}
                  </span>
                )}
              </div>
            </figcaption>
            <div className="min-h-0 flex-1" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.points} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
                  <XAxis dataKey="label" hide />
                  <YAxis hide domain={[0, max || 1]} />
                  <Tooltip
                    cursor={{ stroke: 'var(--color-axis)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const point = payload[0].payload as { label: string };
                      return (
                        <TooltipBox
                          title={monthly ? point.label : `Week of ${point.label}`}
                          rows={[{ name: region, value: formatCurrency(Number(payload[0].value) || 0), color }]}
                        />
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={region}
                    stroke={color}
                    strokeWidth={2}
                    fill={color}
                    fillOpacity={0.16}
                    isAnimationActive={false}
                    activeDot={{ r: 3.5, stroke: 'var(--color-surface)', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </figure>
        );
      })}
    </div>
  );
}
