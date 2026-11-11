/**
 * Does the snapshot actually cover the app?
 *
 * The static demo works only if every request the UI makes has a matching file
 * on disk. The list of requests lives in backend/scripts/snapshot.py, written
 * by hand, so the failure mode is a call site that list forgot: one blank chart
 * in production and nothing anywhere else to notice it.
 *
 * Rather than restate that list here (which would only prove the snapshot
 * matches this file's guess), these tests mount the real pages under every date
 * preset, let the real API layer run, and serve `fetch` from the real snapshot
 * directory. A missing file is a recorded 404 and a failed assertion naming the
 * exact path to add.
 *
 * The suite skips itself when no snapshot has been generated, so a fresh clone
 * still passes `npm test` without a database.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

const DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../public/data');
const HAS_SNAPSHOT = existsSync(join(DATA_DIR, 'manifest.json'));

const PRESETS = ['last7d', 'last30d', 'last90d', 'ytd', 'lastYear'] as const;

/** Requests that came back 404, collected across a render. */
let missing: string[] = [];
/** Every file the app asked for, whether or not it existed. */
let requested = new Set<string>();

/**
 * Serve `fetch` out of the snapshot directory.
 *
 * Assigned directly rather than through `vi.spyOn` because the shared setup
 * file calls `vi.restoreAllMocks()` after every test, which would strip a spy
 * and leave later renders hitting the real network.
 */
function installFetch() {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const name = String(input).replace(/^.*\/data\//, '');
    requested.add(name);
    const file = join(DATA_DIR, name);
    if (!existsSync(file)) {
      missing.push(name);
      return new Response('{}', { status: 404 });
    }
    return new Response(readFileSync(file, 'utf8'), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

// Loaded after the env stub so every module evaluates in static mode.
/* eslint-disable @typescript-eslint/no-explicit-any */
let mod: {
  slugify: (p: string) => string;
  today: () => Date;
  loadManifest: () => Promise<any>;
  setManifest: (m: any) => void;
  IS_STATIC: boolean;
};
let filters: {
  FilterProvider: any;
  useFilters: () => any;
  getDateRangeFromPreset: (p: any) => any;
};
let pages: Record<string, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

beforeAll(async () => {
  vi.stubEnv('VITE_STATIC_DATA', 'true');
  vi.resetModules();
  mod = await import('./staticData');
  filters = await import('../hooks/useFilters');
  pages = {
    Dashboard: (await import('../pages/Dashboard')).Dashboard,
    Revenue: (await import('../pages/Revenue')).Revenue,
    Customers: (await import('../pages/Customers')).Customers,
    Operations: (await import('../pages/Operations')).Operations,
    Forecasting: (await import('../pages/Forecasting')).Forecasting,
  };
  installFetch();
  if (HAS_SNAPSHOT) await mod.loadManifest();
});

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  missing = [];
  requested = new Set();
  installFetch();
});

describe('slug parity with the generator', () => {
  it('matches the Python slugify for representative paths', () => {
    // Change either side and both must change. These are the shapes that
    // actually occur: query strings, repeated separators, no query at all.
    const cases: [string, string][] = [
      ['/api/health', 'api-health'],
      ['/api/dashboard/summary?start_date=2026-05-11&end_date=2026-08-09',
        'api-dashboard-summary-start-date-2026-05-11-end-date-2026-08-09'],
      ['/api/revenue/trends?start_date=2026-01-01&end_date=2026-08-09&granularity=month',
        'api-revenue-trends-start-date-2026-01-01-end-date-2026-08-09-granularity-month'],
      ['/api/operations/conversion-rates', 'api-operations-conversion-rates'],
    ];
    for (const [path, slug] of cases) {
      expect(mod.slugify(path)).toBe(slug);
    }
  });

  it('collapses runs of separators and trims the edges', () => {
    expect(mod.slugify('//api//x??y//')).toBe('api-x-y');
  });

  it('never returns an empty filename', () => {
    expect(mod.slugify('///')).toBe('index');
  });
});

describe('the frozen clock', () => {
  it.runIf(HAS_SNAPSHOT)('reports the snapshot date, not the real one', () => {
    const manifest = JSON.parse(readFileSync(join(DATA_DIR, 'manifest.json'), 'utf8'));
    const frozen = mod.today();
    const [y, m, d] = manifest.snapshotDate.split('-').map(Number);
    expect([frozen.getFullYear(), frozen.getMonth() + 1, frozen.getDate()]).toEqual([y, m, d]);
  });

  it.runIf(HAS_SNAPSHOT)('parses the date locally so no timezone shifts it', () => {
    // `new Date('2026-08-09')` is UTC midnight, which is the 8th in any
    // western zone. That would shift every preset by a day and miss the
    // snapshot wholesale, and only for users west of Greenwich.
    const manifest = JSON.parse(readFileSync(join(DATA_DIR, 'manifest.json'), 'utf8'));
    expect(mod.today().toISOString().slice(0, 10) >= manifest.snapshotDate).toBe(true);
  });

  it.runIf(HAS_SNAPSHOT)('resolves presets to exactly the windows the snapshot holds', () => {
    const manifest = JSON.parse(readFileSync(join(DATA_DIR, 'manifest.json'), 'utf8'));
    for (const preset of PRESETS) {
      const range = filters.getDateRangeFromPreset(preset);
      expect(range, preset).toMatchObject({
        startDate: manifest.presets[preset].startDate,
        endDate: manifest.presets[preset].endDate,
      });
    }
  });

  it('falls back to the real clock when no manifest is loaded', () => {
    mod.setManifest(null);
    expect(Math.abs(mod.today().getTime() - Date.now())).toBeLessThan(5000);
    if (HAS_SNAPSHOT) {
      mod.setManifest(JSON.parse(readFileSync(join(DATA_DIR, 'manifest.json'), 'utf8')));
    }
  });
});

/** Mounts a page with the given preset already applied. */
function Harness({ preset, children }: { preset: string; children: React.ReactNode }) {
  const { setDatePreset } = filters.useFilters();
  useEffect(() => {
    setDatePreset(preset);
  }, [preset, setDatePreset]);
  return <>{children}</>;
}

describe.runIf(HAS_SNAPSHOT)('snapshot covers every request the pages make', () => {
  for (const preset of PRESETS) {
    for (const name of ['Dashboard', 'Revenue', 'Customers', 'Operations', 'Forecasting']) {
      it(`${name} under ${preset}`, async () => {
        const Page = pages[name];
        const client = new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
        });

        render(
          <QueryClientProvider client={client}>
            <filters.FilterProvider>
              <MemoryRouter>
                <Harness preset={preset}>
                  <Page />
                </Harness>
              </MemoryRouter>
            </filters.FilterProvider>
          </QueryClientProvider>
        );

        await waitFor(() => expect(requested.size).toBeGreaterThan(0));
        await waitFor(
          () => expect(client.isFetching()).toBe(0),
          { timeout: 10000 }
        );

        expect(
          missing,
          `${name}/${preset} requested files the snapshot does not contain. ` +
            'Add the matching paths to endpoints_for() in backend/scripts/snapshot.py.'
        ).toEqual([]);
      });
    }
  }
});
