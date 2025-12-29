import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';
import { formatCurrency, formatNumber, formatPercent } from '../../utils/formatters';

interface KPICardProps {
  label: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  format?: 'currency' | 'number' | 'percent';
  icon?: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export function KPICard({
  label,
  value,
  previousValue: _previousValue,
  change: _change,
  changePercent,
  format = 'number',
  icon,
  className,
  loading = false,
}: KPICardProps) {
  const formattedValue = (() => {
    switch (format) {
      case 'currency':
        return formatCurrency(value, true);
      case 'percent':
        return `${value.toFixed(1)}%`;
      default:
        return formatNumber(value, true);
    }
  })();

  const trend = changePercent !== undefined
    ? changePercent > 0
      ? 'up'
      : changePercent < 0
        ? 'down'
        : 'neutral'
    : 'neutral';

  const TrendIcon = trend === 'up'
    ? TrendingUp
    : trend === 'down'
      ? TrendingDown
      : Minus;

  const trendColor = trend === 'up'
    ? 'text-success'
    : trend === 'down'
      ? 'text-danger'
      : 'text-gray-400';

  const trendBg = trend === 'up'
    ? 'bg-success/10'
    : trend === 'down'
      ? 'bg-danger/10'
      : 'bg-gray-800';

  if (loading) {
    return (
      <div
        className={clsx(
          'bg-gray-900 rounded-lg border border-gray-800 px-3 py-2',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 bg-gray-800 rounded animate-pulse flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-3 w-16 bg-gray-800 rounded animate-pulse mb-1" />
            <div className="h-5 w-20 bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="h-4 w-12 bg-gray-800 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'bg-gray-900 rounded-lg border border-gray-800 px-3 py-2 card-hover',
        className
      )}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-1.5 bg-primary-500/10 rounded-md text-primary-500 flex-shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <span className="text-xs font-medium text-gray-400 block">{label}</span>
          <p className="text-lg font-bold text-white tabular-nums">
            {formattedValue}
          </p>
        </div>
        {changePercent !== undefined && (
          <span
            className={clsx(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
              trendBg,
              trendColor
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {formatPercent(Math.abs(changePercent))}
          </span>
        )}
      </div>
    </div>
  );
}

interface KPIGridProps {
  children: React.ReactNode;
  className?: string;
}

export function KPIGrid({ children, className }: KPIGridProps) {
  return (
    <div
      className={clsx(
        'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2',
        className
      )}
    >
      {children}
    </div>
  );
}
