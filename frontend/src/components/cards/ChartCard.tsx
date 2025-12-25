import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Loading } from '../common/Loading';
import { ErrorMessage } from '../common/ErrorBoundary';

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
}: ChartCardProps) {
  return (
    <div
      className={clsx(
        'bg-gray-900 rounded-xl border border-gray-800',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Content */}
      <div className={clsx(!noPadding && 'p-6')}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loading text="Loading data..." />
          </div>
        ) : error ? (
          <ErrorMessage
            message={error.message}
            onRetry={onRetry}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
  icon?: ReactNode;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  className,
}: StatCardProps) {
  const trendColor = trend
    ? trend.value > 0
      ? 'text-success'
      : trend.value < 0
        ? 'text-danger'
        : 'text-gray-400'
    : 'text-gray-400';

  return (
    <div
      className={clsx(
        'bg-gray-900 rounded-xl border border-gray-800 p-5',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={clsx('text-xs mt-2', trendColor)}>
              {trend.value > 0 ? '↑' : trend.value < 0 ? '↓' : '→'}{' '}
              {Math.abs(trend.value).toFixed(1)}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2 bg-gray-800 rounded-lg text-gray-400">{icon}</div>
        )}
      </div>
    </div>
  );
}
