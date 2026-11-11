/**
 * Horizontal bars sorted by value, each labelled with its name and figure.
 *
 * This replaced the donut charts. A reader compares lengths along a common
 * baseline far more accurately than angles or areas, and with every bar
 * labelled directly there is nothing to look up in a legend. Plain HTML, so
 * long names wrap and the figures line up in a column.
 */

import clsx from 'clsx';

export interface RankedBar {
  key: string;
  label: string;
  value: number;
  /** The figure printed at the end of the row. */
  display: string;
  /** A share or rate printed in its own muted column before the figure. */
  share?: string;
  /** Secondary text under the label, such as a count. Wraps rather than truncating. */
  detail?: string;
  color?: string;
}

interface RankedBarsProps {
  rows: RankedBar[];
  /** Fill for every bar when a row has no colour of its own. */
  color?: string;
  /** Scale bars against this value instead of the largest row. */
  max?: number;
  /** Keep the given order instead of sorting, for ordered stages and bands. */
  keepOrder?: boolean;
  /** Tighter rows with no detail line. */
  dense?: boolean;
  /** Width of the label column, as a CSS length. */
  labelWidth?: string;
}

export function RankedBars({
  rows,
  color = 'var(--color-chart-1)',
  max,
  keepOrder = false,
  dense = false,
  labelWidth = '38%',
}: RankedBarsProps) {
  const ordered = keepOrder ? rows : [...rows].sort((a, b) => b.value - a.value);
  const top = max ?? Math.max(0, ...ordered.map((r) => r.value));
  const hasShare = ordered.some((r) => r.share);
  const columns = `${labelWidth} 1fr${hasShare ? ' 2.75rem' : ''} auto`;

  return (
    <ul className={clsx('flex flex-col', dense ? 'gap-2' : 'gap-3')}>
      {ordered.map((row) => {
        const share = top > 0 ? Math.max(0, Math.min(1, row.value / top)) : 0;
        return (
          <li
            key={row.key}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: columns }}
            title={`${row.label}: ${row.display}${row.share ? `, ${row.share}` : ''}${row.detail ? `, ${row.detail}` : ''}`}
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-300">{row.label}</p>
              {row.detail && !dense && <p className="text-[11px] leading-snug text-gray-500">{row.detail}</p>}
            </div>
            <div className="h-2.5 rounded-full bg-gray-800">
              <div
                className="h-full rounded-full"
                style={{ width: `${(share * 100).toFixed(2)}%`, background: row.color ?? color, minWidth: share > 0 ? 3 : 0 }}
              />
            </div>
            {hasShare && <span className="text-right text-[11px] tabular-nums text-gray-500">{row.share ?? ''}</span>}
            <span className="text-right text-xs font-semibold tabular-nums text-white">{row.display}</span>
          </li>
        );
      })}
    </ul>
  );
}
