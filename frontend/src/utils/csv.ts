/**
 * CSV for the table view's download button.
 *
 * Two rules learned the hard way in an earlier exporter:
 *
 * - Numbers go out raw, never through `Intl.NumberFormat`. "$1,234,567"
 *   contains two field delimiters, so one revenue figure became three columns
 *   in a spreadsheet and shifted every heading after it.
 * - A field holding a comma, a quote, or a line break is wrapped in quotes and
 *   its quotes doubled, the RFC 4180 rule.
 */

export interface CsvColumn<T> {
  key: string;
  header: string;
  /** The cell's value for the file. Defaults to the raw field. */
  value?: (row: T) => unknown;
}

export function csvField(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCSV<T extends Record<string, unknown>>(columns: CsvColumn<T>[], rows: T[]): string {
  const head = columns.map((c) => csvField(c.header)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => csvField(c.value ? c.value(row) : row[c.key])).join(','),
  );
  return [head, ...body].join('\r\n');
}

export function downloadCSV(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
