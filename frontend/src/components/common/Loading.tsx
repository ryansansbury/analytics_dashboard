import clsx from 'clsx';

interface LoadingProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function Loading({ className, size = 'md', text }: LoadingProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3',
        className
      )}
    >
      <div
        className={clsx(
          'animate-spin rounded-full border-2 border-gray-700 border-t-primary-500',
          sizeClasses[size]
        )}
      />
      {text && <p className="text-sm text-gray-400">{text}</p>}
    </div>
  );
}

interface LoadingCardProps {
  className?: string;
}

export function LoadingCard({ className }: LoadingCardProps) {
  return (
    <div
      className={clsx(
        'bg-gray-900 rounded-xl border border-gray-800 p-6 animate-pulse',
        className
      )}
    >
      <div className="h-4 bg-gray-800 rounded w-1/3 mb-4" />
      <div className="h-8 bg-gray-800 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-800 rounded w-1/4" />
    </div>
  );
}

interface LoadingChartProps {
  className?: string;
  height?: number;
}

export function LoadingChart({ className, height = 300 }: LoadingChartProps) {
  return (
    <div
      className={clsx(
        'bg-gray-900 rounded-xl border border-gray-800 p-6 animate-pulse',
        className
      )}
      style={{ height }}
    >
      <div className="h-4 bg-gray-800 rounded w-1/4 mb-6" />
      <div className="flex items-end justify-between h-[calc(100%-4rem)] gap-2">
        {[40, 65, 45, 80, 55, 70, 60, 75, 50, 85, 65, 70].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-800 rounded-t"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
