/**
 * Pieces every chart shares: the tooltip box and the axis styling.
 *
 * The tooltip prints names and values in the text tokens and puts a small
 * swatch beside each row for identity. Recharts' default tooltip tints each
 * value with its series colour, which drops yellow and pale blue below
 * readable contrast, and it hardcoded a dark box that sat oddly on the light
 * theme.
 */

import type { ReactNode } from 'react';

export const AXIS = {
  stroke: 'var(--color-ink-muted)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export interface TooltipRow {
  name: string;
  value: string;
  color?: string;
  /** Draw the swatch as a dashed line, for a reference series. */
  dashed?: boolean;
}

export function TooltipBox({
  title,
  rows,
  footer,
}: {
  title?: ReactNode;
  rows: TooltipRow[];
  footer?: ReactNode;
}) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none min-w-[160px] rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs shadow-lg"
    >
      {title && <p className="mb-1.5 font-medium text-white">{title}</p>}
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-2">
            {row.color && <Swatch color={row.color} dashed={row.dashed} />}
            <span className="text-gray-400">{row.name}</span>
            <span className="ml-auto pl-4 font-medium tabular-nums text-white">{row.value}</span>
          </li>
        ))}
      </ul>
      {footer && <p className="mt-1.5 border-t border-gray-700 pt-1.5 text-gray-400">{footer}</p>}
    </div>
  );
}

export function Swatch({ color, dashed = false, line = false }: { color: string; dashed?: boolean; line?: boolean }) {
  if (dashed || line) {
    return (
      <svg width="14" height="6" aria-hidden="true" className="shrink-0">
        <line
          x1="0"
          y1="3"
          x2="14"
          y2="3"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={dashed ? '4 3' : undefined}
        />
      </svg>
    );
  }
  return <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />;
}

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
  line?: boolean;
}

/** A plain legend row, placed above the plot so it never crowds the axis. */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <Swatch color={item.color} dashed={item.dashed} line={item.line} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
