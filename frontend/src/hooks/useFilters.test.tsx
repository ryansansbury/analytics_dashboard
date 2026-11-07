import { act, renderHook } from '@testing-library/react'
import { addDays, differenceInCalendarDays, format, subDays, subMonths, startOfYear } from 'date-fns'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { FilterProvider, useFilters } from './useFilters'

const wrapper = ({ children }: { children: ReactNode }) => (
  <FilterProvider>{children}</FilterProvider>
)

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

function setup() {
  return renderHook(() => useFilters(), { wrapper })
}

describe('useFilters', () => {
  it('throws outside a provider rather than returning undefined', () => {
    // A silent undefined here would surface much later as a crash inside a page.
    expect(() => renderHook(() => useFilters())).toThrow()
  })

  it('defaults to the last 90 days with no dimension filters', () => {
    const { result } = setup()
    expect(result.current.filters.dateRange.preset).toBe('last90d')
    expect(result.current.filters.region).toBeUndefined()
    expect(result.current.filters.segment).toBeUndefined()
    expect(result.current.filters.category).toBeUndefined()
  })

  it('emits ISO yyyy-MM-dd dates, which is what the API expects', () => {
    const { result } = setup()
    const { startDate, endDate } = result.current.filters.dateRange
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('keeps start before end', () => {
    const { result } = setup()
    const { startDate, endDate } = result.current.filters.dateRange
    expect(new Date(startDate).getTime()).toBeLessThan(new Date(endDate).getTime())
  })

  describe('presets', () => {
    const today = new Date()
    const cases: Array<[string, string]> = [
      ['last7d', iso(subDays(today, 6))],
      ['last30d', iso(subDays(today, 29))],
      ['last90d', iso(subDays(today, 89))],
      ['ytd', iso(startOfYear(today))],
      ['lastYear', iso(addDays(subMonths(today, 12), 1))],
    ]

    it.each([
      ['last7d', 7],
      ['last30d', 30],
      ['last90d', 90],
    ])('%s holds exactly %i days, both ends counted', (preset, days) => {
      const { result } = setup()
      act(() => result.current.setDatePreset(preset as never))
      const { startDate, endDate } = result.current.filters.dateRange
      expect(differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1).toBe(days)
    })

    it.each(cases)('%s computes the right start date', (preset, expected) => {
      const { result } = setup()
      act(() => result.current.setDatePreset(preset as never))
      expect(result.current.filters.dateRange.startDate).toBe(expected)
      expect(result.current.filters.dateRange.preset).toBe(preset)
    })

    it('every preset ends today', () => {
      const { result } = setup()
      for (const [preset] of cases) {
        act(() => result.current.setDatePreset(preset as never))
        expect(result.current.filters.dateRange.endDate).toBe(iso(new Date()))
      }
    })

    it('an unknown preset falls back to last 30 days', () => {
      const { result } = setup()
      act(() => result.current.setDatePreset('nonsense' as never))
      expect(result.current.filters.dateRange.preset).toBe('last30d')
    })
  })

  describe('dimension filters', () => {
    it('sets and clears each dimension independently', () => {
      const { result } = setup()

      act(() => result.current.setRegion('West'))
      act(() => result.current.setSegment('enterprise'))
      act(() => result.current.setCategory('Cloud Infrastructure'))

      expect(result.current.filters.region).toBe('West')
      expect(result.current.filters.segment).toBe('enterprise')
      expect(result.current.filters.category).toBe('Cloud Infrastructure')

      act(() => result.current.setRegion(undefined))
      expect(result.current.filters.region).toBeUndefined()
      expect(result.current.filters.segment).toBe('enterprise')
    })

    it('changing a dimension leaves the date range alone', () => {
      const { result } = setup()
      const before = result.current.filters.dateRange
      act(() => result.current.setRegion('East'))
      expect(result.current.filters.dateRange).toEqual(before)
    })
  })

  it('setDateRange replaces the range wholesale', () => {
    const { result } = setup()
    const custom = {
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      preset: 'custom' as const,
    }
    act(() => result.current.setDateRange(custom))
    expect(result.current.filters.dateRange).toEqual(custom)
  })

  it('resetFilters restores every default', () => {
    const { result } = setup()
    act(() => {
      result.current.setRegion('West')
      result.current.setSegment('smb')
      result.current.setDatePreset('last7d')
    })
    act(() => result.current.resetFilters())

    expect(result.current.filters.region).toBeUndefined()
    expect(result.current.filters.segment).toBeUndefined()
    expect(result.current.filters.dateRange.preset).toBe('last90d')
  })
})
