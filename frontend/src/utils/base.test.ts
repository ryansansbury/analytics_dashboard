import { describe, expect, it } from 'vitest'
import { routerBasename } from './base'

describe('routerBasename', () => {
  it('drops the trailing slash Vite puts on a folder base', () => {
    expect(routerBasename('/analytics-dashboard/')).toBe('/analytics-dashboard')
  })

  it('keeps the root as a single slash', () => {
    expect(routerBasename('/')).toBe('/')
    expect(routerBasename(undefined)).toBe('/')
  })
})
