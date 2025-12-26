import type { DashboardSummary } from '../types';

type ExportFormat = 'csv' | 'json' | 'pdf';

interface ExportData {
  summary: DashboardSummary;
  dateRange: { startDate: string; endDate: string };
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function exportToCSV(data: ExportData): void {
  const { summary, dateRange } = data;
  const rows: string[] = [];

  // Header info
  rows.push(`Analytics Dashboard Export`);
  rows.push(`Date Range: ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`);
  rows.push(`Generated: ${new Date().toLocaleString()}`);
  rows.push('');

  // KPIs Section
  rows.push('KEY PERFORMANCE INDICATORS');
  rows.push('Metric,Current Value,Previous Value,Change %');
  rows.push(`Total Revenue,${formatCurrency(summary.kpis.totalRevenue.value)},${formatCurrency(summary.kpis.totalRevenue.previousValue || 0)},${summary.kpis.totalRevenue.changePercent}%`);
  rows.push(`Total Customers,${summary.kpis.totalCustomers.value},${summary.kpis.totalCustomers.previousValue || 0},${summary.kpis.totalCustomers.changePercent}%`);
  rows.push(`Avg Order Value,${formatCurrency(summary.kpis.avgOrderValue.value)},N/A,${summary.kpis.avgOrderValue.changePercent}%`);
  rows.push(`Pipeline Value,${formatCurrency(summary.kpis.pipelineValue.value)},N/A,${summary.kpis.pipelineValue.changePercent}%`);
  rows.push('');

  // Revenue Trend
  if (summary.revenueTrend?.length) {
    rows.push('REVENUE TREND');
    rows.push('Date,Revenue,Orders');
    summary.revenueTrend.forEach(item => {
      rows.push(`${item.date},${item.revenue},${item.orders}`);
    });
    rows.push('');
  }

  // Revenue by Category
  if (summary.revenueByCategory?.length) {
    rows.push('REVENUE BY CATEGORY');
    rows.push('Category,Value,Percentage');
    summary.revenueByCategory.forEach(item => {
      rows.push(`${item.category},${formatCurrency(item.value)},${item.percentage}%`);
    });
    rows.push('');
  }

  // Top Products
  if (summary.topProducts?.length) {
    rows.push('TOP PRODUCTS');
    rows.push('Name,Category,Revenue,Units Sold,Growth %');
    summary.topProducts.forEach(product => {
      rows.push(`"${product.name}",${product.category},${formatCurrency(product.revenue)},${product.unitsSold},${product.growth}%`);
    });
    rows.push('');
  }

  // Pipeline Summary
  if (summary.pipelineSummary?.length) {
    rows.push('PIPELINE SUMMARY');
    rows.push('Stage,Value,Count,Conversion Rate');
    summary.pipelineSummary.forEach(stage => {
      rows.push(`${stage.stage},${formatCurrency(stage.value)},${stage.count},${stage.conversionRate}%`);
    });
  }

  const filename = `analytics-export-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
  downloadFile(rows.join('\n'), filename, 'text/csv;charset=utf-8');
}

export function exportToJSON(data: ExportData): void {
  const { summary, dateRange } = data;

  const exportObj = {
    exportInfo: {
      generatedAt: new Date().toISOString(),
      dateRange: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
    },
    kpis: {
      totalRevenue: summary.kpis.totalRevenue,
      totalCustomers: summary.kpis.totalCustomers,
      avgOrderValue: summary.kpis.avgOrderValue,
      pipelineValue: summary.kpis.pipelineValue,
    },
    revenueTrend: summary.revenueTrend || [],
    revenueByCategory: summary.revenueByCategory || [],
    topProducts: summary.topProducts || [],
    pipelineSummary: summary.pipelineSummary || [],
    recentCustomers: summary.recentCustomers || [],
  };

  const content = JSON.stringify(exportObj, null, 2);
  const filename = `analytics-export-${dateRange.startDate}-to-${dateRange.endDate}.json`;
  downloadFile(content, filename, 'application/json');
}

export function exportToPDF(data: ExportData): void {
  // For PDF, we'll create a printable HTML page that the user can save as PDF
  const { summary, dateRange } = data;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Analytics Dashboard Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; }
    .meta { color: #6b7280; font-size: 14px; margin-bottom: 30px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
    .kpi-card { background: #f9fafb; border-radius: 8px; padding: 20px; }
    .kpi-label { font-size: 14px; color: #6b7280; }
    .kpi-value { font-size: 28px; font-weight: bold; color: #111827; }
    .kpi-change { font-size: 14px; margin-top: 5px; }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>Analytics Dashboard Report</h1>
  <div class="meta">
    <p>Date Range: ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}</p>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>

  <h2>Key Performance Indicators</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Revenue</div>
      <div class="kpi-value">${formatCurrency(summary.kpis.totalRevenue.value)}</div>
      <div class="kpi-change ${summary.kpis.totalRevenue.changePercent >= 0 ? 'positive' : 'negative'}">
        ${summary.kpis.totalRevenue.changePercent >= 0 ? '+' : ''}${summary.kpis.totalRevenue.changePercent}% vs previous period
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Customers</div>
      <div class="kpi-value">${summary.kpis.totalCustomers.value.toLocaleString()}</div>
      <div class="kpi-change ${summary.kpis.totalCustomers.changePercent >= 0 ? 'positive' : 'negative'}">
        ${summary.kpis.totalCustomers.changePercent >= 0 ? '+' : ''}${summary.kpis.totalCustomers.changePercent}% vs previous period
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Avg Order Value</div>
      <div class="kpi-value">${formatCurrency(summary.kpis.avgOrderValue.value)}</div>
      <div class="kpi-change ${summary.kpis.avgOrderValue.changePercent >= 0 ? 'positive' : 'negative'}">
        ${summary.kpis.avgOrderValue.changePercent >= 0 ? '+' : ''}${summary.kpis.avgOrderValue.changePercent}% vs previous period
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Pipeline Value</div>
      <div class="kpi-value">${formatCurrency(summary.kpis.pipelineValue.value)}</div>
      <div class="kpi-change ${summary.kpis.pipelineValue.changePercent >= 0 ? 'positive' : 'negative'}">
        ${summary.kpis.pipelineValue.changePercent >= 0 ? '+' : ''}${summary.kpis.pipelineValue.changePercent}% vs previous period
      </div>
    </div>
  </div>

  ${summary.revenueByCategory?.length ? `
  <h2>Revenue by Category</h2>
  <table>
    <thead><tr><th>Category</th><th>Value</th><th>Percentage</th></tr></thead>
    <tbody>
      ${summary.revenueByCategory.map(c => `<tr><td>${c.category}</td><td>${formatCurrency(c.value)}</td><td>${c.percentage}%</td></tr>`).join('')}
    </tbody>
  </table>
  ` : ''}

  ${summary.topProducts?.length ? `
  <h2>Top Products</h2>
  <table>
    <thead><tr><th>Product</th><th>Category</th><th>Revenue</th><th>Units</th><th>Growth</th></tr></thead>
    <tbody>
      ${summary.topProducts.slice(0, 10).map(p => `<tr><td>${p.name}</td><td>${p.category}</td><td>${formatCurrency(p.revenue)}</td><td>${p.unitsSold}</td><td class="${p.growth >= 0 ? 'positive' : 'negative'}">${p.growth >= 0 ? '+' : ''}${p.growth}%</td></tr>`).join('')}
    </tbody>
  </table>
  ` : ''}

  ${summary.pipelineSummary?.length ? `
  <h2>Pipeline Summary</h2>
  <table>
    <thead><tr><th>Stage</th><th>Value</th><th>Count</th><th>Conversion Rate</th></tr></thead>
    <tbody>
      ${summary.pipelineSummary.map(s => `<tr><td>${s.stage}</td><td>${formatCurrency(s.value)}</td><td>${s.count}</td><td>${s.conversionRate}%</td></tr>`).join('')}
    </tbody>
  </table>
  ` : ''}

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

export async function exportDashboardData(
  format: ExportFormat,
  dateRange: { startDate: string; endDate: string }
): Promise<void> {
  const API_BASE = import.meta.env.VITE_API_URL || '/api';

  const response = await fetch(
    `${API_BASE}/dashboard/summary?start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`
  );

  if (!response.ok) {
    throw new Error('Failed to fetch dashboard data');
  }

  const summary: DashboardSummary = await response.json();
  const exportData = { summary, dateRange };

  switch (format) {
    case 'csv':
      exportToCSV(exportData);
      break;
    case 'json':
      exportToJSON(exportData);
      break;
    case 'pdf':
      exportToPDF(exportData);
      break;
  }
}
