import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// Recharts measures its container with ResizeObserver, which jsdom does not
// implement. Without this every chart renders at zero size and its children
// never mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverStub as never)

// This jsdom build exposes no localStorage, so anything reading a persisted
// preference throws on mount. Only page-level tests reach that code, which is
// why it went unnoticed until the first one existed.
if (!globalThis.localStorage) {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
}

// jsdom has no layout engine, so getBoundingClientRect returns all zeros.
// Give charts a non-zero box so ResponsiveContainer renders.
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value() {
    return { width: 800, height: 400, top: 0, left: 0, bottom: 400, right: 800, x: 0, y: 0, toJSON: () => {} }
  },
})
