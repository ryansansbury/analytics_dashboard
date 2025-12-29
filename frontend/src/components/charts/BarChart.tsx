import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { currencyAxisFormatter, formatCurrency, numberAxisFormatter } from '../../utils/formatters';
import { CHART_COLORS } from '../../utils/formatters';

interface BarChartProps<T> {
  data: T[];
  xKey: keyof T;
  yKeys: (keyof T)[];
  labels?: Record<string, string>;
  colors?: string[];
  height?: number | '100%';
  showGrid?: boolean;
  showLegend?: boolean;
  formatY?: 'currency' | 'number' | 'percent';
  horizontal?: boolean;
  stacked?: boolean;
  colorByValue?: boolean;
  angledLabels?: boolean;
}

export function BarChart<T extends Record<string, unknown>>({
  data,
  xKey,
  yKeys,
  labels = {},
  colors = CHART_COLORS,
  height = '100%',
  showGrid = true,
  showLegend = false,
  formatY = 'currency',
  horizontal = false,
  stacked = false,
  colorByValue = false,
  angledLabels = false,
}: BarChartProps<T>) {
  const formatAxis = formatY === 'currency' ? currencyAxisFormatter : numberAxisFormatter;
  const formatTooltip = formatY === 'currency' ? formatCurrency : (v: number) => v.toLocaleString();

  const ChartComponent = horizontal ? (
    <RechartsBarChart
      data={data}
      layout="vertical"
      margin={{ top: 0, right: 0, left: 50, bottom: 0 }}
    >
      {showGrid && (
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
      )}

      <XAxis
        type="number"
        stroke="#6B7280"
        fontSize={12}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatAxis}
      />

      <YAxis
        type="category"
        dataKey={String(xKey)}
        stroke="#6B7280"
        fontSize={12}
        tickLine={false}
        axisLine={false}
        width={70}
      />

      <Tooltip
        contentStyle={{
          backgroundColor: '#1F2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          fontSize: '12px',
        }}
        labelStyle={{ color: '#9CA3AF' }}
        cursor={false}
        formatter={(value, name) => [
          formatTooltip(Number(value) || 0),
          labels[String(name)] || String(name),
        ]}
      />

      {showLegend && (
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
          formatter={(value) => labels[value] || value}
        />
      )}

      {yKeys.map((key, index) => (
        <Bar
          key={String(key)}
          dataKey={String(key)}
          stackId={stacked ? 'stack' : undefined}
          fill={colors[index % colors.length]}
          radius={[0, 4, 4, 0]}
        >
          {colorByValue &&
            data.map((_, i) => (
              <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />
            ))}
        </Bar>
      ))}
    </RechartsBarChart>
  ) : (
    <RechartsBarChart
      data={data}
      margin={{ top: 0, right: 0, left: 0, bottom: angledLabels ? 60 : 0 }}
    >
      {showGrid && (
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
      )}

      <XAxis
        dataKey={String(xKey)}
        stroke="#6B7280"
        fontSize={10}
        tickLine={false}
        axisLine={false}
        angle={angledLabels ? -45 : 0}
        textAnchor={angledLabels ? 'end' : 'middle'}
        height={angledLabels ? 80 : 30}
        interval={0}
      />

      <YAxis
        stroke="#6B7280"
        fontSize={12}
        tickLine={false}
        axisLine={false}
        tickFormatter={formatAxis}
        width={60}
      />

      <Tooltip
        contentStyle={{
          backgroundColor: '#1F2937',
          border: '1px solid #374151',
          borderRadius: '8px',
          fontSize: '12px',
        }}
        labelStyle={{ color: '#9CA3AF' }}
        cursor={false}
        formatter={(value, name) => [
          formatTooltip(Number(value) || 0),
          labels[String(name)] || String(name),
        ]}
      />

      {showLegend && (
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
          formatter={(value) => labels[value] || value}
        />
      )}

      {yKeys.map((key, index) => (
        <Bar
          key={String(key)}
          dataKey={String(key)}
          stackId={stacked ? 'stack' : undefined}
          fill={colors[index % colors.length]}
          radius={[4, 4, 0, 0]}
        >
          {colorByValue &&
            data.map((_, i) => (
              <Cell key={`cell-${i}`} fill={colors[i % colors.length]} />
            ))}
        </Bar>
      ))}
    </RechartsBarChart>
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      {ChartComponent}
    </ResponsiveContainer>
  );
}
