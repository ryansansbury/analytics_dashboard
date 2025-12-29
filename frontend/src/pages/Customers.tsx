import { Users, UserPlus, UserMinus, AlertTriangle } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { KPICard } from '../components/cards/KPICard';
import { ChartCard } from '../components/cards/ChartCard';
import { AreaChart } from '../components/charts/AreaChart';
import { BarChart } from '../components/charts/BarChart';
import { DonutChart } from '../components/charts/PieChart';
import { DataTable } from '../components/tables/DataTable';
import { formatCurrency } from '../utils/formatters';
import {
  useCustomerOverview,
  useCustomerSegments,
  useCustomerCohorts,
  useAtRiskCustomers,
  useLifetimeValue,
  useCustomerAcquisition,
} from '../hooks/useApi';
import { useFilters } from '../hooks/useFilters';

export function Customers() {
  const { filters } = useFilters();

  // Fetch data from API
  const { data: overview, isLoading: overviewLoading } = useCustomerOverview();
  const { data: segments, isLoading: segmentsLoading } = useCustomerSegments();
  const { data: cohorts, isLoading: cohortsLoading } = useCustomerCohorts();
  const { data: atRiskCustomers, isLoading: atRiskLoading } = useAtRiskCustomers(10);
  const { data: ltvData, isLoading: ltvLoading } = useLifetimeValue();
  const { data: acquisitionData, isLoading: acquisitionLoading } = useCustomerAcquisition();

  // Transform data
  const segmentData = (segments || []).map(item => ({
    segment: item.segment,
    count: item.count,
    revenue: item.revenue,
  }));

  const atRiskData = (atRiskCustomers || []).map((item) => ({
    id: item.id,
    company: item.company || item.name,
    segment: item.segment,
    ltv: item.lifetimeValue,
    riskScore: item.riskScore || 0.65,
  }));

  // Transform LTV data for bar chart
  const ltvChartData = (ltvData || []).map(item => ({
    range: item.range,
    count: item.count,
  }));

  // Aggregate acquisition data by date (sum all channels)
  const acquisitionByDate = (acquisitionData || []).reduce((acc, item) => {
    const existing = acc.find(a => a.date === item.date);
    if (existing) {
      existing.customers += item.count;
    } else {
      acc.push({ date: item.date, customers: item.count });
    }
    return acc;
  }, [] as { date: string; customers: number }[]).sort((a, b) => a.date.localeCompare(b.date));

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
    <div className="h-full flex flex-col overflow-hidden">
      <Header
        title="Customer Analytics"
        subtitle={`${filters.dateRange.startDate} to ${filters.dateRange.endDate}`}
      />

      {/* Content area with flexible row heights */}
      <div className="flex-1 p-3 flex flex-col gap-2 min-h-0 overflow-hidden">
        {/* Row 1: KPIs - auto height */}
        <div className="flex-shrink-0 grid grid-cols-4 gap-2">
          <KPICard
            label="Active Customers"
            value={overview?.total || 500}
            changePercent={overview?.totalChange || 8.5}
            format="number"
            icon={<Users className="h-4 w-4" />}
            loading={overviewLoading}
          />
          <KPICard
            label="New This Period"
            value={overview?.new || 25}
            changePercent={overview?.newChange || 12.3}
            format="number"
            icon={<UserPlus className="h-4 w-4" />}
            loading={overviewLoading}
          />
          <KPICard
            label="Churned"
            value={overview?.churned || 3}
            changePercent={overview?.churnedChange || -8.5}
            format="number"
            icon={<UserMinus className="h-4 w-4" />}
            loading={overviewLoading}
          />
          <KPICard
            label="At Risk"
            value={overview?.atRisk || 15}
            changePercent={overview?.atRiskChange || -5.2}
            format="number"
            icon={<AlertTriangle className="h-4 w-4" />}
            loading={overviewLoading}
          />
        </div>

        {/* Row 2: Segments + At Risk - 35% */}
        <div className="flex-[35] min-h-0 grid grid-cols-3 gap-2">
          <ChartCard
            title="Customer Segments"
            subtitle="By business size"
            loading={segmentsLoading}
          >
            <DonutChart
              data={segmentData}
              nameKey="segment"
              valueKey="count"
              formatValue="number"
            />
          </ChartCard>

          <ChartCard
            title="Revenue by Segment"
            subtitle="Distribution"
            loading={segmentsLoading}
          >
            <BarChart
              data={segmentData}
              xKey="segment"
              yKeys={['revenue']}
              colorByValue
            />
          </ChartCard>

          <ChartCard
            title="At-Risk Customers"
            subtitle="Potential churn"
            loading={atRiskLoading}
          >
            <DataTable
              data={atRiskData}
              keyExtractor={(row) => row.id}
              columns={[
                { key: 'company', header: 'Company', sortable: true, width: '40%' },
                { key: 'segment', header: 'Segment', sortable: true, width: '25%' },
                {
                  key: 'ltv',
                  header: 'LTV',
                  sortable: true,
                  align: 'right',
                  width: '20%',
                  render: (value) => formatCurrency(value as number, true),
                },
                {
                  key: 'riskScore',
                  header: 'Risk',
                  sortable: true,
                  align: 'right',
                  width: '15%',
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
              compact
            />
          </ChartCard>
        </div>

        {/* Row 3: Customer Acquisition + LTV Distribution - 35% */}
        <div className="flex-[35] min-h-0 grid grid-cols-2 gap-2">
          <ChartCard
            title="Customer Acquisition"
            subtitle="New customers over time"
            loading={acquisitionLoading}
          >
            <AreaChart
              data={acquisitionByDate}
              xKey="date"
              yKeys={['customers']}
              labels={{ customers: 'Customers' }}
              formatY="number"
            />
          </ChartCard>

          <ChartCard
            title="Lifetime Value Distribution"
            subtitle="Customer count by LTV range"
            loading={ltvLoading}
          >
            <BarChart
              data={ltvChartData}
              xKey="range"
              yKeys={['count']}
              formatY="number"
              colorByValue
            />
          </ChartCard>
        </div>

        {/* Row 4: Cohort Retention - 30% */}
        <div className="flex-[30] min-h-0">
          <ChartCard
            title="Cohort Retention Analysis"
            subtitle="12 month customer retention by signup cohort"
            loading={cohortsLoading}
          >
            <div className="overflow-auto h-full">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-2 py-1 text-left font-medium text-gray-400 sticky left-0 bg-gray-900 z-10">Cohort</th>
                    {['M0','M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11'].map(m => (
                      <th key={m} className="px-1 py-1 text-center font-medium text-gray-400 min-w-[40px]">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohortTableData.length > 0 ? cohortTableData.map((row) => (
                    <tr key={row.cohort} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="px-2 py-0.5 text-gray-200 font-medium sticky left-0 bg-gray-900 z-10">{row.cohort}</td>
                      {[row.m0, row.m1, row.m2, row.m3, row.m4, row.m5, row.m6, row.m7, row.m8, row.m9, row.m10, row.m11].map((val, i) => (
                        <td
                          key={i}
                          className="px-1 py-0.5 text-center"
                          style={{
                            backgroundColor: val > 0 ? `rgba(59, 130, 246, ${val / 100 * 0.7})` : 'transparent',
                          }}
                        >
                          <span className={val > 0 ? 'text-white font-medium' : 'text-gray-600'}>
                            {val > 0 ? `${val}%` : '-'}
                          </span>
                        </td>
                      ))}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={13} className="px-4 py-4 text-center text-gray-500">
                        No cohort data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
