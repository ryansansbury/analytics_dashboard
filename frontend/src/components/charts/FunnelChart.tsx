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

  const formatDisplayValue = (value: number) => {
    return formatValue === 'currency' ? formatCurrency(value, true) : formatNumber(value, true);
  };

  return (
    <div className="space-y-3" style={{ minHeight: height }}>
      {data.map((stage, index) => {
        const widthPercent = (stage.value / maxValue) * 100;
        const prevStage = index > 0 ? data[index - 1] : null;
        const conversionRate = prevStage
          ? ((stage.count / prevStage.count) * 100).toFixed(1)
          : '100';

        return (
          <div key={stage.stage} className="relative">
            {/* Stage Label */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-300">{stage.stage}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-white tabular-nums">
                  {formatDisplayValue(stage.value)}
                </span>
                <span className="text-xs text-gray-400 tabular-nums">
                  {stage.count.toLocaleString()} deals
                </span>
              </div>
            </div>

            {/* Bar */}
            <div className="relative h-10 bg-gray-800 rounded-lg overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-lg transition-all duration-500 ease-out"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                }}
              />

              {/* Percentage label inside bar */}
              <div
                className="absolute inset-0 flex items-center px-3"
                style={{ width: `${widthPercent}%` }}
              >
                {widthPercent > 15 && (
                  <span className="text-xs font-medium text-white">
                    {widthPercent.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>

            {/* Conversion Arrow */}
            {showConversion && index > 0 && (
              <div className="absolute -top-5 right-0 flex items-center gap-1 text-xs">
                <span className="text-gray-500">↓</span>
                <span className="text-primary-400 font-medium">{conversionRate}%</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
