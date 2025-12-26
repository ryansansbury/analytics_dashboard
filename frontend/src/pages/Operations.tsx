import { Target, Clock, Trophy, TrendingUp } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { BarChart } from '../components/charts/BarChart';
import { FunnelChart } from '../components/charts/FunnelChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency } from '../utils/formatters';
import { usePipeline, useSalesPerformance } from '../hooks/useApi';

export function Operations() {
  // Fetch real data from API
  const { data: pipelineData, isLoading: pipelineLoading } = usePipeline();
  const { data: salesReps, isLoading: salesLoading } = useSalesPerformance();

  // Transform pipeline data for funnel
  const funnelData = (pipelineData || []).map((item, index, arr) => ({
    stage: item.stage,
    value: item.value,
    count: item.count,
    conversionRate: index === 0 ? 100 : Math.round((item.count / arr[0].count) * 100),
  }));

  // Calculate KPIs from real data
  const totalPipelineValue = funnelData.reduce((sum, item) => sum + item.value, 0);
  const totalDeals = funnelData.reduce((sum, item) => sum + item.count, 0);
  const avgDealSize = totalDeals > 0 ? totalPipelineValue / totalDeals : 0;
  const closedWonStage = funnelData.find(s => s.stage === 'Closed Won');
  const leadStage = funnelData.find(s => s.stage === 'Lead');
  const winRate = leadStage && leadStage.count > 0 && closedWonStage
    ? (closedWonStage.count / leadStage.count) * 100
    : 0;

  // Calculate conversion rates from pipeline
  const conversionRates = [];
  for (let i = 0; i < funnelData.length - 1; i++) {
    const fromStage = funnelData[i];
    const toStage = funnelData[i + 1];
    const rate = fromStage.count > 0 ? (toStage.count / fromStage.count) * 100 : 0;
    conversionRates.push({
      fromStage: `${fromStage.stage} → ${toStage.stage}`,
      rate: Math.round(rate * 10) / 10,
    });
  }

  // Static cycle time (would need timestamp tracking to calculate dynamically)
  const cycleTimeData = [
    { stage: 'Lead to Qualified', avgDays: 8 },
    { stage: 'Qualified to Proposal', avgDays: 12 },
    { stage: 'Proposal to Negotiation', avgDays: 15 },
    { stage: 'Negotiation to Close', avgDays: 7 },
  ];
  const totalCycleTime = cycleTimeData.reduce((sum, item) => sum + item.avgDays, 0);

  // Transform sales reps data (take top 10)
  const salesRepsData = (salesReps || []).slice(0, 10).map(rep => ({
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
    <div className="min-h-screen">
      <Header
        title="Operations"
        subtitle="Sales pipeline, team performance, and deal metrics"
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Pipeline Value"
            value={totalPipelineValue}
            changePercent={0}
            format="currency"
            icon={<TrendingUp className="h-5 w-5" />}
            loading={pipelineLoading}
          />
          <KPICard
            label="Avg Cycle Time"
            value={totalCycleTime}
            changePercent={0}
            format="number"
            icon={<Clock className="h-5 w-5" />}
          />
          <KPICard
            label="Win Rate"
            value={winRate}
            changePercent={0}
            format="percent"
            icon={<Trophy className="h-5 w-5" />}
            loading={pipelineLoading}
          />
          <KPICard
            label="Avg Deal Size"
            value={avgDealSize}
            changePercent={0}
            format="currency"
            icon={<Target className="h-5 w-5" />}
            loading={pipelineLoading}
          />
        </div>

        {/* Pipeline and Conversion */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Sales Pipeline" subtitle="Opportunity value by stage" loading={pipelineLoading}>
            <FunnelChart data={funnelData} height={320} />
          </ChartCard>

          <ChartCard title="Stage Conversion Rates" subtitle="Conversion percentage between stages" loading={pipelineLoading}>
            <BarChart
              data={conversionRates}
              xKey="fromStage"
              yKeys={['rate']}
              formatY="percent"
              height={320}
              horizontal
              colorByValue
            />
          </ChartCard>
        </div>

        {/* Cycle Time */}
        <ChartCard title="Deal Cycle Time" subtitle="Average days spent in each stage">
          <BarChart
            data={cycleTimeData}
            xKey="stage"
            yKeys={['avgDays']}
            formatY="number"
            labels={{ avgDays: 'Days' }}
            height={250}
          />
        </ChartCard>

        {/* Sales Rep Performance */}
        <ChartCard
          title="Sales Team Performance (YTD)"
          subtitle="Pro-rated quota attainment and deal metrics"
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
                header: 'Annual Quota',
                sortable: true,
                align: 'right',
                render: (value) => formatCurrency(value as number, true),
              },
              {
                key: 'achieved',
                header: 'YTD Achieved',
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
                header: 'Attainment',
                sortable: true,
                align: 'right',
                render: (value) => {
                  const v = value as number;
                  const color = v >= 100 ? 'text-success' : v >= 80 ? 'text-warning' : 'text-danger';
                  return <span className={`font-medium ${color}`}>{v.toFixed(1)}%</span>;
                },
              },
            ]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
