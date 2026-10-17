import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { SALES_FIELDS, SALES_HEADERS, parseCompanySalesReport, parseDecimal } from './parser';

export interface CostReportInput {
  companies: Record<string, unknown>[];
  evidence: Record<string, unknown>[];
  validation: Record<string, unknown>;
  period: string;
  company: string;
}
export const REPORT_SHEETS = ['Ringkasan & Persentase', 'Breakdown Cost & Pajak', 'Evidence & Validation'] as const;

/** CSV is the 14-column detail exchange format; Excel is the three-sheet financial report. */
export async function buildCostCsv(records: Record<string, unknown>[], period: string): Promise<Buffer> {
  if (!records.length) throw new Error('Tidak ada rincian untuk diekspor.');
  const rows = records.map(record => SALES_FIELDS.map((field, index) => {
    if (index >= 6 || field === 'cw') return parseDecimal(record[field], field);
    const value = requiredText(record[field], field);
    // Quoting alone does not stop spreadsheet formula execution. Do not silently
    // alter customer/job identities to escape them; require source review instead.
    if (/^[=+\-@\t\r\n]/.test(value)) throw new Error(`CSV tidak dapat mengekspor ${field} yang diawali karakter formula. Periksa nilai sumber.`);
    return value;
  }));
  const bytes = Buffer.from('\uFEFF' + Papa.unparse([[...SALES_HEADERS], ...rows], { newline: '\r\n', quotes: true }));
  await parseCompanySalesReport(bytes, 'report.csv', period);
  return bytes;
}
function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Laporan tidak lengkap: ${field}.`);
  return value;
}
function amount(value: unknown, field: string): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || value === '' || !Number.isFinite(Number(value))) throw new Error(`Nominal laporan tidak valid: ${field}.`);
  return Number(value);
}
function timestamp(value: unknown): Date {
  const date = new Date(requiredText(value, 'timestamp'));
  if (Number.isNaN(date.valueOf())) throw new Error('Timestamp laporan tidak valid.');
  return date;
}

export async function buildCostWorkbook(input: CostReportInput): Promise<Buffer> {
  if (input.validation.is_validated !== true || input.validation.periode !== input.period) throw new Error('Laporan hanya tersedia untuk periode tervalidasi.');
  if (!input.companies.length) throw new Error('Tidak ada perusahaan sesuai filter laporan.');
  const workbook = new ExcelJS.Workbook();
  workbook.title = `Monthly Cost ${input.period}`;
  workbook.subject = `Filter perusahaan: ${input.company}`;
  const summary = workbook.addWorksheet(REPORT_SHEETS[0]);
  const breakdown = workbook.addWorksheet(REPORT_SHEETS[1]);
  const evidence = workbook.addWorksheet(REPORT_SHEETS[2]);
  summary.columns = [
    { header: 'Customer Code', key: 'customer_code', width: 18 },
    { header: 'Perusahaan', key: 'company_name', width: 46 },
    { header: 'Periode', key: 'periode', width: 20 },
    { header: 'Total Cost (Rp)', key: 'sum_total_cost', width: 24, style: { numFmt: '#,##0' } },
    { header: 'Porsi Perusahaan', key: 'company_share_pct', width: 22, style: { numFmt: '0.00%' } },
    { header: 'Profit (Rp)', key: 'sum_profit', width: 24, style: { numFmt: '#,##0' } },
  ];
  breakdown.columns = [
    { header: 'Customer Code', key: 'customer_code', width: 18 },
    { header: 'Perusahaan', key: 'company_name', width: 46 },
    ...[
      ['Invoice Nominal (Rp)', 'sum_invoice_nominal'], ['Sub Total (Rp)', 'sum_sub_total'],
      ['VAT / PPN 11% (Rp)', 'sum_vat'], ['Cost PPh 23 (Rp)', 'sum_pph23'],
      ['Others (Rp)', 'sum_others'], ['DIP IATA (Rp)', 'sum_dip_iata'], ['Total Cost (Rp)', 'sum_total_cost'],
    ].map(([header, key]) => ({ header, key, width: 24, style: { numFmt: '#,##0' } })),
  ];
  for (const company of input.companies) {
    const identity = {
      customer_code: requiredText(company.customer_code, 'customer_code'),
      company_name: requiredText(company.company_name, 'company_name'),
      periode: requiredText(company.periode, 'periode'),
    };
    if (!/^CUST-\d{4,}$/.test(identity.customer_code) || identity.periode !== input.period) throw new Error('Identitas/periode laporan tidak konsisten.');
    summary.addRow({ ...identity, sum_total_cost: amount(company.sum_total_cost, 'sum_total_cost'), company_share_pct: amount(company.company_share_pct, 'company_share_pct') / 100, sum_profit: amount(company.sum_profit, 'sum_profit') });
    const numeric = Object.fromEntries(['sum_invoice_nominal', 'sum_sub_total', 'sum_vat', 'sum_pph23', 'sum_others', 'sum_dip_iata', 'sum_total_cost'].map(key => [key, amount(company[key], key)]));
    breakdown.addRow({ ...identity, ...numeric });
  }
  evidence.columns = [
    { header: 'Nama Dokumen', key: 'file_name', width: 48 },
    { header: 'Periode', key: 'period_month', width: 20 },
    { header: 'Waktu Unggah (UTC)', key: 'uploaded_at', width: 28, style: { numFmt: 'yyyy-mm-dd hh:mm:ss.000' } },
    { header: 'Diunggah Oleh', key: 'uploaded_by_name', width: 32 },
    { header: 'Status Validation', key: 'validation_status', width: 24 },
    { header: 'Divalidasi Oleh', key: 'validated_by', width: 32 },
    { header: 'Waktu Validasi (UTC)', key: 'validated_at', width: 28, style: { numFmt: 'yyyy-mm-dd hh:mm:ss.000' } },
  ];
  for (const item of input.evidence) {
    if (item.period_month !== input.period) throw new Error('Evidence berasal dari periode berbeda.');
    evidence.addRow({
      file_name: requiredText(item.file_name, 'file_name'), period_month: input.period,
      uploaded_at: timestamp(item.uploaded_at),
      uploaded_by_name: requiredText(item.uploaded_by_name, 'uploaded_by_name'),
      validation_status: 'Validated', validated_by: requiredText(input.validation.validated_by, 'validated_by'),
      validated_at: timestamp(input.validation.validated_at),
    });
  }
  for (const sheet of workbook.worksheets) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } };
    sheet.getRow(1).height = 32;
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
    sheet.eachRow((row, index) => {
      if (index > 1) row.height = 30;
      row.eachCell(cell => {
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFD5DFEA' } } };
        if (index > 1) cell.alignment = { vertical: 'middle', wrapText: typeof cell.value === 'string' };
      });
    });
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    sheet.headerFooter.oddHeader = `&LMonthly Cost &R${input.period}`;
    sheet.headerFooter.oddFooter = '&LValidated &RHalaman &P / &N';
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
