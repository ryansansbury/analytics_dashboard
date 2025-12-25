import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import clsx from 'clsx';

type SortDirection = 'asc' | 'desc' | null;

interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string | number;
  className?: string;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyExtractor,
  className,
  striped = true,
  hoverable = true,
  compact = false,
  onRowClick,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortKey as keyof T];
      const bValue = b[sortKey as keyof T];

      if (aValue === bValue) return 0;
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDirection]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortKey(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) {
      return <ChevronsUpDown className="h-4 w-4 text-gray-500" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="h-4 w-4 text-primary-400" />;
    }
    return <ChevronDown className="h-4 w-4 text-primary-400" />;
  };

  const cellPadding = compact ? 'px-3 py-2' : 'px-4 py-3';

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className={clsx(
                  cellPadding,
                  'text-xs font-medium text-gray-400 uppercase tracking-wider',
                  column.align === 'right' && 'text-right',
                  column.align === 'center' && 'text-center',
                  column.sortable && 'cursor-pointer select-none hover:text-gray-300'
                )}
                style={{ width: column.width }}
                onClick={
                  column.sortable
                    ? () => handleSort(String(column.key))
                    : undefined
                }
              >
                <div
                  className={clsx(
                    'flex items-center gap-1',
                    column.align === 'right' && 'justify-end',
                    column.align === 'center' && 'justify-center'
                  )}
                >
                  {column.header}
                  {column.sortable && getSortIcon(String(column.key))}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
            <tr
              key={keyExtractor(row)}
              className={clsx(
                'border-b border-gray-800/50 transition-colors',
                striped && rowIndex % 2 === 1 && 'bg-gray-900/50',
                hoverable && 'hover:bg-gray-800/50',
                onRowClick && 'cursor-pointer'
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => {
                const value = row[column.key as keyof T];
                return (
                  <td
                    key={String(column.key)}
                    className={clsx(
                      cellPadding,
                      'text-sm text-gray-300',
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center'
                    )}
                  >
                    {column.render ? column.render(value, row) : String(value ?? '')}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
