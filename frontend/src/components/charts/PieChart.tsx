import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency, formatPercentValue } from '../../utils/formatters';
import { CHART_COLORS } from '../../utils/formatters';

interface PieChartProps<T> {
  data: T[];
  nameKey: keyof T;
  valueKey: keyof T;
  colors?: string[];
  height?: number | '100%';
  showLegend?: boolean;
  showLabels?: boolean;
  innerRadius?: number;
  formatValue?: 'currency' | 'number' | 'percent';
}

export function PieChart<T extends Record<string, unknown>>({
  data,
  nameKey,
  valueKey,
  colors = CHART_COLORS,
  height: _height = '100%',
  showLegend = true,
  showLabels = false,
  innerRadius = 0,
  formatValue = 'currency',
}: PieChartProps<T>) {
  void _height; // ResponsiveContainer always uses 100%
  // Sort data by value descending for consistent display
  // Check for percentage field first, otherwise use valueKey
  const sortedData = [...data].sort((a, b) => {
    const aPercentage = Number((a as Record<string, unknown>)['percentage']) || 0;
    const bPercentage = Number((b as Record<string, unknown>)['percentage']) || 0;
    if (aPercentage !== 0 || bPercentage !== 0) {
      return bPercentage - aPercentage;
    }
    return (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0);
  });

  const formatTooltipValue = (value: number) => {
    switch (formatValue) {
      case 'currency':
        return formatCurrency(value);
      case 'percent':
        return formatPercentValue(value);
      default:
        return value.toLocaleString();
    }
  };

  const total = sortedData.reduce((sum, item) => sum + (Number(item[valueKey]) || 0), 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius: ir, outerRadius: or, percent } = props;
    const RADIAN = Math.PI / 180;
    const radius = ir + (or - ir) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={500}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="h-full flex">
      {/* Chart */}
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={sortedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={showLabels ? renderLabel : undefined}
              innerRadius={innerRadius}
              outerRadius="90%"
              paddingAngle={2}
              dataKey={String(valueKey)}
              nameKey={String(nameKey)}
            >
              {sortedData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[index % colors.length]}
                  stroke="transparent"
                />
              ))}
            </Pie>

            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#9CA3AF' }}
              itemStyle={{ color: '#D1D5DB' }}
              formatter={(value, name) => {
                const numValue = Number(value) || 0;
                const percentage = ((numValue / total) * 100).toFixed(1);
                return [
                  `${formatTooltipValue(numValue)} (${percentage}%)`,
                  String(name),
                ];
              }}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>

      {/* Custom Legend - sorted by value descending */}
      {showLegend && (
        <div className="flex flex-col justify-center gap-1 pl-4 pr-2">
          {sortedData.map((item, index) => {
            const itemValue = Number(item[valueKey]) || 0;
            const percentage = ((itemValue / total) * 100).toFixed(1);
            return (
              <div key={String(item[nameKey])} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-xs text-gray-300 whitespace-nowrap leading-tight">
                  {String(item[nameKey])} ({percentage}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Donut chart is just a pie chart with innerRadius and always shows labels
// innerRadius=25 gives ~50% more colored area compared to innerRadius=35
export function DonutChart<T extends Record<string, unknown>>(
  props: Omit<PieChartProps<T>, 'innerRadius' | 'showLabels'>
) {
  return <PieChart {...props} innerRadius={25} showLabels />;
}
