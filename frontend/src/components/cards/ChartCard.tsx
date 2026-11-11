import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { BarChart3, Download, Table2 } from 'lucide-react';
import { Loading } from '../common/Loading';
import { ErrorBoundary, ErrorMessage } from '../common/ErrorBoundary';
import { useContainerSize } from '../../hooks/useContainerSize';
import { downloadCSV, toCSV } from '../../utils/csv';

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  /** Text for the cell on screen. */
  format?: (row: T) => string;
  /** Value for the CSV, raw rather than formatted. Defaults to the field. */
  raw?: (row: T) => unknown;
}

/**
 * The same numbers as the chart, as rows.
 *
 * Every chart carries one. A table is how a screen-reader user, a
 * colour-blind reader with a dense chart, or anyone wanting the exact figure
 * gets at the data, and it's what the CSV download writes.
 */
export interface TableView<T extends Record<string, unknown> = Record<string, unknown>> {
  columns: TableColumn<T>[];
  rows: T[];
  filename: string;
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  actions?: ReactNode;
  className?: string;
  noPadding?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table?: TableView<any>;
  /**
   * Let the body size to its content and scroll, for HTML charts and tables.
   * Without it the body is measured and handed to the chart as a fixed height,
   * which is what Recharts' responsive container needs.
   */
  flow?: boolean;
}

export function ChartCard({
  title,
  subtitle,
  children,
  loading = false,
  error = null,
  onRetry,
  actions,
  className,
  noPadding = false,
  table,
  flow = false,
}: ChartCardProps) {
  const [containerRef, containerSize] = useContainerSize<HTMLDivElement>();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const showTable = view === 'table' && table;

  return (
    <section
      className={clsx('flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900', className)}
      aria-label={title}
      data-card=""
    >
      <header className="flex flex-shrink-0 items-start justify-between gap-3 px-4 pb-2 pt-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-snug text-white">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {actions}
          {table && (
            <div className="flex rounded-md bg-gray-800 p-0.5" role="group" aria-label="View">
              <ViewButton active={view === 'chart'} onClick={() => setView('chart')} label="Chart view">
                <BarChart3 className="h-3.5 w-3.5" />
              </ViewButton>
              <ViewButton active={view === 'table'} onClick={() => setView('table')} label="Table view">
                <Table2 className="h-3.5 w-3.5" />
              </ViewButton>
            </div>
          )}
        </div>
      </header>

      <div
        ref={containerRef}
        className={clsx('min-h-0 flex-1', !noPadding && 'px-4 pb-3', (flow || showTable) && 'overflow-auto')}
      >
        {loading ? (
          <div className="flex h-full min-h-[120px] items-center justify-center">
            <Loading text="Loading..." />
          </div>
        ) : error ? (
          <ErrorMessage message={error.message} onRetry={onRetry} />
        ) : showTable ? (
          <DataView table={table} />
        ) : (
          // One chart failing to draw blanks its own card, not the page.
          <ErrorBoundary fallback={<ErrorMessage message="This chart couldn't be drawn from the data it received." />}>
            {flow ? (
              children
            ) : containerSize.height > 0 ? (
              <div style={{ width: '100%', height: containerSize.height }}>{children}</div>
            ) : null}
          </ErrorBoundary>
        )}
      </div>
    </section>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={clsx(
        'rounded p-1 transition-colors',
        active ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white',
      )}
    >
      {children}
    </button>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DataView({ table }: { table: TableView<any> }) {
  const download = () => {
    const csv = toCSV(
      table.columns.map((c) => ({
        key: c.key,
        header: c.header,
        value: (row: Record<string, unknown>) => (c.raw ? c.raw(row) : row[c.key]),
      })),
      table.rows,
    );
    downloadCSV(table.filename, csv);
  };

  return (
    <div className="flex flex-col gap-2">
      <table className="w-full text-xs tabular-nums">
        <thead className="sticky top-0 bg-gray-900">
          <tr className="border-b border-gray-800 text-gray-400">
            {table.columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={clsx('px-2 py-1.5 font-medium', c.align === 'right' ? 'text-right' : 'text-left')}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-800/50 last:border-0">
              {table.columns.map((c) => (
                <td
                  key={c.key}
                  className={clsx('px-2 py-1.5 text-gray-300', c.align === 'right' ? 'text-right' : 'text-left')}
                >
                  {c.format ? c.format(row) : String(row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={download}
        className="inline-flex items-center gap-1.5 self-end rounded-md px-2 py-1 text-xs text-primary-500 hover:bg-gray-800"
      >
        <Download className="h-3.5 w-3.5" />
        Download CSV
      </button>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  className?: string;
}

/** A figure with a label and an optional line of context, for panels inside a card. */
export function StatCard({ title, value, subtitle, icon, className }: StatCardProps) {
  return (
    <div className={clsx('rounded-lg border border-gray-800 px-3 py-2', className)}>
      <div className="flex items-center gap-2">
        {icon && <div className="flex-shrink-0 rounded-md bg-gray-800 p-1.5 text-gray-400">{icon}</div>}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-400">{title}</p>
          <p className="text-lg font-semibold tabular-nums text-white">{value}</p>
          {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
