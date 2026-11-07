/**
 * Every rep's bookings against their quota for the window, with the target
 * drawn through all of them.
 *
 * The quota is the annual figure prorated to the window's days, so 100% means
 * on pace whatever the filter. Bars are coloured by team, a fixed slot each,
 * and the dashed line at 100% is the reference every bar is read against.
 */

import type { SalesRep } from '../../types';
import { colorFor } from '../../utils/colors';
import { formatCurrency } from '../../utils/formatters';
import { Legend } from './chrome';

const TEAMS = ['Enterprise', 'Mid-Market', 'SMB'];

export function AttainmentBars({ reps }: { reps: SalesRep[] }) {
  const ranked = reps
    .filter((r) => r.attainment != null)
    .sort((a, b) => (b.attainment ?? 0) - (a.attainment ?? 0));
  const scaleMax = Math.max(150, ...ranked.map((r) => Math.ceil((r.attainment ?? 0) / 25) * 25));
  const target = (100 / scaleMax) * 100;
  const atOrAbove = ranked.filter((r) => (r.attainment ?? 0) >= 100).length;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Legend items={TEAMS.map((t) => ({ key: t, label: t, color: colorFor('team', t) }))} />
        <p className="text-xs text-gray-400">
          <span className="font-semibold text-white">{atOrAbove}</span> of {ranked.length} at or above quota
        </p>
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto pr-1">
        <ul className="relative flex flex-col gap-1">
          {ranked.map((rep) => {
            const value = rep.attainment ?? 0;
            const width = Math.min(100, (value / scaleMax) * 100);
            return (
              <li
                key={rep.id}
                className="grid items-center gap-2 text-xs"
                style={{ gridTemplateColumns: 'minmax(96px, 26%) 1fr 44px' }}
                title={`${rep.name}, ${rep.team}, ${rep.region}: ${formatCurrency(rep.achieved, true)} booked against ${formatCurrency(rep.periodQuota, true)}`}
              >
                <span className="truncate text-gray-300">{rep.name}</span>
                <div className="relative h-3.5">
                  <div
                    className="absolute inset-y-0 left-0 rounded-r"
                    style={{ width: `${width}%`, background: colorFor('team', rep.team) }}
                  />
                  <div
                    className="absolute -inset-y-0.5 border-l border-dashed"
                    style={{ left: `${target}%`, borderColor: 'var(--color-ink-secondary)' }}
                    aria-hidden="true"
                  />
                </div>
                <span className="text-right font-semibold tabular-nums text-white">{Math.round(value)}%</span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="text-[11px] text-gray-500">Dashed line marks 100% of the quota prorated to these dates.</p>
    </div>
  );
}
