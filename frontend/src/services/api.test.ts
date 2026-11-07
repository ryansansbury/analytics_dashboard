import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  customerApi,
  dashboardApi,
  forecastingApi,
  healthApi,
  operationsApi,
  revenueApi,
} from './api'

const range = { startDate: '2026-01-01', endDate: '2026-06-30' }

function mockFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const spy = vi.fn().mockResolvedValue({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

function lastUrl(spy: ReturnType<typeof vi.fn>): string {
  return spy.mock.calls.at(-1)![0] as string
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('request construction', () => {
  it('sends JSON content type', async () => {
    const spy = mockFetch({})
    await healthApi.check()
    expect(spy.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    })
  })

  it('encodes the date range into the query string', async () => {
    const spy = mockFetch({})
    await dashboardApi.getSummary(range)
    const url = lastUrl(spy)
    expect(url).toContain('/dashboard/summary?')
    expect(url).toContain('start_date=2026-01-01')
    expect(url).toContain('end_date=2026-06-30')
  })

  it('omits undefined parameters rather than sending the string "undefined"', async () => {
    const spy = mockFetch({})
    await dashboardApi.getSummary({ startDate: undefined, endDate: undefined } as never)
    expect(lastUrl(spy)).not.toContain('undefined')
  })

  it('produces no query string when every parameter is absent', async () => {
    const spy = mockFetch({})
    await dashboardApi.getSummary({} as never)
    expect(lastUrl(spy)).toBe('/api/dashboard/summary')
  })

  it('url-encodes parameter values', async () => {
    const spy = mockFetch({})
    await revenueApi.getComparison({ startDate: 'a b&c', endDate: '2026-01-01' }, 'month')
    const url = lastUrl(spy)
    expect(url).toContain('a%20b%26c')
    expect(url).not.toContain('a b&c')
  })

  it('puts granularity last, the order the snapshot keys on', async () => {
    const spy = mockFetch({})
    await revenueApi.getComparison(range, 'month')
    expect(lastUrl(spy)).toBe(
      '/api/revenue/comparison?start_date=2026-01-01&end_date=2026-06-30&granularity=month',
    )
  })

  it('sends only the end date for views that look back a fixed span', async () => {
    for (const call of [
      () => revenueApi.getCalendar(range),
      () => customerApi.getCohorts(range),
      () => operationsApi.getPipelineFlow(range),
      () => operationsApi.getCycleTime(range),
    ]) {
      const spy = mockFetch({})
      await call()
      expect(lastUrl(spy)).toMatch(/\?end_date=2026-06-30$/)
    }
  })

  it('sends no parameters for views that take no window', async () => {
    let spy = mockFetch([])
    await customerApi.getLifetimeValue()
    expect(lastUrl(spy)).toBe('/api/customers/lifetime-value')
    spy = mockFetch({})
    await customerApi.getRiskValue()
    expect(lastUrl(spy)).toBe('/api/customers/risk-value')
  })

  it('puts limit first on the at-risk list, as the snapshot does', async () => {
    const spy = mockFetch([])
    await customerApi.getAtRisk(range, 10)
    expect(lastUrl(spy)).toBe(
      '/api/customers/at-risk?limit=10&start_date=2026-01-01&end_date=2026-06-30',
    )
  })
})

describe('error handling', () => {
  it('throws with the server-supplied message', async () => {
    mockFetch({ message: 'Database unavailable' }, { ok: false, status: 500 })
    await expect(dashboardApi.getSummary(range)).rejects.toThrow('Database unavailable')
  })

  it('falls back to the status code when the body carries no message', async () => {
    mockFetch({}, { ok: false, status: 404 })
    await expect(dashboardApi.getSummary(range)).rejects.toThrow('404')
  })

  it('survives an error body that is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON')
        },
      })
    )
    // A gateway returning an HTML error page must not surface as a parse crash.
    await expect(dashboardApi.getSummary(range)).rejects.toThrow('An error occurred')
  })

  it('propagates a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(dashboardApi.getSummary(range)).rejects.toThrow('Failed to fetch')
  })
})

describe('response handling', () => {
  it('returns the parsed body', async () => {
    const payload = { kpis: { revenue: 1000 } }
    mockFetch(payload)
    await expect(dashboardApi.getSummary(range)).resolves.toEqual(payload)
  })

  it('returns arrays intact', async () => {
    mockFetch([{ category: 'Security Solutions', value: 5, percentage: 100 }])
    await expect(revenueApi.getByCategory(range)).resolves.toHaveLength(1)
  })
})

describe('endpoint paths', () => {
  const cases: Array<[string, () => Promise<unknown>, string]> = [
    ['dashboard summary', () => dashboardApi.getSummary(range), '/dashboard/summary'],
    ['revenue comparison', () => revenueApi.getComparison(range, 'week'), '/revenue/comparison'],
    ['category trends', () => revenueApi.getCategoryTrends(range, 'week'), '/revenue/category-trends'],
    ['region trends', () => revenueApi.getRegionTrends(range, 'week'), '/revenue/region-trends'],
    ['order sizes', () => revenueApi.getOrderSizes(range), '/revenue/order-sizes'],
    ['revenue by category', () => revenueApi.getByCategory(range), '/revenue/by-category'],
    ['pipeline kpis', () => operationsApi.getPipelineKpis(range), '/operations/pipeline-kpis'],
    ['pipeline outlook', () => operationsApi.getOutlook(range), '/forecasting/pipeline'],
    ['health', () => healthApi.check(), '/health'],
  ]

  it.each(cases)('%s hits the right path', async (_name, call, path) => {
    const spy = mockFetch({})
    await call()
    expect(lastUrl(spy)).toContain(path)
  })

  it('every exported api namespace is populated', () => {
    for (const api of [
      dashboardApi,
      revenueApi,
      customerApi,
      operationsApi,
      forecastingApi,
      healthApi,
    ]) {
      const fns = Object.values(api).filter((v) => typeof v === 'function')
      expect(fns.length).toBeGreaterThan(0)
    }
  })

  it('all forecasting endpoints sit under /forecasting', async () => {
    for (const [name, fn] of Object.entries(forecastingApi)) {
      if (typeof fn !== 'function') continue
      const spy = mockFetch({})
      await (fn as (r: typeof range) => Promise<unknown>)(range)
      expect(lastUrl(spy), `${name} path`).toContain('/forecasting/')
    }
  })
})
