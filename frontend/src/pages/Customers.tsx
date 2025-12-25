import { Users, UserPlus, UserMinus, AlertTriangle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { AreaChart } from '../components/charts/AreaChart';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/PieChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency } from '../utils/formatters';

// Mock data
const mockCustomerKPIs = {
  total: { value: 1847, change: 8.3 },
  new: { value: 156, change: 12.5 },
  churned: { value: 23, change: -15.2 },
  atRisk: { value: 45, change: 5.1 },
};

const mockCustomerTrend = [
  { date: '2024-01', total: 1580, new: 85, churned: 12 },
  { date: '2024-02', total: 1620, new: 72, churned: 32 },
  { date: '2024-03', total: 1675, new: 88, churned: 33 },
  { date: '2024-04', total: 1710, new: 65, churned: 30 },
  { date: '2024-05', total: 1745, new: 78, churned: 43 },
  { date: '2024-06', total: 1768, new: 56, churned: 33 },
  { date: '2024-07', total: 1790, new: 62, churned: 40 },
  { date: '2024-08', total: 1810, new: 55, churned: 35 },
  { date: '2024-09', total: 1832, new: 58, churned: 36 },
  { date: '2024-10', total: 1855, new: 62, churned: 39 },
  { date: '2024-11', total: 1825, new: 48, churned: 78 },
  { date: '2024-12', total: 1847, new: 68, churned: 46 },
];

const mockSegmentData = [
  { segment: 'Enterprise', count: 245, revenue: 2800000 },
  { segment: 'Mid-Market', count: 612, revenue: 1200000 },
  { segment: 'SMB', count: 990, revenue: 250000 },
];

const mockAcquisitionData = [
  { channel: 'Direct Sales', count: 580, percentage: 31.4 },
  { channel: 'Referral', count: 420, percentage: 22.7 },
  { channel: 'Organic Search', count: 385, percentage: 20.8 },
  { channel: 'Paid Ads', count: 280, percentage: 15.2 },
  { channel: 'Events', count: 182, percentage: 9.9 },
];

const mockAtRiskCustomers = [
  { id: 1, name: 'Acme Corp', company: 'Acme Corporation', segment: 'Enterprise', ltv: 125000, lastActivity: '45 days ago', riskScore: 0.85 },
  { id: 2, name: 'TechStart Inc', company: 'TechStart', segment: 'Mid-Market', ltv: 48000, lastActivity: '38 days ago', riskScore: 0.78 },
  { id: 3, name: 'Global Systems', company: 'Global Systems LLC', segment: 'Enterprise', ltv: 95000, lastActivity: '52 days ago', riskScore: 0.72 },
  { id: 4, name: 'DataFlow', company: 'DataFlow Analytics', segment: 'Mid-Market', ltv: 32000, lastActivity: '41 days ago', riskScore: 0.68 },
  { id: 5, name: 'CloudNet', company: 'CloudNet Solutions', segment: 'SMB', ltv: 18000, lastActivity: '35 days ago', riskScore: 0.65 },
];

const mockCohortData = [
  { cohort: 'Jan 2024', m0: 100, m1: 92, m2: 88, m3: 85, m4: 82, m5: 80, m6: 78 },
  { cohort: 'Feb 2024', m0: 100, m1: 90, m2: 85, m3: 82, m4: 79, m5: 77, m6: 0 },
  { cohort: 'Mar 2024', m0: 100, m1: 93, m2: 89, m3: 86, m4: 83, m5: 0, m6: 0 },
  { cohort: 'Apr 2024', m0: 100, m1: 91, m2: 87, m3: 84, m4: 0, m5: 0, m6: 0 },
  { cohort: 'May 2024', m0: 100, m1: 94, m2: 90, m3: 0, m4: 0, m5: 0, m6: 0 },
  { cohort: 'Jun 2024', m0: 100, m1: 92, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0 },
];

export function Customers() {
  return (
    <div className="min-h-screen">
      <Header
        title="Customer Analytics"
        subtitle="Customer health, segmentation, and retention metrics"
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total Customers"
            value={mockCustomerKPIs.total.value}
            changePercent={mockCustomerKPIs.total.change}
            format="number"
            icon={<Users className="h-5 w-5" />}
          />
          <KPICard
            label="New This Month"
            value={mockCustomerKPIs.new.value}
            changePercent={mockCustomerKPIs.new.change}
            format="number"
            icon={<UserPlus className="h-5 w-5" />}
          />
          <KPICard
            label="Churned"
            value={mockCustomerKPIs.churned.value}
            changePercent={mockCustomerKPIs.churned.change}
            format="number"
            icon={<UserMinus className="h-5 w-5" />}
          />
          <KPICard
            label="At Risk"
            value={mockCustomerKPIs.atRisk.value}
            changePercent={mockCustomerKPIs.atRisk.change}
            format="number"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        </div>

        {/* Customer Trend */}
        <ChartCard
          title="Customer Growth"
          subtitle="Total customers, new acquisitions, and churn over time"
        >
          <AreaChart
            data={mockCustomerTrend}
            xKey="date"
            yKeys={['total']}
            labels={{ total: 'Total Customers' }}
            formatY="number"
            height={300}
          />
        </ChartCard>

        {/* Segments and Acquisition */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Customer Segments" subtitle="Distribution by business size">
            <DonutChart
              data={mockSegmentData}
              nameKey="segment"
              valueKey="count"
              formatValue="number"
              height={280}
            />
          </ChartCard>

          <ChartCard title="Acquisition Channels" subtitle="How customers find us">
            <BarChart
              data={mockAcquisitionData}
              xKey="channel"
              yKeys={['count']}
              formatY="number"
              height={280}
              colorByValue
            />
          </ChartCard>
        </div>

        {/* Cohort Analysis */}
        <ChartCard
          title="Cohort Retention"
          subtitle="Monthly retention rates by acquisition cohort"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Cohort</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">M0</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">M1</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">M2</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">M3</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">M4</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">M5</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">M6</th>
                </tr>
              </thead>
              <tbody>
                {mockCohortData.map((row) => (
                  <tr key={row.cohort} className="border-b border-gray-800/50">
                    <td className="px-4 py-3 text-gray-300">{row.cohort}</td>
                    {[row.m0, row.m1, row.m2, row.m3, row.m4, row.m5, row.m6].map((val, i) => (
                      <td
                        key={i}
                        className="px-4 py-3 text-center"
                        style={{
                          backgroundColor: val > 0 ? `rgba(99, 102, 241, ${val / 100 * 0.5})` : 'transparent',
                        }}
                      >
                        <span className={val > 0 ? 'text-white' : 'text-gray-600'}>
                          {val > 0 ? `${val}%` : '-'}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        {/* At Risk Customers */}
        <ChartCard
          title="At-Risk Customers"
          subtitle="Customers showing signs of potential churn"
        >
          <DataTable
            data={mockAtRiskCustomers}
            keyExtractor={(row) => row.id}
            columns={[
              { key: 'company', header: 'Company', sortable: true },
              { key: 'segment', header: 'Segment', sortable: true },
              {
                key: 'ltv',
                header: 'Lifetime Value',
                sortable: true,
                align: 'right',
                render: (value) => formatCurrency(value as number),
              },
              { key: 'lastActivity', header: 'Last Activity', sortable: true },
              {
                key: 'riskScore',
                header: 'Risk Score',
                sortable: true,
                align: 'right',
                render: (value) => {
                  const score = value as number;
                  const color = score >= 0.7 ? 'text-danger' : score >= 0.5 ? 'text-warning' : 'text-success';
                  return (
                    <span className={`font-medium ${color}`}>
                      {(score * 100).toFixed(0)}%
                    </span>
                  );
                },
              },
            ]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
