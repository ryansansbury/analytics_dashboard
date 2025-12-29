import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { currencyAxisFormatter, formatCurrency, formatDateShort } from '../../utils/formatters';
import { CHART_COLORS } from '../../utils/formatters';

interface AreaChartProps<T> {
  data: T[];
  xKey: keyof T;
  yKeys: (keyof T)[];
  labels?: Record<string, string>;
  colors?: string[];
  height?: number | '100%';
  showGrid?: boolean;
  showLegend?: boolean;
  formatY?: 'currency' | 'number' | 'percent';
  stacked?: boolean;
  gradient?: boolean;
  dashedKeys?: (keyof T)[];
}

export function AreaChart<T extends Record<string, unknown>>({
  data,
  xKey,
  yKeys,
  labels = {},
  colors = CHART_COLORS,
  height = '100%',
  showGrid = true,
  showLegend = false,
  formatY = 'currency',
  stacked = false,
  gradient = true,
  dashedKeys = [],
}: AreaChartProps<T>) {
  const formatYAxis = formatY === 'currency' ? currencyAxisFormatter : (v: number) => v.toLocaleString();
  const formatTooltip = formatY === 'currency' ? formatCurrency : (v: number) => v.toLocaleString();

  // Calculate interval for X-axis labels to prevent overlap
  // Show fewer labels when there are many data points
  const xAxisInterval = data.length > 20 ? Math.ceil(data.length / 10) - 1 : 0;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <defs>
          {yKeys.map((key, index) => (
            <linearGradient
              key={String(key)}
              id={`gradient-${String(key)}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor={colors[index % colors.length]}
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor={colors[index % colors.length]}
                stopOpacity={0}
              />
            </linearGradient>
          ))}
        </defs>

        {showGrid && (
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
        )}

        <XAxis
          dataKey={String(xKey)}
          stroke="#6B7280"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatDateShort(value)}
          interval={xAxisInterval}
        />

        <YAxis
          stroke="#6B7280"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatYAxis}
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
          formatter={(value, name) => [
            formatTooltip(Number(value) || 0),
            labels[String(name)] || String(name),
          ]}
          labelFormatter={(label) => formatDateShort(String(label))}
        />

        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
            formatter={(value) => labels[value] || value}
          />
        )}

        {yKeys.map((key, index) => (
          <Area
            key={String(key)}
            type="monotone"
            dataKey={String(key)}
            stackId={stacked ? 'stack' : undefined}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            strokeDasharray={dashedKeys.includes(key) ? '5 5' : undefined}
            fill={gradient ? `url(#gradient-${String(key)})` : colors[index % colors.length]}
            fillOpacity={gradient ? 1 : 0.1}
          />
        ))}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
