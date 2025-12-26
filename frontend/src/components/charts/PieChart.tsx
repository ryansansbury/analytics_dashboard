import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency, formatPercentValue } from '../../utils/formatters';
import { CHART_COLORS } from '../../utils/formatters';

interface PieChartProps<T> {
  data: T[];
  nameKey: keyof T;
  valueKey: keyof T;
  colors?: string[];
  height?: number;
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
  height = 300,
  showLegend = true,
  showLabels = false,
  innerRadius = 0,
  formatValue = 'currency',
}: PieChartProps<T>) {
  // Sort data by value descending for consistent display
  const sortedData = [...data].sort((a, b) =>
    (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0)
  );

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
    <ResponsiveContainer width="100%" height={height}>
      <RechartsPieChart>
        <Pie
          data={sortedData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={showLabels ? renderLabel : undefined}
          innerRadius={innerRadius}
          outerRadius="80%"
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

        {showLegend && (
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            wrapperStyle={{ fontSize: '12px', paddingLeft: '20px' }}
            formatter={(value) => {
              const item = sortedData.find((d) => d[nameKey] === value);
              const itemValue = item ? Number(item[valueKey]) : 0;
              const percentage = ((itemValue / total) * 100).toFixed(1);
              return (
                <span className="text-gray-300">
                  {value} ({percentage}%)
                </span>
              );
            }}
          />
        )}
      </RechartsPieChart>
    </ResponsiveContainer>
  );
}

// Donut chart is just a pie chart with innerRadius and always shows labels
// innerRadius=25 gives ~50% more colored area compared to innerRadius=35
export function DonutChart<T extends Record<string, unknown>>(
  props: Omit<PieChartProps<T>, 'innerRadius' | 'showLabels'>
) {
  return <PieChart {...props} innerRadius={25} showLabels />;
}
