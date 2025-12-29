import { Target, Clock, Trophy, TrendingUp } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { BarChart } from '../components/charts/BarChart';
import { FunnelChart } from '../components/charts/FunnelChart';
import { DonutChart } from '../components/charts/PieChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency } from '../utils/formatters';
import { usePipeline, useSalesPerformance, useCycleTime, usePipelineKpis, useDealSizeDistribution } from '../hooks/useApi';
import { useFilters } from '../hooks/useFilters';

export function Operations() {
  const { filters } = useFilters();

  // Fetch real data from API - all data varies by selected date range
  const { data: pipelineData, isLoading: pipelineLoading } = usePipeline();
  const { data: pipelineKpis, isLoading: kpisLoading } = usePipelineKpis();
  const { data: salesReps, isLoading: salesLoading } = useSalesPerformance();
  const { data: cycleTimeData } = useCycleTime();
  const { data: dealSizeData, isLoading: dealSizeLoading } = useDealSizeDistribution();

  // Transform pipeline data for funnel
  const funnelData = (pipelineData || []).map((item, index, arr) => ({
    stage: item.stage,
    value: item.value,
    count: item.count,
    conversionRate: index === 0 ? 100 : Math.round((item.count / arr[0].count) * 100),
  }));

  // Transform deal size data for histogram
  const dealSizeDistribution = (dealSizeData || []).map(item => ({
    bucket: item.bucket,
    count: item.count,
  }));

  // Use cycle time from API
  const cycleData = cycleTimeData || [
    { stage: 'Lead to Qualified', avgDays: 8 },
    { stage: 'Qualified to Proposal', avgDays: 12 },
    { stage: 'Proposal to Negotiation', avgDays: 15 },
    { stage: 'Negotiation to Close', avgDays: 7 },
  ];

  // Transform sales reps data (take top 20)
  const salesRepsData = (salesReps || []).slice(0, 20).map(rep => ({
    id: rep.id,
    name: rep.name,
    team: rep.team,
    region: rep.region,
    quota: rep.quota,
    achieved: rep.achieved,
    deals: rep.deals,
    attainment: rep.attainment,
  }));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Header
        title="Operations"
        subtitle={`${filters.dateRange.startDate} to ${filters.dateRange.endDate}`}
      />

      {/* Content area with fixed row heights */}
      <div className="flex-1 p-3 flex flex-col gap-2 min-h-0 overflow-hidden">
        {/* Row 1: KPIs - fixed height */}
        <div className="flex-shrink-0 grid grid-cols-4 gap-2">
          <KPICard
            label="Pipeline Value"
            value={pipelineKpis?.pipelineValue || 32000000}
            changePercent={pipelineKpis?.pipelineChange || 8.5}
            format="currency"
            icon={<TrendingUp className="h-4 w-4" />}
            loading={kpisLoading}
          />
          <KPICard
            label="Avg Cycle Time"
            value={pipelineKpis?.avgCycleTime || 42}
            changePercent={pipelineKpis?.cycleTimeChange || -3.2}
            format="number"
            icon={<Clock className="h-4 w-4" />}
            loading={kpisLoading}
          />
          <KPICard
            label="Win Rate"
            value={pipelineKpis?.winRate || 12.5}
            changePercent={pipelineKpis?.winRateChange || 2.8}
            format="percent"
            icon={<Trophy className="h-4 w-4" />}
            loading={kpisLoading}
          />
          <KPICard
            label="Avg Deal Size"
            value={pipelineKpis?.avgDealSize || 85000}
            changePercent={pipelineKpis?.dealSizeChange || 5.5}
            format="currency"
            icon={<Target className="h-4 w-4" />}
            loading={kpisLoading}
          />
        </div>

        {/* Row 2: Pipeline, Conversion, Cycle Time - 45% */}
        <div className="flex-[45] min-h-0 grid grid-cols-3 gap-2">
          <ChartCard title="Sales Pipeline" subtitle="By stage" loading={pipelineLoading}>
            <FunnelChart data={funnelData} />
          </ChartCard>

          <ChartCard title="Deal Size Distribution" subtitle="Transaction count by size" loading={dealSizeLoading}>
            <DonutChart
              data={dealSizeDistribution}
              nameKey="bucket"
              valueKey="count"
              formatValue="number"
            />
          </ChartCard>

          <ChartCard title="Deal Cycle Time" subtitle="Avg days per stage">
            <BarChart
              data={cycleData}
              xKey="stage"
              yKeys={['avgDays']}
              formatY="number"
              labels={{ avgDays: 'Days' }}
              colors={['#3B82F6']}
            />
          </ChartCard>
        </div>

        {/* Row 3: Sales Team Performance - 55% */}
        <div className="flex-[55] min-h-0">
          <ChartCard
            title="Sales Team Performance"
            subtitle="Quota attainment"
            loading={salesLoading}
          >
            <DataTable
              data={salesRepsData}
              keyExtractor={(row) => row.id}
              columns={[
                { key: 'name', header: 'Sales Rep', sortable: true },
                { key: 'team', header: 'Team', sortable: true },
                { key: 'region', header: 'Region', sortable: true },
                {
                  key: 'quota',
                  header: 'Quota',
                  sortable: true,
                  align: 'right',
                  render: (value) => formatCurrency(value as number, true),
                },
                {
                  key: 'achieved',
                  header: 'Achieved',
                  sortable: true,
                  align: 'right',
                  render: (value) => formatCurrency(value as number, true),
                },
                {
                  key: 'deals',
                  header: 'Deals',
                  sortable: true,
                  align: 'right',
                },
                {
                  key: 'attainment',
                  header: '%',
                  sortable: true,
                  align: 'right',
                  render: (value) => {
                    const v = value as number;
                    const color = v >= 100 ? 'text-success' : v >= 80 ? 'text-warning' : 'text-danger';
                    return <span className={`font-medium ${color}`}>{v.toFixed(0)}%</span>;
                  },
                },
              ]}
              compact
            />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
