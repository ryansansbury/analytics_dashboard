/**
 * A fixed colour for every named entity the dashboard draws.
 *
 * Colour follows the entity, never its rank. Endpoints return keys largest
 * first, and the order shifts with the date filter: Data Analytics overtakes
 * Enterprise Software partway through the second year. Assigning slots by
 * position would repaint both of them the moment the filter crossed that
 * point, and a reader who learned "blue is Security" would be misled. So each
 * dimension lists its members once, here, and a member's slot is its place in
 * that list.
 */

import { getChartColor } from './formatters';

const ORDER = {
  category: [
    'Security Solutions',
    'Data Analytics',
    'Enterprise Software',
    'Cloud Infrastructure',
    'Professional Services',
    'Integration Platform',
    'Support & Maintenance',
    'Development Tools',
  ],
  region: ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'],
  acquisition: ['Direct Sales', 'Referral', 'Organic Search', 'Paid Ads', 'Events'],
  channel: ['direct', 'partner', 'online'],
  segment: ['enterprise', 'mid-market', 'smb'],
  team: ['Enterprise', 'Mid-Market', 'SMB'],
} as const;

export type Dimension = keyof typeof ORDER;

/** "Other" and anything unlisted share the muted ink, never a ninth hue. */
export const OTHER_COLOR = 'var(--color-ink-muted)';

export function colorFor(dimension: Dimension, key: string): string {
  const index = (ORDER[dimension] as readonly string[]).indexOf(key);
  return index >= 0 ? getChartColor(index) : OTHER_COLOR;
}

export function colorsFor(dimension: Dimension, keys: string[]): string[] {
  return keys.map((k) => colorFor(dimension, k));
}

const LABELS: Record<string, string> = {
  enterprise: 'Enterprise',
  'mid-market': 'Mid-market',
  smb: 'SMB',
  direct: 'Direct',
  partner: 'Partner',
  online: 'Online',
};

/** Display words for the API's lowercase keys. */
export function labelFor(key: string): string {
  return LABELS[key] ?? key;
}
