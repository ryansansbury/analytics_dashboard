import { describe, expect, it } from 'vitest'
import {
  CHART_COLORS,
  CHART_SLOT_COUNT,
  currencyAxisFormatter,
  formatCurrency,
  formatDate,
  formatDateShort,
  formatNumber,
  formatPercent,
  formatPercentValue,
  getChartColor,
  getOrdinalColor,
  getTrendColor,
  getTrendIcon,
  numberAxisFormatter,
  tooltipCurrencyFormatter,
  tooltipPercentFormatter,
} from './formatters'

describe('formatCurrency', () => {
  it('formats whole dollars without cents', () => {
    expect(formatCurrency(1234567)).toBe('$1,234,567')
  })

  it('rounds rather than truncating', () => {
    expect(formatCurrency(1234.6)).toBe('$1,235')
  })

  it('uses compact notation above a thousand', () => {
    expect(formatCurrency(1_200_000, true)).toBe('$1.2M')
    expect(formatCurrency(1500, true)).toBe('$1.5K')
  })

  it('stays long-form below a thousand even when compact', () => {
    expect(formatCurrency(999, true)).toBe('$999')
  })

  it('handles zero and negatives', () => {
    expect(formatCurrency(0)).toBe('$0')
    expect(formatCurrency(-5000)).toBe('-$5,000')
    expect(formatCurrency(-1_500_000, true)).toBe('-$1.5M')
  })
})

describe('formatNumber', () => {
  it('adds thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('compacts when asked', () => {
    expect(formatNumber(1_200_000, true)).toBe('1.2M')
    expect(formatNumber(2500, true)).toBe('2.5K')
  })

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatPercent', () => {
  it('signs positives explicitly', () => {
    expect(formatPercent(12.34)).toBe('+12.3%')
  })

  it('keeps the native minus on negatives', () => {
    expect(formatPercent(-8.5)).toBe('-8.5%')
  })

  it('treats zero as non-negative', () => {
    expect(formatPercent(0)).toBe('+0.0%')
  })

  it('respects the decimals argument', () => {
    expect(formatPercent(12.345, 2)).toBe('+12.35%')
    expect(formatPercent(12.345, 0)).toBe('+12%')
  })

  it('formatPercentValue omits the sign', () => {
    expect(formatPercentValue(12.34)).toBe('12.3%')
    expect(formatPercentValue(-8.5)).toBe('-8.5%')
  })
})

describe('date formatting', () => {
  it('formats an ISO date', () => {
    expect(formatDate('2026-03-15')).toBe('Mar 15, 2026')
    expect(formatDateShort('2026-03-15')).toBe('Mar 15')
  })

  it('accepts a custom pattern', () => {
    expect(formatDate('2026-03-15', 'yyyy-MM')).toBe('2026-03')
  })

  it('returns the input unchanged when it cannot be parsed', () => {
    // Chart axes feed this whatever the API sent. Throwing would blank the page.
    expect(formatDate('not-a-date')).toBe('not-a-date')
    expect(formatDate('')).toBe('')
  })
})

describe('axis formatters', () => {
  it('scales currency by magnitude', () => {
    expect(currencyAxisFormatter(2_500_000)).toBe('$2.5M')
    expect(currencyAxisFormatter(45_000)).toBe('$45K')
    expect(currencyAxisFormatter(500)).toBe('$500')
  })

  it('scales plain numbers by magnitude', () => {
    expect(numberAxisFormatter(2_500_000)).toBe('2.5M')
    expect(numberAxisFormatter(45_000)).toBe('45K')
    expect(numberAxisFormatter(500)).toBe('500')
  })

  it('switches exactly at the boundaries', () => {
    expect(currencyAxisFormatter(1_000_000)).toBe('$1.0M')
    expect(currencyAxisFormatter(999_999)).toBe('$1000K')
    expect(numberAxisFormatter(1000)).toBe('1K')
    expect(numberAxisFormatter(999)).toBe('999')
  })
})

describe('tooltip formatters', () => {
  it('formats currency in full', () => {
    expect(tooltipCurrencyFormatter(1234567)).toBe('$1,234,567')
  })

  it('formats percentages to one decimal', () => {
    expect(tooltipPercentFormatter(12.345)).toBe('12.3%')
  })
})

describe('chart colours', () => {
  it('exposes exactly eight categorical slots', () => {
    expect(CHART_COLORS).toHaveLength(CHART_SLOT_COUNT)
    expect(CHART_SLOT_COUNT).toBe(8)
  })

  it('resolves slots through CSS custom properties', () => {
    // Light and dark are separately validated palettes rather than one flipped
    // onto the other surface, so the hex lives in CSS and swaps with the mode.
    CHART_COLORS.forEach((c) => expect(c).toMatch(/^var\(--color-chart-[1-8]\)$/))
  })

  it('assigns slots in fixed order', () => {
    expect(getChartColor(0)).toBe('var(--color-chart-1)')
    expect(getChartColor(7)).toBe('var(--color-chart-8)')
  })

  it('does NOT cycle past the eighth slot', () => {
    /*
     * Regression test. The palette was indexed with a modulo, so a ninth series
     * silently reused slot 1. That is indistinguishable from the first series
     * under colour-vision deficiency, and it misleads any reader who has
     * already learned which entity is blue. Overflow now returns muted ink so
     * it reads as "Other" instead of impersonating a real series.
     */
    expect(getChartColor(8)).toBe('var(--color-ink-muted)')
    expect(getChartColor(20)).toBe('var(--color-ink-muted)')
    expect(getChartColor(8)).not.toBe(getChartColor(0))
  })

  it('returns something usable for any index', () => {
    for (let i = 0; i < 40; i += 1) {
      expect(getChartColor(i)).toMatch(/^var\(--color-[a-z0-9-]+\)$/)
    }
  })
})

describe('ordinal ramp', () => {
  it('walks light to dark across the available steps', () => {
    expect(getOrdinalColor(0, 5)).toBe('var(--color-ordinal-1)')
    expect(getOrdinalColor(4, 5)).toBe('var(--color-ordinal-5)')
  })

  it('spreads evenly when there are fewer stages than steps', () => {
    expect(getOrdinalColor(0, 3)).toBe('var(--color-ordinal-1)')
    expect(getOrdinalColor(1, 3)).toBe('var(--color-ordinal-3)')
    expect(getOrdinalColor(2, 3)).toBe('var(--color-ordinal-5)')
  })

  it('clamps rather than inventing a step when stages exceed the ramp', () => {
    const last = getOrdinalColor(9, 10)
    expect(last).toBe('var(--color-ordinal-5)')
  })

  it('never goes backwards', () => {
    const total = 6
    const steps = Array.from({ length: total }, (_, i) =>
      Number(getOrdinalColor(i, total).match(/(\d+)/)![1])
    )
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1])
    }
  })

  it('handles a single stage without dividing by zero', () => {
    expect(getOrdinalColor(0, 1)).toBe('var(--color-ordinal-1)')
  })
})

describe('trend helpers', () => {
  it('uses reserved status tokens rather than series colours', () => {
    /*
     * A delta means good or bad, so it wears the status palette. Reusing a
     * categorical series hue for it would let a "series 3" colour read as
     * success somewhere else on the same screen.
     */
    expect(getTrendColor(5)).toBe('var(--color-status-good)')
    expect(getTrendColor(-5)).toBe('var(--color-status-critical)')
    expect(getTrendColor(0)).toBe('var(--color-ink-muted)')
  })

  it('maps sign to direction', () => {
    expect(getTrendIcon(5)).toBe('up')
    expect(getTrendIcon(-5)).toBe('down')
    expect(getTrendIcon(0)).toBe('neutral')
  })
})
