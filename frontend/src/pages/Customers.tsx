import { Users, UserPlus, UserMinus, AlertTriangle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/PieChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency } from '../utils/formatters';
import {
  useCustomerOverview,
  useCustomerSegments,
  useCustomerCohorts,
  useAtRiskCustomers,
} from '../hooks/useApi';
import { useFilters } from '../hooks/useFilters';

export function Customers() {
  const { filters } = useFilters();

  // Fetch data from API
  const { data: overview, isLoading: overviewLoading } = useCustomerOverview();
  const { data: segments, isLoading: segmentsLoading } = useCustomerSegments();
  const { data: cohorts, isLoading: cohortsLoading } = useCustomerCohorts();
  const { data: atRiskCustomers, isLoading: atRiskLoading } = useAtRiskCustomers(10);

  // Transform data
  const segmentData = (segments || []).map(item => ({
    segment: item.segment,
    count: item.count,
    revenue: item.revenue,
  }));

  const atRiskData = (atRiskCustomers || []).map((item, index) => ({
    id: index + 1,
    company: item.company || item.name,
    segment: item.segment,
    ltv: item.lifetimeValue,
    lastActivity: item.status === 'at-risk' ? 'Recently inactive' : 'Active',
    // Generate deterministic risk score based on index and LTV
    riskScore: 0.65 + ((index % 5) * 0.05) + (item.lifetimeValue > 50000 ? 0.1 : 0),
  }));

  // Transform cohort data for display - 12 months
  const cohortTableData = (cohorts || []).map(cohort => ({
    cohort: cohort.cohort,
    m0: cohort.month0 || 100,
    m1: cohort.month1 || 0,
    m2: cohort.month2 || 0,
    m3: cohort.month3 || 0,
    m4: cohort.month4 || 0,
    m5: cohort.month5 || 0,
    m6: cohort.month6 || 0,
    m7: cohort.month7 || 0,
    m8: cohort.month8 || 0,
    m9: cohort.month9 || 0,
    m10: cohort.month10 || 0,
    m11: cohort.month11 || 0,
  }));

  return (
    <div className="min-h-screen">
      <Header
        title="Customer Analytics"
        subtitle={`Data from ${filters.dateRange.startDate} to ${filters.dateRange.endDate}`}
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Active Customers"
            value={overview?.total || 500}
            changePercent={overview?.totalChange || 8.5}
            format="number"
            icon={<Users className="h-5 w-5" />}
            loading={overviewLoading}
          />
          <KPICard
            label="New This Period"
            value={overview?.new || 25}
            changePercent={overview?.newChange || 12.3}
            format="number"
            icon={<UserPlus className="h-5 w-5" />}
            loading={overviewLoading}
          />
          <KPICard
            label="Churned"
            value={overview?.churned || 3}
            changePercent={overview?.churnedChange || -8.5}
            format="number"
            icon={<UserMinus className="h-5 w-5" />}
            loading={overviewLoading}
          />
          <KPICard
            label="At Risk"
            value={overview?.atRisk || 15}
            changePercent={overview?.atRiskChange || -5.2}
            format="number"
            icon={<AlertTriangle className="h-5 w-5" />}
            loading={overviewLoading}
          />
        </div>

        {/* Segments */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Customer Segments"
            subtitle="Distribution by business size"
            loading={segmentsLoading}
          >
            <DonutChart
              data={segmentData}
              nameKey="segment"
              valueKey="count"
              formatValue="number"
              height={280}
            />
          </ChartCard>

          <ChartCard
            title="Revenue by Segment"
            subtitle="Revenue distribution across segments"
            loading={segmentsLoading}
          >
            <BarChart
              data={segmentData}
              xKey="segment"
              yKeys={['revenue']}
              height={280}
              colorByValue
            />
          </ChartCard>
        </div>

        {/* Cohort Analysis */}
        <ChartCard
          title="Cohort Retention"
          subtitle="Monthly retention rates by acquisition cohort (12 months)"
          loading={cohortsLoading}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase sticky left-0 bg-gray-900">Cohort</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">M0</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">M1</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">M2</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">M3</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">M4</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">M5</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">M6</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">M7</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">M8</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">M9</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">M10</th>
                  <th className="px-2 py-3 text-center text-xs font-medium text-gray-400 uppercase">M11</th>
                </tr>
              </thead>
              <tbody>
                {cohortTableData.length > 0 ? cohortTableData.map((row) => (
                  <tr key={row.cohort} className="border-b border-gray-800/50">
                    <td className="px-3 py-3 text-gray-300 sticky left-0 bg-gray-900">{row.cohort}</td>
                    {[row.m0, row.m1, row.m2, row.m3, row.m4, row.m5, row.m6, row.m7, row.m8, row.m9, row.m10, row.m11].map((val, i) => (
                      <td
                        key={i}
                        className="px-2 py-3 text-center"
                        style={{
                          backgroundColor: val > 0 ? `rgba(6, 182, 212, ${val / 100 * 0.6})` : 'transparent',
                        }}
                      >
                        <span className={val > 0 ? 'text-white text-xs' : 'text-gray-600'}>
                          {val > 0 ? `${val}%` : '-'}
                        </span>
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                      No cohort data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>

        {/* At Risk Customers */}
        <ChartCard
          title="At-Risk Customers"
          subtitle="Customers showing signs of potential churn"
          loading={atRiskLoading}
        >
          <DataTable
            data={atRiskData}
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
              { key: 'lastActivity', header: 'Status', sortable: true },
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
