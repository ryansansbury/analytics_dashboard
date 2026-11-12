/**
 * Where a year of new deals went, stage by stage.
 *
 * Each band is a count of deals, so its width at any point is how many were
 * still moving. The stages use the ordinal ramp because they are ordered;
 * the three outcomes use the status colours because they are states, and each
 * is named on the chart so none of it rests on colour.
 *
 * This replaced a funnel built from how many deals currently sat in each
 * stage, which isn't a funnel: closed deals don't sit in any stage, so the
 * shape said nothing about conversion.
 */

import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import type { PipelineFlow } from '../../types';
import { formatCurrency, getOrdinalColor } from '../../utils/formatters';
import { TooltipBox } from './chrome';
import { usePhone } from '../../hooks/useNarrow';

const OUTCOME_COLORS: Record<string, string> = {
  Won: 'var(--color-status-good)',
  Lost: 'var(--color-status-critical)',
  Open: 'var(--color-ink-muted)',
};

function nodeColor(name: string, index: number): string {
  return OUTCOME_COLORS[name] ?? getOrdinalColor(index, 4);
}

interface NodeProps {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: { name: string; value: number; sourceLinks?: unknown[] };
}

interface LinkProps {
  sourceX: number;
  targetX: number;
  sourceY: number;
  targetY: number;
  sourceControlX: number;
  targetControlX: number;
  linkWidth: number;
  index: number;
  payload: { source: { name: string }; target: { name: string; index?: number }; value: number };
}

export function SankeyChart({ flow, height = '100%' }: { flow: PipelineFlow; height?: number | '100%' }) {
  const names = flow.nodes.map((n) => n.name);
  const amounts = new Map(flow.links.map((l) => [`${l.source}-${l.target}`, l.amount]));
  // Each stage's deal count a size up on a phone.
  const phone = usePhone();

  const renderNode = (props: NodeProps) => {
    const { x, y, width, height: h, index, payload } = props;
    const color = nodeColor(payload.name, index);
    const isOutcome = payload.name in OUTCOME_COLORS;
    const labelX = isOutcome ? x + width + 8 : x + width + 6;
    return (
      <g>
        <rect x={x} y={y} width={width} height={Math.max(h, 1)} fill={color} rx={2} />
        <text
          x={labelX}
          y={y + h / 2}
          dy={-1}
          fontSize={11}
          fontWeight={600}
          fill="var(--color-ink)"
          stroke="var(--color-surface)"
          strokeWidth={3}
          paintOrder="stroke"
          dominantBaseline="middle"
        >
          {payload.name}
        </text>
        <text
          x={labelX}
          y={y + h / 2}
          dy={12}
          fontSize={phone ? 11 : 10}
          fill="var(--color-ink-muted)"
          stroke="var(--color-surface)"
          strokeWidth={3}
          paintOrder="stroke"
          dominantBaseline="middle"
        >
          {payload.value.toLocaleString()} deals
        </text>
      </g>
    );
  };

  const renderLink = (props: LinkProps) => {
    const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload } = props;
    const target = payload.target.name;
    const color = nodeColor(target, names.indexOf(target));
    return (
      <path
        d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={color}
        strokeOpacity={target === 'Lost' ? 0.22 : 0.38}
        strokeWidth={Math.max(linkWidth, 1)}
        className="transition-[stroke-opacity] hover:[stroke-opacity:0.65]"
      />
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Sankey
        data={flow}
        node={renderNode as never}
        link={renderLink as never}
        nodeWidth={10}
        nodePadding={22}
        iterations={64}
        sort={false}
        margin={{ top: 12, right: 92, bottom: 12, left: 4 }}
      >
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0].payload as {
              payload?: { source?: { name: string; index?: number }; target?: { name: string; index?: number }; value: number; name?: string };
            };
            const data = item.payload ?? (item as never);
            if (data.source && data.target) {
              const key = `${names.indexOf(data.source.name)}-${names.indexOf(data.target.name)}`;
              const amount = amounts.get(key);
              return (
                <TooltipBox
                  title={`${data.source.name} to ${data.target.name}`}
                  rows={[
                    { name: 'Deals', value: data.value.toLocaleString(), color: nodeColor(data.target.name, names.indexOf(data.target.name)) },
                    ...(amount != null ? [{ name: 'Deal value', value: formatCurrency(amount, true) }] : []),
                  ]}
                />
              );
            }
            return (
              <TooltipBox
                title={data.name}
                rows={[{ name: 'Deals', value: data.value.toLocaleString() }]}
              />
            );
          }}
        />
      </Sankey>
    </ResponsiveContainer>
  );
}
