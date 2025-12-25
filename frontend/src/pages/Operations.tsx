import { Target, Clock, Trophy, TrendingUp } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { BarChart } from '../components/charts/BarChart';
import { FunnelChart } from '../components/charts/FunnelChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency } from '../utils/formatters';

// Mock data
const mockOperationsKPIs = {
  pipelineValue: { value: 8500000, change: 15.2 },
  avgCycleTime: { value: 42, change: -8.5 },
  winRate: { value: 28.5, change: 3.2 },
  avgDealSize: { value: 125000, change: 12.1 },
};

const mockPipelineData = [
  { stage: 'Lead', value: 8500000, count: 245, conversionRate: 100 },
  { stage: 'Qualified', value: 5200000, count: 156, conversionRate: 63.7 },
  { stage: 'Proposal', value: 3100000, count: 89, conversionRate: 57.1 },
  { stage: 'Negotiation', value: 1800000, count: 42, conversionRate: 47.2 },
  { stage: 'Closed Won', value: 950000, count: 28, conversionRate: 66.7 },
];

const mockSalesReps = [
  { id: 1, name: 'Sarah Johnson', team: 'Enterprise', region: 'West', quota: 500000, achieved: 580000, deals: 12, attainment: 116 },
  { id: 2, name: 'Michael Chen', team: 'Enterprise', region: 'East', quota: 500000, achieved: 520000, deals: 10, attainment: 104 },
  { id: 3, name: 'Emily Davis', team: 'Mid-Market', region: 'Central', quota: 350000, achieved: 345000, deals: 18, attainment: 98.6 },
  { id: 4, name: 'James Wilson', team: 'Mid-Market', region: 'West', quota: 350000, achieved: 310000, deals: 15, attainment: 88.6 },
  { id: 5, name: 'Lisa Anderson', team: 'Enterprise', region: 'Central', quota: 500000, achieved: 425000, deals: 8, attainment: 85 },
  { id: 6, name: 'David Brown', team: 'SMB', region: 'East', quota: 200000, achieved: 165000, deals: 32, attainment: 82.5 },
  { id: 7, name: 'Jennifer Martinez', team: 'SMB', region: 'West', quota: 200000, achieved: 155000, deals: 28, attainment: 77.5 },
  { id: 8, name: 'Robert Taylor', team: 'Mid-Market', region: 'East', quota: 350000, achieved: 260000, deals: 12, attainment: 74.3 },
];

const mockConversionRates = [
  { fromStage: 'Lead → Qualified', rate: 63.7 },
  { fromStage: 'Qualified → Proposal', rate: 57.1 },
  { fromStage: 'Proposal → Negotiation', rate: 47.2 },
  { fromStage: 'Negotiation → Won', rate: 66.7 },
];

const mockCycleTime = [
  { stage: 'Lead to Qualified', avgDays: 8 },
  { stage: 'Qualified to Proposal', avgDays: 12 },
  { stage: 'Proposal to Negotiation', avgDays: 15 },
  { stage: 'Negotiation to Close', avgDays: 7 },
];

const mockOpportunities = [
  { id: 1, name: 'Enterprise Suite - Acme Corp', customer: 'Acme Corporation', amount: 450000, stage: 'Negotiation', probability: 75, closeDate: '2025-01-15', rep: 'Sarah Johnson' },
  { id: 2, name: 'Cloud Migration - TechStart', customer: 'TechStart Inc', amount: 280000, stage: 'Proposal', probability: 50, closeDate: '2025-01-28', rep: 'Michael Chen' },
  { id: 3, name: 'Security Upgrade - Global Sys', customer: 'Global Systems', amount: 185000, stage: 'Negotiation', probability: 80, closeDate: '2025-01-10', rep: 'Emily Davis' },
  { id: 4, name: 'Analytics Platform - DataCo', customer: 'DataCo Analytics', amount: 320000, stage: 'Qualified', probability: 30, closeDate: '2025-02-15', rep: 'James Wilson' },
  { id: 5, name: 'Integration Suite - CloudNet', customer: 'CloudNet Solutions', amount: 165000, stage: 'Proposal', probability: 60, closeDate: '2025-01-22', rep: 'Lisa Anderson' },
];

export function Operations() {
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
            value={mockOperationsKPIs.pipelineValue.value}
            changePercent={mockOperationsKPIs.pipelineValue.change}
            format="currency"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <KPICard
            label="Avg Cycle Time"
            value={mockOperationsKPIs.avgCycleTime.value}
            changePercent={mockOperationsKPIs.avgCycleTime.change}
            format="number"
            icon={<Clock className="h-5 w-5" />}
          />
          <KPICard
            label="Win Rate"
            value={mockOperationsKPIs.winRate.value}
            changePercent={mockOperationsKPIs.winRate.change}
            format="percent"
            icon={<Trophy className="h-5 w-5" />}
          />
          <KPICard
            label="Avg Deal Size"
            value={mockOperationsKPIs.avgDealSize.value}
            changePercent={mockOperationsKPIs.avgDealSize.change}
            format="currency"
            icon={<Target className="h-5 w-5" />}
          />
        </div>

        {/* Pipeline and Conversion */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Sales Pipeline" subtitle="Opportunity value by stage">
            <FunnelChart data={mockPipelineData} height={320} />
          </ChartCard>

          <ChartCard title="Stage Conversion Rates" subtitle="Conversion percentage between stages">
            <BarChart
              data={mockConversionRates}
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
            data={mockCycleTime}
            xKey="stage"
            yKeys={['avgDays']}
            formatY="number"
            labels={{ avgDays: 'Days' }}
            height={250}
          />
        </ChartCard>

        {/* Sales Rep Performance */}
        <ChartCard
          title="Sales Team Performance"
          subtitle="Individual quota attainment and deal metrics"
        >
          <DataTable
            data={mockSalesReps}
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

        {/* Top Opportunities */}
        <ChartCard
          title="Top Opportunities"
          subtitle="Highest value deals in the pipeline"
        >
          <DataTable
            data={mockOpportunities}
            keyExtractor={(row) => row.id}
            columns={[
              { key: 'name', header: 'Opportunity', sortable: true },
              { key: 'customer', header: 'Customer', sortable: true },
              {
                key: 'amount',
                header: 'Amount',
                sortable: true,
                align: 'right',
                render: (value) => formatCurrency(value as number),
              },
              {
                key: 'stage',
                header: 'Stage',
                sortable: true,
                render: (value) => (
                  <span className="px-2 py-1 text-xs rounded-full bg-primary-500/20 text-primary-400">
                    {value as string}
                  </span>
                ),
              },
              {
                key: 'probability',
                header: 'Probability',
                sortable: true,
                align: 'right',
                render: (value) => `${value}%`,
              },
              { key: 'closeDate', header: 'Expected Close', sortable: true },
              { key: 'rep', header: 'Sales Rep', sortable: true },
            ]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
