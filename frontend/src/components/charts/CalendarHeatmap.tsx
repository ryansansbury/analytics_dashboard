/**
 * A year of daily revenue, one column per week and one row per weekday.
 *
 * It shows three things no line chart shows at once: the weekly rhythm (quiet
 * weekends as pale rows), the quarter-end pushes (dark runs at the end of
 * March, June, September, and December), and the year's growth as the columns
 * darken left to right. A day with no orders is neutral grey.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarDay } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { HeatLegend } from './CohortHeatmap';
import { heatColor, heatStep, weekdayThresholds } from './heat';

const CELL = 12;
const GAP = 2;
const PITCH = CELL + GAP;
const LEFT = 28;
const TOP = 16;
const WEEKDAY_LABELS: Record<number, string> = { 0: 'Mon', 2: 'Wed', 4: 'Fri' };

export function CalendarHeatmap({ days }: { days: CalendarDay[] }) {
  const [hover, setHover] = useState<CalendarDay | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const { thresholds, weeks, months, best } = useMemo(() => {
    const weekCount = days.length ? days[days.length - 1].week + 1 : 0;
    const labels: { week: number; text: string }[] = [];
    let lastMonth = -1;
    let lastLabelWeek = -10;
    for (const d of days) {
      if (d.weekday !== 0) continue;
      const month = Number(d.date.slice(5, 7));
      if (month !== lastMonth) {
        if (d.week - lastLabelWeek >= 3) {
          labels.push({ week: d.week, text: formatDate(d.date, 'MMM') });
          lastLabelWeek = d.week;
        }
        lastMonth = month;
      }
    }
    const top = days.reduce<CalendarDay | null>((a, d) => (a == null || d.revenue > a.revenue ? d : a), null);
    return { thresholds: weekdayThresholds(days), weeks: weekCount, months: labels, best: top };
  }, [days]);

  // On a narrow screen the year scrolls sideways. Start at the latest weeks,
  // which are the ones anyone opening the page wants first.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [days.length]);

  const width = LEFT + weeks * PITCH;
  const height = TOP + 7 * PITCH;

  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div ref={scroller} className="relative overflow-x-auto">
        <div className="relative min-w-[620px]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            role="img"
            aria-label={`Daily revenue for ${days.length} days${best ? `, highest on ${formatDate(best.date)} at ${formatCurrency(best.revenue, true)}` : ''}`}
            onMouseLeave={() => setHover(null)}
          >
            {months.map((m) => (
              <text key={m.week} x={LEFT + m.week * PITCH} y={10} fontSize={10} fill="var(--color-ink-muted)">
                {m.text}
              </text>
            ))}
            {Object.entries(WEEKDAY_LABELS).map(([row, text]) => (
              <text
                key={row}
                x={0}
                y={TOP + Number(row) * PITCH + CELL - 2}
                fontSize={10}
                fill="var(--color-ink-muted)"
              >
                {text}
              </text>
            ))}
            {days.map((d) => {
              const fill = d.revenue > 0 ? heatColor(heatStep(d.revenue, thresholds)) : 'var(--color-heat-empty)';
              const active = hover?.date === d.date;
              return (
                <rect
                  key={d.date}
                  x={LEFT + d.week * PITCH}
                  y={TOP + d.weekday * PITCH}
                  width={CELL}
                  height={CELL}
                  rx={2.5}
                  fill={fill}
                  stroke={active ? 'var(--color-ink)' : 'none'}
                  strokeWidth={active ? 1.5 : 0}
                  onMouseEnter={() => setHover(d)}
                >
                  <title>{`${formatDate(d.date, 'EEE, MMM d, yyyy')}: ${formatCurrency(d.revenue)}`}</title>
                </rect>
              );
            })}
          </svg>
          {hover && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs shadow-lg"
              style={{
                left: `${((LEFT + hover.week * PITCH + CELL / 2) / width) * 100}%`,
                top: `${((TOP + hover.weekday * PITCH - 4) / height) * 100}%`,
              }}
              role="tooltip"
            >
              <p className="whitespace-nowrap text-gray-400">{formatDate(hover.date, 'EEE, MMM d, yyyy')}</p>
              <p className="font-semibold tabular-nums text-white">{formatCurrency(hover.revenue)}</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {best && (
          <p className="text-[11px] text-gray-500">
            Highest day {formatDate(best.date, 'MMM d')} at{' '}
            <span className="font-medium text-gray-300">{formatCurrency(best.revenue, true)}</span>
          </p>
        )}
        <HeatLegend labels={['Less', 'More']} />
      </div>
    </div>
  );
}
