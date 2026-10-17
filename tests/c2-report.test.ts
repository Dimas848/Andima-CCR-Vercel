import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import { buildCostWorkbook, buildCostCsv, REPORT_SHEETS, type CostReportInput } from '../lib/c2/report';
import { parseCompanySalesReport, SALES_HEADERS } from '../lib/c2/parser';
import Papa from 'papaparse';

const input: CostReportInput = {
  period: 'Mei 2026', company: 'ALL',
  companies: [{ customer_code: 'CUST-0017', company_name: 'PT YOSSAVA GLOBAL FREIGHT', periode: 'Mei 2026', sum_invoice_nominal: '13480766.00', sum_sub_total: '12372508.00', sum_vat: '146566.00', sum_pph23: '266484.00', sum_others: '408504.00', sum_dip_iata: '0.00', sum_total_cost: '13194062.00', sum_profit: '286704.00', company_share_pct: '100.00' }],
  evidence: [{ file_name: 'company_sales_report_2026-05.xlsx', period_month: 'Mei 2026', uploaded_at: '2026-06-01T01:02:03.123Z', uploaded_by_name: 'Test uploader' }],
  validation: { periode: 'Mei 2026', is_validated: true, validated_by: 'Test validator', validated_at: '2026-06-01T02:03:04.123Z' },
};
test('Excel exactly three sheets, actual preview amounts, percentage scaling and currency formatting', async () => {
  const bytes = await buildCostWorkbook(input);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  assert.deepEqual(workbook.worksheets.map(s => s.name), [...REPORT_SHEETS]);
  const [summary, detail, evidence] = workbook.worksheets;
  assert.equal(summary.getCell('A2').value, 'CUST-0017');
  assert.equal(summary.getCell('D2').value, Number(input.companies[0].sum_total_cost));
  assert.equal(summary.getCell('E2').value, 1);
  assert.equal(summary.getCell('E2').numFmt, '0.00%');
  assert.equal(summary.getCell('D2').numFmt, '#,##0');
  assert.equal(detail.getCell('E2').value, 146566);
  assert.equal(detail.getCell('F2').value, 266484);
  assert.equal(detail.getCell('G2').value, 408504);
  assert.equal(detail.getCell('H2').value, 0);
  assert.equal(detail.getCell('I2').value, summary.getCell('D2').value);
  assert.equal(evidence.getCell('E2').value, 'Validated');
  assert.equal((evidence.getCell('C2').value as Date).toISOString(), input.evidence[0].uploaded_at);
});
test('unvalidated periods, inconsistent IDs/periods and missing amounts cannot export', async () => {
  await assert.rejects(buildCostWorkbook({ ...input, validation: { ...input.validation, is_validated: false } }));
  await assert.rejects(buildCostWorkbook({ ...input, period: 'Juni 2026' }));
  await assert.rejects(buildCostWorkbook({ ...input, companies: [] }));
  await assert.rejects(buildCostWorkbook({ ...input, companies: [{ ...input.companies[0], sum_vat: null }] }));
  await assert.rejects(buildCostWorkbook({ ...input, companies: [{ ...input.companies[0], customer_code: 'FAKE' }] }));
});
test('strings resembling formulas remain text and filtered company percentage is not rebased', async () => {
  const bytes = await buildCostWorkbook({ ...input, companies: [{ ...input.companies[0], company_name: '=HYPERLINK("https://example.invalid")', company_share_pct: 12.5 }] });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  assert.equal(typeof workbook.worksheets[0].getCell('B2').value, 'string');
  assert.equal(workbook.worksheets[0].getCell('E2').value, 0.125);
});

test('CSV export uses fixed 14-column upload schema and round-trips exact data', async () => {
  const record = { periode: 'Mei 2026', job_number: 'AENAT/2605/0101', company_name: 'PT YOSSAVA GLOBAL FREIGHT', mawb_no: '816-01953921', cw: '1218.00', dest: 'KUL', invoice_nominal: '13480766.00', sub_total: '12372508.00', vat_amount: '146566.00', pph23_amount: '266484.00', others_cost: '408504.00', dip_iata_cost: '0.00', total_cost: '13194062.00', profit_amount: '286704.00' };
  const bytes = await buildCostCsv([record], 'Mei 2026');
  assert.equal(bytes.subarray(0, 3).toString('hex'), 'efbbbf');
  const cells = Papa.parse<string[]>(bytes.toString('utf8')).data;
  assert.deepEqual(cells[0], [...SALES_HEADERS]);
  assert.equal(cells[1][12], '13194062.00');
  const parsed = await parseCompanySalesReport(bytes, 'export.csv');
  assert.deepEqual(parsed.rows, [record]);
  await assert.rejects(buildCostCsv([{ ...record, company_name: '=1+1' }], 'Mei 2026'));
  await assert.rejects(buildCostCsv([record], 'Juni 2026'));
});
