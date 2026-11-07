/**
 * Formatting Utilities
 *
 * This module provides consistent formatting functions for displaying data
 * throughout the analytics dashboard. All formatters are locale-aware and
 * use US English (en-US) formatting conventions.
 *
 * Categories:
 * - Currency: Dollar formatting with optional compact notation ($1.2M)
 * - Numbers: Numeric formatting with thousands separators
 * - Percentages: Percent formatting with sign indicators
 * - Dates: Date formatting using date-fns library
 * - Chart Helpers: Axis formatters and tooltip formatters
 * - Colors: Chart color palette and trend color helpers
 */

import { format, formatDistanceToNow, parseISO } from 'date-fns';

// ============================================================================
// Currency Formatting
// ============================================================================

/**
 * Format a number as US currency
 *
 * @param value - Numeric value to format
 * @param compact - If true, uses compact notation ($1.2M instead of $1,200,000)
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(1234567)        // "$1,234,567"
 * formatCurrency(1234567, true)  // "$1.2M"
 */
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

/* ---------------------------------------------------------------------------
 * Chart colour
 *
 * These resolve to CSS custom properties rather than literal hex, so light and
 * dark each get their own validated steps from one definition in index.css.
 * Recharts writes them straight into SVG fill/stroke, where var() resolves.
 *
 * The palette passed the six-check validator against both real surfaces. Its
 * predecessor did not: it failed the lightness band on five of eight steps and
 * put emerald and cyan 12.5 normal-vision deltaE apart, below the 15 floor.
 * ------------------------------------------------------------------------- */

/** Number of categorical slots. Ordering is the CVD-safety mechanism. */
export const CHART_SLOT_COUNT = 8;

export const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)',
  'var(--color-chart-7)',
  'var(--color-chart-8)',
];

/**
 * Colour for categorical series `index`.
 *
 * Deliberately does NOT wrap with a modulo. Cycling produces a ninth series
 * that is indistinguishable from the first under colour-vision deficiency, and
 * a reader who learned "slot 1 is blue" is then misled. Past the eighth slot
 * this returns the muted ink so the overflow reads as "Other" rather than
 * impersonating a real series - fold the tail or facet instead.
 */
export function getChartColor(index: number): string {
  return CHART_COLORS[index] ?? 'var(--color-ink-muted)';
}

/**
 * Colour for ORDERED categories - funnel stages, tiers, age bands.
 *
 * One hue, light to dark. Never use this for nominal categories: a value ramp
 * over unordered items double-encodes magnitude that bar length already shows,
 * and burns the only free channel to say nothing new.
 *
 * Light mode has five validated steps and dark has six, because the light
 * surface cannot hold a sixth step with a visible lightness gap that still
 * clears the contrast floor. Beyond the available steps this clamps to the
 * darkest rather than inventing one; in a funnel the tail stages are the
 * shortest bars, so length keeps them separable.
 */
export function getOrdinalColor(index: number, total: number): string {
  return `var(--color-ordinal-${ordinalStep(index, total)})`;
}

/** 1-based ramp step for `index` of `total`. */
function ordinalStep(index: number, total: number): number {
  const steps = 5;
  const position = total <= 1 ? 0 : Math.round((index / (total - 1)) * (steps - 1));
  return Math.min(position, steps - 1) + 1;
}

/**
 * Readable ink for a label drawn ON an ordinal step.
 *
 * The ramp runs light to dark, so no single label colour works across it.
 * White measures 2.1:1 against the lightest light-mode step and 1.3:1 against
 * the lightest dark-mode step, which is invisible. Each step carries its own
 * paired ink in index.css, chosen for contrast and verified at 4.5:1 or better.
 */
export function getOrdinalInk(index: number, total: number): string {
  return `var(--color-ordinal-${ordinalStep(index, total)}-ink)`;
}

/** Chart chrome. Recessive by design - hairlines, one shade off the surface. */
export const CHART_CHROME = {
  grid: 'var(--color-grid)',
  axis: 'var(--color-axis)',
  mutedInk: 'var(--color-ink-muted)',
};

// Trend helpers
/**
 * Colour for a delta.
 *
 * Uses the reserved status tokens, never a categorical series slot. Status
 * colours mean good/bad; series colours mean identity. Letting one do the
 * other's job means a reader cannot tell whether green is "series 3" or "up".
 *
 * These always ship alongside an arrow icon and the number itself, so meaning
 * never rests on colour alone.
 */
export function getTrendColor(value: number): string {
  if (value > 0) return 'var(--color-status-good)';
  if (value < 0) return 'var(--color-status-critical)';
  return 'var(--color-ink-muted)';
}

export function getTrendIcon(value: number): 'up' | 'down' | 'neutral' {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'neutral';
}

// ============================================================================
// Words for dates and signed changes
// ============================================================================

/** '2026-08-08' and '2026-11-06' as "Aug 8 to Nov 6, 2026", the year said once when shared. */
export function formatDateRange(start: string, end: string): string {
  const a = parseISO(start);
  const b = parseISO(end);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return `${start} to ${end}`;
  if (a.getFullYear() === b.getFullYear()) {
    return `${format(a, 'MMM d')} to ${format(b, 'MMM d, yyyy')}`;
  }
  return `${format(a, 'MMM d, yyyy')} to ${format(b, 'MMM d, yyyy')}`;
}

/** '2026-11-01' as "November 2026", or "Nov 2026" when short. */
export function formatMonthYear(dateString: string, short = false): string {
  return formatDate(dateString, short ? 'MMM yyyy' : 'MMMM yyyy');
}

/** A change with its sign, "+4.2%" or "-3.1%". Null when there's nothing to compare. */
export function formatChange(
  value: number | null | undefined,
  unit: '%' | 'pts' = '%',
  decimals = 1,
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const magnitude = Math.abs(value).toFixed(decimals);
  return unit === 'pts' ? `${sign}${magnitude} pts` : `${sign}${magnitude}%`;
}

export function percentAxisFormatter(value: number): string {
  return `${Math.round(value)}%`;
}

/** A share as a whole percent, with "<1%" for a real share too small to round up. Nine customers aren't 0%. */
export function formatShare(percent: number): string {
  if (percent > 0 && percent < 0.5) return '<1%';
  return `${Math.round(percent)}%`;
}

/** Whole days from one ISO date to another, both ends counted. */
export function daysInclusive(start: string, end: string): number {
  const span = parseISO(end).getTime() - parseISO(start).getTime();
  return Math.round(span / 86_400_000) + 1;
}
