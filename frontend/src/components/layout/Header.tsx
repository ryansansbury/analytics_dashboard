import { RefreshCw, Moon, Sun, Bell, Download } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useFilters, type DatePreset } from '../../hooks/useFilters';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

const datePresets: { value: DatePreset; label: string }[] = [
  { value: 'last7d', label: 'Last 7 days' },
  { value: 'last30d', label: 'Last 30 days' },
  { value: 'last90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'lastYear', label: 'Last 12 months' },
];

export function Header({ title, subtitle }: HeaderProps) {
  const [darkMode, setDarkMode] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { filters, setDatePreset } = useFilters();
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [queryClient]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
    document.documentElement.classList.toggle('dark');
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Date Range Selector */}
          <div className="flex items-center bg-gray-800 rounded-lg p-1">
            {datePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setDatePreset(preset.value)}
                className={clsx(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                  filters.dateRange.preset === preset.value
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
              aria-label="Refresh data"
            >
              <RefreshCw
                className={clsx('h-5 w-5', isRefreshing && 'animate-spin')}
              />
            </button>

            <button
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Export data"
            >
              <Download className="h-5 w-5" />
            </button>

            <button
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors relative"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-danger rounded-full" />
            </button>

            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
