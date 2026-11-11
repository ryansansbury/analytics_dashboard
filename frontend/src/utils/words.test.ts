import { describe, expect, it } from 'vitest'
import { colorFor, colorsFor, labelFor, OTHER_COLOR } from './colors'
import { csvField, toCSV } from './csv'
import { daysInclusive, formatChange, formatDateRange, formatMonthYear, formatShare } from './formatters'

describe('dates in words', () => {
  it('says the year once when both ends share it', () => {
    expect(formatDateRange('2026-08-08', '2026-11-06')).toBe('Aug 8 to Nov 6, 2026')
  })

  it('says both years when they differ', () => {
    expect(formatDateRange('2025-11-06', '2026-11-06')).toBe('Nov 6, 2025 to Nov 6, 2026')
  })

  it('names a month', () => {
    expect(formatMonthYear('2026-11-01')).toBe('November 2026')
    expect(formatMonthYear('2026-11-01', true)).toBe('Nov 2026')
  })

  it('counts both ends of a window', () => {
    expect(daysInclusive('2026-08-08', '2026-11-06')).toBe(91)
    expect(daysInclusive('2026-11-06', '2026-11-06')).toBe(1)
  })
})

describe('signed changes', () => {
  it('keeps the sign of a fall', () => {
    expect(formatChange(-8.46)).toBe('-8.5%')
  })

  it('prefixes a rise', () => {
    expect(formatChange(12.3)).toBe('+12.3%')
  })

  it('leaves zero unsigned', () => {
    expect(formatChange(0)).toBe('0.0%')
  })

  it('speaks percentage points when asked', () => {
    expect(formatChange(-9.1, 'pts')).toBe('-9.1 pts')
  })

  it('returns null rather than a number when there is nothing to compare', () => {
    expect(formatChange(null)).toBeNull()
    expect(formatChange(undefined)).toBeNull()
    expect(formatChange(Number.NaN)).toBeNull()
  })
})

describe('shares', () => {
  it('never calls a real share zero', () => {
    expect(formatShare(0.4)).toBe('<1%')
    expect(formatShare(0)).toBe('0%')
    expect(formatShare(23.8)).toBe('24%')
  })
})

describe('entity colours', () => {
  it('follow the entity, whatever order the keys arrive in', () => {
    const ranked = colorsFor('category', ['Data Analytics', 'Security Solutions'])
    const reranked = colorsFor('category', ['Security Solutions', 'Data Analytics'])
    expect(ranked[0]).toBe(reranked[1])
    expect(ranked[1]).toBe(reranked[0])
  })

  it('give Other the muted ink, never a ninth hue', () => {
    expect(colorFor('category', 'Other')).toBe(OTHER_COLOR)
  })

  it('assign slots in the listed order', () => {
    expect(colorFor('region', 'North America')).toBe('var(--color-chart-1)')
    expect(colorFor('region', 'Middle East')).toBe('var(--color-chart-5)')
  })

  it('put the API keys in words', () => {
    expect(labelFor('mid-market')).toBe('Mid-market')
    expect(labelFor('Asia Pacific')).toBe('Asia Pacific')
  })
})

describe('csv', () => {
  it('quotes a field holding a delimiter and doubles its quotes', () => {
    expect(csvField('Acme, Inc.')).toBe('"Acme, Inc."')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('plain')).toBe('plain')
  })

  it('writes numbers raw, so a figure stays one column', () => {
    const text = toCSV(
      [{ key: 'name', header: 'Name' }, { key: 'revenue', header: 'Revenue' }],
      [{ name: 'Data, Inc.', revenue: 1234567.89 }],
    )
    expect(text).toBe('Name,Revenue\r\n"Data, Inc.",1234567.89')
  })

  it('uses a column value function when given one', () => {
    const text = toCSV(
      [{ key: 'share', header: 'Share', value: (r: { share: number }) => r.share / 100 }],
      [{ share: 25 }],
    )
    expect(text).toBe('Share\r\n0.25')
  })
})
