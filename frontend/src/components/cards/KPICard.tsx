import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';
import { formatChange, formatCurrency, formatNumber } from '../../utils/formatters';
import { Sparkline } from '../charts/Sparkline';

interface KPICardProps {
  label: string;
  /**
   * The measurement. `null` means the API had nothing to report, which is not
   * the same as zero, and renders as an em-dash.
   *
   * Pages used to paper over a missing value with a literal placeholder
   * (`overview?.total || 500`, `avgCycleTime || 42`). A card claiming 500
   * customers because the request returned nothing is worse than a card
   * admitting it does not know.
   */
  value: number | null;
  /**
   * Change against the prior period, in `changeUnit`.
   *
   * `null` is meaningful and distinct from a zero: it means there was no prior
   * observation to compare against, so no delta exists. Both null and
   * undefined suppress the badge entirely.
   */
  changePercent?: number | null;
  /** Percentage points for figures that are already percentages, like win rate. */
  changeUnit?: '%' | 'pts';
  /** For figures where down is good, like cycle time: a fall is shown as good news. */
  invert?: boolean;
  /** What the change compares against, shown beside the badge. */
  comparison?: string;
  format?: 'currency' | 'number' | 'percent' | 'days';
  /** One value per bucket, drawn as a sparkline. */
  trend?: (number | null)[];
  /** A line of context under the value. */
  caption?: string;
  icon?: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export function KPICard({
  label,
  value,
  changePercent,
  changeUnit = '%',
  invert = false,
  comparison,
  format = 'number',
  trend,
  caption,
  icon,
  className,
  loading = false,
}: KPICardProps) {
  const formattedValue = (() => {
    if (value == null) return '—';
    switch (format) {
      case 'currency':
        return formatCurrency(value, true);
      case 'percent':
        return `${value.toFixed(1)}%`;
      case 'days':
        return `${value.toFixed(0)} days`;
      default:
        return formatNumber(value, true);
    }
  })();

  // Loose inequality on purpose: catches null and undefined together. Using
  // `!== undefined` here rendered a "+0.0%" badge whenever the API sent null.
  const hasChange = changePercent != null;
  const direction = !hasChange || changePercent === 0 ? 'flat' : changePercent > 0 ? 'up' : 'down';
  const good = direction === 'flat' ? null : (direction === 'up') !== invert;
  const TrendIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;

  if (loading) {
    return (
      <div className={clsx('rounded-xl border border-gray-800 bg-gray-900 px-4 py-3', className)} data-testid="kpi-skeleton">
        <div className="mb-2 h-3 w-20 animate-pulse rounded bg-gray-800" />
        <div className="mb-3 h-6 w-24 animate-pulse rounded bg-gray-800" />
        <div className="h-6 w-full animate-pulse rounded bg-gray-800" />
      </div>
    );
  }

  /*
   * The change sits on the line under the figure, beside what it compares
   * against, so it reads as one statement: up 27% on the prior 365 days. In
   * the top corner it crowded the label, and on a phone, where a tile is half
   * the screen, "Revenue" was cut to "Reve...".
   */
  const badge = hasChange && (
    <span
      className={clsx(
        'inline-flex flex-shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
        good === true && 'bg-success/10 text-success',
        good === false && 'bg-danger/10 text-danger',
        good === null && 'bg-gray-800 text-gray-400',
      )}
    >
      <TrendIcon className="h-3 w-3" aria-hidden="true" />
      {formatChange(changePercent, changeUnit)}
    </span>
  );

  return (
    <div className={clsx('flex h-full min-w-0 flex-col rounded-xl border border-gray-800 bg-gray-900 px-4 py-3', className)}>
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-400">
        {icon && <span className="flex-shrink-0 text-primary-500">{icon}</span>}
        <span className="kpi-label truncate">{label}</span>
      </span>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-white tabular-nums">{formattedValue}</p>
      {/* On a phone, where a tile is half the screen, the comparison and the
        * caption wrap instead of cutting off (kpi-change in index.css). */}
      {hasChange && (
        <div className="kpi-change mt-0.5 flex min-w-0 items-center gap-1.5">
          {badge}
          {comparison && <p className="kpi-note min-w-0 truncate text-[11px] text-gray-500">{comparison}</p>}
        </div>
      )}
      {caption && <p className="kpi-note mt-0.5 truncate text-[11px] text-gray-500">{caption}</p>}
      {trend && trend.length > 1 && (
        <div className="mt-auto pt-2">
          <Sparkline values={trend} height={28} label={`${label} trend`} />
        </div>
      )}
    </div>
  );
}

interface KPIGridProps {
  children: React.ReactNode;
  className?: string;
}

export function KPIGrid({ children, className }: KPIGridProps) {
  return (
    <div className={clsx('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {children}
    </div>
  );
}
