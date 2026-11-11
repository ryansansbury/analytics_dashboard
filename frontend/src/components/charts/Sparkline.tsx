/**
 * A trend line with no axes, for the KPI tiles.
 *
 * Plain SVG rather than Recharts: a tile holds four of these, and a full chart
 * per tile is a lot of machinery for one path. The path is drawn in a 100-wide
 * box stretched to the tile, with a non-scaling stroke so the line stays a
 * crisp 1.5px whatever the tile's width. Null points break the line instead of
 * dropping to zero.
 */

interface SparklineProps {
  values: (number | null)[];
  height?: number;
  color?: string;
  /** Read out by screen readers, since the line itself says nothing to them. */
  label?: string;
}

export function Sparkline({ values, height = 32, color = 'var(--color-chart-1)', label }: SparklineProps) {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (present.length < 2) {
    return <div style={{ height }} aria-hidden="true" />;
  }

  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;
  const pad = 2;
  const x = (i: number) => (values.length === 1 ? 50 : (i * 100) / (values.length - 1));
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - min) / span);

  // Separate runs at each null so a gap reads as missing, not as a plunge.
  const runs: string[] = [];
  let current = '';
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) {
      if (current) runs.push(current);
      current = '';
      return;
    }
    current += `${current ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`;
  });
  if (current) runs.push(current);

  const first = values.findIndex((v) => v != null);
  const last = values.length - 1 - [...values].reverse().findIndex((v) => v != null);
  const area = `${runs.join('')}L${x(last).toFixed(2)},${height}L${x(first).toFixed(2)},${height}Z`;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="block overflow-visible"
    >
      {runs.length === 1 && <path d={area} fill={color} fillOpacity={0.12} stroke="none" />}
      {runs.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
