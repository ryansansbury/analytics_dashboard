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
}

export function KPICard({
  label,
  value,
  previousValue,
  change,
  changePercent,
  format = 'number',
  icon,
  className,
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

  return (
    <div
      className={clsx(
        'bg-gray-900 rounded-xl border border-gray-800 p-6 card-hover',
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-sm font-medium text-gray-400">{label}</span>
        {icon && (
          <div className="p-2 bg-primary-500/10 rounded-lg text-primary-500">
            {icon}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-3xl font-bold text-white tabular-nums">
          {formattedValue}
        </p>

        {changePercent !== undefined && (
          <div className="flex items-center gap-2">
            <span
              className={clsx(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                trendBg,
                trendColor
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {formatPercent(Math.abs(changePercent))}
            </span>
            <span className="text-xs text-gray-500">vs previous period</span>
          </div>
        )}

        {previousValue !== undefined && change !== undefined && (
          <p className="text-xs text-gray-500">
            Previous: {format === 'currency' ? formatCurrency(previousValue, true) : formatNumber(previousValue, true)}
            {' '}
            ({change >= 0 ? '+' : ''}{format === 'currency' ? formatCurrency(change, true) : formatNumber(change, true)})
          </p>
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
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4',
        className
      )}
    >
      {children}
    </div>
  );
}
