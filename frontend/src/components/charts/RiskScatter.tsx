/**
 * Every live customer, placed by churn probability and by what they spent in
 * the last year.
 *
 * The top-right corner is the list worth a phone call: likely to leave and
 * worth keeping. Revenue runs on a log scale because it spans three orders of
 * magnitude, and on a linear axis every small account sits in one smear along
 * the bottom. Segments are three series, the most a scatter can carry before
 * the colours stop being separable, and each point has a thin surface ring so
 * overlapping points stay distinct.
 */

import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RiskPoint } from '../../types';
import { colorFor, labelFor } from '../../utils/colors';
import { CHART_CHROME, currencyAxisFormatter, formatCurrency } from '../../utils/formatters';
import { AXIS, Legend, TooltipBox } from './chrome';

const SEGMENTS = ['enterprise', 'mid-market', 'smb'];

interface RiskScatterProps {
  points: RiskPoint[];
  threshold: number;
  height?: number | '100%';
}

export function RiskScatter({ points, threshold, height = '100%' }: RiskScatterProps) {
  const values = points.map((p) => p.annualRevenue).filter((v) => v > 0);
  const lo = values.length ? 10 ** Math.floor(Math.log10(Math.min(...values))) : 1_000;
  const hi = values.length ? 10 ** Math.ceil(Math.log10(Math.max(...values))) : 1_000_000;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t *= 10) ticks.push(t);

  return (
    <div className="flex h-full flex-col gap-2">
      <Legend
        items={SEGMENTS.map((s) => ({ key: s, label: labelFor(s), color: colorFor('segment', s) }))}
      />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={CHART_CHROME.grid} />
            <ReferenceArea
              x1={threshold}
              x2={1}
              fill="var(--color-status-critical)"
              fillOpacity={0.05}
              ifOverflow="extendDomain"
            />
            <XAxis
              type="number"
              dataKey="riskScore"
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tickFormatter={(v) => `${Math.round(v * 100)}%`}
              {...AXIS}
              label={{ value: 'Churn probability, next 90 days', position: 'insideBottom', offset: -2, fontSize: 11, fill: 'var(--color-ink-muted)' }}
              height={36}
            />
            <YAxis
              type="number"
              dataKey="annualRevenue"
              scale="log"
              domain={[lo, hi]}
              ticks={ticks}
              tickFormatter={currencyAxisFormatter}
              allowDataOverflow
              {...AXIS}
              width={56}
            />
            <ReferenceLine
              x={threshold}
              stroke="var(--color-status-critical)"
              strokeDasharray="4 3"
              label={{ value: 'At risk', position: 'insideTopRight', fontSize: 11, fill: 'var(--color-ink-secondary)' }}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as RiskPoint;
                return (
                  <TooltipBox
                    title={p.company}
                    rows={[
                      { name: 'Churn probability', value: `${Math.round(p.riskScore * 100)}%`, color: colorFor('segment', p.segment) },
                      { name: 'Last 12 months', value: formatCurrency(p.annualRevenue) },
                      { name: 'Segment', value: labelFor(p.segment) },
                    ]}
                  />
                );
              }}
            />
            {SEGMENTS.map((segment) => (
              <Scatter
                key={segment}
                name={labelFor(segment)}
                data={points.filter((p) => p.segment === segment && p.annualRevenue > 0)}
                fill={colorFor('segment', segment)}
                fillOpacity={0.75}
                stroke="var(--color-surface)"
                strokeWidth={1}
                shape="circle"
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
