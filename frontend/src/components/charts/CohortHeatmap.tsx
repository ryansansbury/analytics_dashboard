/**
 * Retention by first-purchase cohort, as a triangle of shaded cells.
 *
 * Each row is the customers whose first order fell in that month; each column
 * is months since. Month 0 is 100% by definition, so it's printed but left
 * unshaded, where shading it would spend the darkest step on a value that
 * carries no information. Cells a cohort hasn't reached yet are empty rather
 * than zero, which is what makes the triangle.
 */

import type { Cohort } from '../../types';
import { heatColor, heatInk, heatStep } from './heat';

/** Retention bands: under 45, 45 to 55, 55 to 65, 65 to 75, 75 to 85, 85 and up. */
const THRESHOLDS = [45, 55, 65, 75, 85];

export function CohortHeatmap({ cohorts }: { cohorts: Cohort[] }) {
  const months = Math.max(0, ...cohorts.map((c) => c.retention.length));

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[560px] border-separate text-[11px] tabular-nums" style={{ borderSpacing: 2 }}>
          <caption className="sr-only">
            Share of each monthly cohort that placed an order in each month after their first
          </caption>
          <thead>
            <tr className="text-gray-500">
              <th scope="col" className="px-1 py-1 text-left font-medium">Cohort</th>
              <th scope="col" className="px-1 py-1 text-right font-medium">Size</th>
              {Array.from({ length: months }, (_, m) => (
                <th key={m} scope="col" className="px-0.5 py-1 text-center font-medium">
                  {m === 0 ? 'M0' : `M${m}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => (
              <tr key={cohort.cohort}>
                <th scope="row" className="whitespace-nowrap px-1 text-left font-medium text-gray-300">
                  {cohort.label}
                </th>
                <td className="px-1 text-right text-gray-500">{cohort.size}</td>
                {cohort.retention.map((value, m) => {
                  if (value == null) {
                    return <td key={m} aria-label="Not reached yet" />;
                  }
                  if (m === 0) {
                    return (
                      <td key={m} className="rounded-sm border border-gray-800 py-1 text-center text-gray-500">
                        100
                      </td>
                    );
                  }
                  const step = heatStep(value, THRESHOLDS);
                  return (
                    <td
                      key={m}
                      className="rounded-sm py-1 text-center font-medium"
                      style={{ background: heatColor(step), color: heatInk(step) }}
                      title={`${cohort.label} cohort, month ${m}: ${value.toFixed(1)}% ordered`}
                    >
                      {Math.round(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <HeatLegend labels={['Under 45%', '85% and up']} />
    </div>
  );
}

export function HeatLegend({ labels }: { labels: [string, string] }) {
  return (
    <div className="flex items-center justify-end gap-2 text-[11px] text-gray-500" aria-hidden="true">
      <span>{labels[0]}</span>
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <span key={s} className="h-2.5 w-4 rounded-sm" style={{ background: heatColor(s) }} />
        ))}
      </span>
      <span>{labels[1]}</span>
    </div>
  );
}
