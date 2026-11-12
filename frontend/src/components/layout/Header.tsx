import { RefreshCw, Moon, Sun } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useFilters, type DatePreset } from '../../hooks/useFilters';
import { formatDateRange } from '../../utils/formatters';

interface HeaderProps {
  title: string;
  /** Overrides the date range shown under the title. */
  subtitle?: string;
}

const datePresets: { value: DatePreset; label: string; short: string }[] = [
  { value: 'last7d', label: 'Last 7 days', short: '7D' },
  { value: 'last30d', label: 'Last 30 days', short: '30D' },
  { value: 'last90d', label: 'Last 90 days', short: '90D' },
  { value: 'ytd', label: 'Year to date', short: 'YTD' },
  { value: 'lastYear', label: 'Last 12 months', short: '12M' },
];

/**
 * Light unless the visitor chose dark, either earlier on this device or with
 * `?theme=dark` in the address. The parameter is how the screenshot script
 * captures both themes without clicking anything, and it persists like a click.
 */
function initialDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  const param = new URLSearchParams(window.location.search).get('theme');
  if (param === 'dark' || param === 'light') {
    localStorage.setItem('darkMode', String(param === 'dark'));
    return param === 'dark';
  }
  return localStorage.getItem('darkMode') === 'true';
}

export function Header({ title, subtitle }: HeaderProps) {
  const [darkMode, setDarkMode] = useState(initialDarkMode);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { filters, setDatePreset } = useFilters();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 600);
  }, [queryClient]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('darkMode', String(next));
      return next;
    });
  }, []);

  const { startDate, endDate, preset } = filters.dateRange;

  return (
    <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5 lg:h-14 lg:flex-nowrap lg:px-6 lg:py-0">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-white lg:text-lg">{title}</h1>
          <p className="text-xs text-gray-400">{subtitle ?? formatDateRange(startDate, endDate)}</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-gray-800 p-0.5" role="group" aria-label="Date range">
            {datePresets.map((p) => (
              <button
                key={p.value}
                onClick={() => setDatePreset(p.value)}
                aria-pressed={preset === p.value}
                title={p.label}
                className={clsx(
                  'tap-area rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  preset === p.value
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white',
                )}
              >
                <span className="hidden xl:inline">{p.label}</span>
                <span className="xl:hidden">{p.short}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="tap-area rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
              aria-label="Refresh data"
            >
              <RefreshCw className={clsx('h-4 w-4', isRefreshing && 'animate-spin')} />
            </button>
            <button
              onClick={toggleDarkMode}
              className="tap-area rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
