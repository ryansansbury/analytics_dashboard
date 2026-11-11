/**
 * Static data adapter for the public demo.
 *
 * The application is a normal Flask + PostgreSQL service and still runs that
 * way. The hosted demo is a build artifact of it: `backend/scripts/snapshot.py`
 * runs the real pipeline against a real database, trains the real models, and
 * freezes every API response to JSON. This module serves those files in place
 * of the network.
 *
 * The one hard problem is time. "Last 90 days" resolves against today's date,
 * so a snapshot taken on the 9th stops matching on the 10th and every request
 * misses. Rather than key the snapshot on presets and translate, this freezes
 * the clock: in static mode `today()` returns the date the snapshot was taken,
 * every preset resolves exactly as it did at build time, and the request path
 * can be used directly as the cache key with nothing in between to drift.
 *
 * Set VITE_STATIC_DATA=true to enable. Unset, every import here is inert and
 * the app talks to the API.
 */

export const IS_STATIC = import.meta.env.VITE_STATIC_DATA === 'true';

/** Where the snapshot lives, honouring a non-root deployment base. */
const DATA_BASE = `${import.meta.env.BASE_URL ?? '/'}data`.replace(/\/{2,}/g, '/');

export interface SnapshotManifest {
  /** The date the snapshot was taken. Static mode treats this as "today". */
  snapshotDate: string;
  generatedAt: string;
  presets: Record<string, { startDate: string; endDate: string; granularity: string }>;
  /** Request path to filename, for diagnostics. The slug is recomputed, not read. */
  files: Record<string, string>;
}

let manifest: SnapshotManifest | null = null;

/**
 * Filename for a request path.
 *
 * Must produce the same result as `slugify` in backend/scripts/snapshot.py.
 * Kept as a plain character substitution rather than a hash so a mismatch is
 * legible in the network tab instead of opaque.
 */
export function slugify(path: string): string {
  const slug = path
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || 'index';
}

/**
 * Load the snapshot manifest. Call once before rendering: `today()` depends on
 * it, and a render that beats it would resolve presets against the wrong date.
 */
export async function loadManifest(): Promise<SnapshotManifest> {
  if (manifest) return manifest;

  const response = await fetch(`${DATA_BASE}/manifest.json`);
  if (!response.ok) {
    throw new Error(
      `Static mode is on but ${DATA_BASE}/manifest.json is missing (${response.status}). ` +
        'Run `python backend/scripts/snapshot.py` to generate it.'
    );
  }
  manifest = (await response.json()) as SnapshotManifest;
  return manifest;
}

/** Test seam. Lets a test supply a manifest without a network round trip. */
export function setManifest(next: SnapshotManifest | null): void {
  manifest = next;
}

export function getManifest(): SnapshotManifest | null {
  return manifest;
}

/**
 * The date the app should treat as today.
 *
 * Live: the actual date. Static: the date the snapshot was taken, so that every
 * preset resolves to the window the snapshot actually contains.
 */
export function today(): Date {
  if (IS_STATIC && manifest) {
    // Parsed as local midnight, not UTC. `new Date('2026-08-09')` is UTC and
    // reads as the 8th anywhere west of Greenwich, which would shift every
    // preset by a day and miss the snapshot entirely.
    const [y, m, d] = manifest.snapshotDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

/** Fetch a snapshotted response for a request path such as `/api/revenue/trends?...`. */
export async function fetchStatic<T>(path: string): Promise<T> {
  const response = await fetch(`${DATA_BASE}/${slugify(path)}.json`);
  if (!response.ok) {
    throw new Error(
      `No snapshot for ${path}. Add it to endpoints_for() in ` +
        'backend/scripts/snapshot.py and regenerate.'
    );
  }
  return response.json() as Promise<T>;
}
