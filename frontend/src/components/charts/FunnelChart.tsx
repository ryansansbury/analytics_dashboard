import { formatCurrency, formatNumber, CHART_COLORS } from '../../utils/formatters';

interface FunnelStage {
  stage: string;
  value: number;
  count: number;
  conversionRate?: number;
}

interface FunnelChartProps {
  data: FunnelStage[];
  height?: number;
  formatValue?: 'currency' | 'number';
}

export function FunnelChart({
  data,
  formatValue = 'currency',
}: FunnelChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const totalValue = data.reduce((sum, d) => sum + d.value, 0);

  const formatDisplayValue = (value: number) => {
    return formatValue === 'currency' ? formatCurrency(value, true) : formatNumber(value, true);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Funnel stages - flex to fill available space */}
      <div className="flex-1 flex flex-col justify-between min-h-0">
        {data.map((stage, index) => {
          const widthPercent = (stage.value / maxValue) * 100;
          const pipelinePercent = totalValue > 0 ? ((stage.value / totalValue) * 100).toFixed(0) : 0;

          return (
            <div key={stage.stage} className="group flex-1 flex flex-col justify-center min-h-0">
              {/* Stats Row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  />
                  <span className="text-xs font-medium text-gray-300">
                    {stage.stage}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-xs font-semibold text-white tabular-nums">
                    {formatDisplayValue(stage.value)}
                  </span>
                  <span className="text-xs text-gray-400 tabular-nums">
                    {stage.count.toLocaleString()} deals
                  </span>
                </div>
              </div>

              {/* Bar with percentage inside */}
              <div className="relative h-6 bg-gray-800 rounded overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded transition-all duration-500 ease-out group-hover:opacity-90 flex items-center"
                  style={{
                    width: `${Math.max(widthPercent, 8)}%`,
                    backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                  }}
                >
                  <span className="ml-2 text-xs font-semibold text-white drop-shadow-sm">
                    {pipelinePercent}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
