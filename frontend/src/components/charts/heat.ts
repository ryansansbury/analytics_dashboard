/**
 * Binning for the two heatmaps.
 *
 * Six steps of one hue, low to high, from the validated ramp in index.css.
 * Binned rather than continuous because a reader can match a cell to a legend
 * step, and can't match one to a point on a smooth gradient.
 */

export const HEAT_STEPS = 6;

export function heatColor(step: number): string {
  return `var(--color-heat-${step})`;
}

export function heatInk(step: number): string {
  return `var(--color-heat-ink-${step})`;
}

/**
 * Step 1 to 6 for `value` given five ascending thresholds. A value at a
 * threshold belongs to the step above it.
 */
export function heatStep(value: number, thresholds: number[]): number {
  let step = 1;
  for (const t of thresholds) {
    if (value >= t) step += 1;
  }
  return Math.min(step, HEAT_STEPS);
}

/**
 * Five thresholds splitting `values` into six groups of roughly equal size.
 *
 * Quantiles suit daily revenue, whose spread is lopsided: equal-width bins put
 * every weekend in the first step and most weekdays in the second, and the
 * chart reads as two colours.
 */
export function quantileThresholds(values: number[]): number[] {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return [];
  return [1, 2, 3, 4, 5].map((k) => {
    const pos = (sorted.length - 1) * (k / HEAT_STEPS);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  });
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Steps from weekday revenue. A weekend trades at a fraction of a weekday, so
 * steps cut from every day spent most of the scale telling weekends from
 * weekdays and left nearly every weekday in the top two, where neither the
 * year's growth nor the quarter-end pushes could show. Here the weekdays fill
 * the upper five steps in equal shares, and anything below a slow weekday,
 * which is nearly every weekend, takes the first.
 */
export function weekdayThresholds(days: { weekday: number; revenue: number }[]): number[] {
  const weekdays = days
    .filter((d) => d.weekday < 5 && d.revenue > 0)
    .map((d) => d.revenue)
    .sort((a, b) => a - b);
  if (!weekdays.length) return [];
  return [0.05, 0.25, 0.45, 0.65, 0.85].map((q) => quantile(weekdays, q));
}
