import { RefreshCw, Moon, Sun, Bell, Download, X, Check } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
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

const mockNotifications = [
  { id: 1, message: 'Revenue target exceeded by 15%', time: '2 hours ago', read: false },
  { id: 2, message: 'New enterprise customer signed', time: '5 hours ago', read: false },
  { id: 3, message: 'Pipeline milestone reached', time: '1 day ago', read: true },
];

export function Header({ title, subtitle }: HeaderProps) {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') !== 'false';
    }
    return true;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [notifications, setNotifications] = useState(mockNotifications);
  const { filters, setDatePreset } = useFilters();
  const queryClient = useQueryClient();
  const notifRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  // Initialize dark mode on mount
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [queryClient]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => {
      const newValue = !prev;
      localStorage.setItem('darkMode', String(newValue));
      if (newValue) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newValue;
    });
  }, []);

  const handleExport = useCallback((_format: 'csv' | 'json' | 'pdf') => {
    // Simulate export - in production, would trigger actual data export
    void _format; // Acknowledge parameter for future implementation
    setShowExportMenu(false);
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 2000);
  }, []);

  const markNotificationRead = useCallback((id: number) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-gray-900/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 dark:border-gray-800">
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
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
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

            {/* Export Dropdown */}
            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className={clsx(
                  'p-2 rounded-lg transition-colors',
                  exportSuccess
                    ? 'text-green-400 bg-green-900/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                )}
                aria-label="Export data"
              >
                {exportSuccess ? <Check className="h-5 w-5" /> : <Download className="h-5 w-5" />}
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-50">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    Export as JSON
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                  >
                    Export as PDF
                  </button>
                </div>
              )}
            </div>

            {/* Notifications Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="sr-only">{unreadCount} unread</span>
                  </span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-gray-800 rounded-lg shadow-lg border border-gray-700 z-50">
                  <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Notifications</h3>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.map((notif) => (
                      <button
                        key={notif.id}
                        onClick={() => markNotificationRead(notif.id)}
                        className={clsx(
                          'w-full px-4 py-3 text-left border-b border-gray-700 last:border-0 hover:bg-gray-700 transition-colors',
                          !notif.read && 'bg-gray-750'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {!notif.read && (
                            <span className="mt-1.5 h-2 w-2 bg-primary-500 rounded-full flex-shrink-0" />
                          )}
                          <div className={clsx(!notif.read ? '' : 'ml-4')}>
                            <p className="text-sm text-gray-200">{notif.message}</p>
                            <p className="text-xs text-gray-500 mt-1">{notif.time}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-gray-700">
                    <button className="text-sm text-primary-400 hover:text-primary-300">
                      View all notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

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
