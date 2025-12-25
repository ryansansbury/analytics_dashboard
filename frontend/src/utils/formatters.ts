import { format, formatDistanceToNow, parseISO } from 'date-fns';

// Currency formatting
export function formatCurrency(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  if (compact && Math.abs(value) >= 1_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Number formatting
export function formatNumber(value: number, compact = false): string {
  if (compact) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US').format(value);
}

// Percentage formatting
export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatPercentValue(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// Date formatting
export function formatDate(dateString: string, formatStr = 'MMM d, yyyy'): string {
  try {
    const date = parseISO(dateString);
    return format(date, formatStr);
  } catch {
    return dateString;
  }
}

export function formatDateShort(dateString: string): string {
  return formatDate(dateString, 'MMM d');
}

export function formatDateRelative(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateString;
  }
}

// Chart axis formatters
export function currencyAxisFormatter(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value}`;
}

export function numberAxisFormatter(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toString();
}

// Tooltip formatters
export function tooltipCurrencyFormatter(value: number): string {
  return formatCurrency(value);
}

export function tooltipPercentFormatter(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Color helpers
export const CHART_COLORS = [
  '#6366F1', // Indigo
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#F97316', // Orange
  '#14B8A6', // Teal
];

export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

// Trend helpers
export function getTrendColor(value: number): string {
  if (value > 0) return '#10B981'; // success
  if (value < 0) return '#EF4444'; // danger
  return '#6B7280'; // neutral
}

export function getTrendIcon(value: number): 'up' | 'down' | 'neutral' {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'neutral';
}
