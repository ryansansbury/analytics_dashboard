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
  showConversion?: boolean;
}

export function FunnelChart({
  data,
  height = 300,
  formatValue = 'currency',
  showConversion = true,
}: FunnelChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const maxCount = data.length > 0 ? data[0].count : 1;

  const formatDisplayValue = (value: number) => {
    return formatValue === 'currency' ? formatCurrency(value, true) : formatNumber(value, true);
  };

  return (
    <div className="space-y-4" style={{ minHeight: height }}>
      {data.map((stage, index) => {
        const widthPercent = (stage.value / maxValue) * 100;
        const prevStage = index > 0 ? data[index - 1] : null;
        const stageConversion = prevStage
          ? ((stage.count / prevStage.count) * 100).toFixed(0)
          : null;

        return (
          <div key={stage.stage} className="group">
            {/* Stats Row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                />
                <span className="text-sm font-medium text-gray-300 truncate">
                  {stage.stage}
                </span>
              </div>
              <div className="flex items-center gap-4 text-right">
                <span className="text-sm font-semibold text-white tabular-nums min-w-[80px]">
                  {formatDisplayValue(stage.value)}
                </span>
                <span className="text-xs text-gray-400 tabular-nums min-w-[70px]">
                  {stage.count.toLocaleString()} deals
                </span>
                {showConversion && (
                  <span className="text-xs tabular-nums min-w-[50px]">
                    {index === 0 ? (
                      <span className="text-gray-500">-</span>
                    ) : (
                      <span className="text-primary-400 font-medium">
                        {stageConversion}%
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Bar */}
            <div className="relative h-8 bg-gray-800 rounded-md overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-md transition-all duration-500 ease-out group-hover:opacity-90"
                style={{
                  width: `${Math.max(widthPercent, 2)}%`,
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />
            </div>
          </div>
        );
      })}

      {/* Legend */}
      {showConversion && data.length > 1 && (
        <div className="pt-2 mt-2 border-t border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Stage-to-stage conversion rate shown in last column</span>
            <span>
              Overall: {((data[data.length - 1]?.count / maxCount) * 100).toFixed(1)}% win rate
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
