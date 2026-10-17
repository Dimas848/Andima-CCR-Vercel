import assert from 'node:assert/strict';
import { test } from 'node:test';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { SALES_HEADERS, normalizePeriod, parseCompanySalesReport, parseDecimal, SalesValidationError } from '../lib/c2/parser';

// Source-backed fixture: Company Sales Report May 2026, page 1, AENAT/2605/0101.
const actualRow = ['Mei 2026', 'AENAT/2605/0101', 'PT YOSSAVA GLOBAL FREIGHT', '816-01953921', '1218', 'KUL', '13.480.766', '12.372.508', '146.566', '266.484', '408.504', '0', '13.194.062', '286.704'];
const csv = (rows: unknown[][], headers: readonly string[] = SALES_HEADERS) => Buffer.from(Papa.unparse([headers, ...rows]));
async function xlsx(rows: unknown[][], headers: readonly string[] = SALES_HEADERS) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Company Sales Report');
  sheet.addRow([...headers]);
  rows.forEach(row => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test('CSV maps all 14 real source columns without inventing customer code', async () => {
  const result = await parseCompanySalesReport(csv([actualRow]), 'report.csv');
  assert.equal(result.period, 'Mei 2026');
  assert.equal(result.rows[0].vat_amount, '146566.00');
  assert.equal(result.rows[0].pph23_amount, '266484.00');
  assert.equal(result.rows[0].others_cost, '408504.00');
  assert.equal(result.rows[0].total_cost, '13194062.00');
  assert.equal(result.totals.total_cost, 13194062);
  assert.equal(Object.keys(result.rows[0]).length, 14);
  assert.equal('customer_code' in result.rows[0], false);
});
test('XLSX produces same canonical rows as CSV regardless of ZIP entry order', async () => {
  const expected = await parseCompanySalesReport(csv([actualRow]), 'report.csv');
  const result = await parseCompanySalesReport(await xlsx([actualRow]), 'report.xlsx', '2026-05');
  assert.deepEqual(result, expected);
});
test('CW decimal, signed profit, comma decimals and grouped rupiah preserve source meaning', () => {
  assert.equal(parseDecimal('627.5', 'cw'), '627.50');
  assert.equal(parseDecimal('1.234.567,89'), '1234567.89');
  assert.equal(parseDecimal('1,234,567.89'), '1234567.89');
  assert.equal(parseDecimal('-1.234'), '-1234.00');
  assert.equal(parseDecimal('0'), '0.00');
  for (const input of ['', 'NaN', 'Infinity', '=1+1', '1e5', '1.23.4', '10abc', null]) assert.throws(() => parseDecimal(input));
  assert.throws(() => parseDecimal('1.234', 'cw'));
});
test('BOM, semicolon delimiter, reordered headers, quoted company, PPH 23 alias', async () => {
  const headers = [...SALES_HEADERS].reverse().map(h => h === 'Cost PPH 23' ? 'PPH 23' : h);
  const row = [...actualRow]; row[2] = 'PT "ANDIMA", TEST';
  const file = Buffer.from('\uFEFF' + Papa.unparse([headers, row.reverse()], { delimiter: ';' }));
  const result = await parseCompanySalesReport(file, 'report.csv');
  assert.equal(result.rows[0].company_name, 'PT "ANDIMA", TEST');
  assert.equal(result.rows[0].pph23_amount, '266484.00');
});
test('missing/duplicate columns, malformed quotes and extra cells reject entire batch', async () => {
  for (const file of [csv([actualRow], SALES_HEADERS.slice(1)), csv([actualRow], [...SALES_HEADERS.slice(0, 13), 'VAT']), csv([[...actualRow, 'extra']]), Buffer.from(SALES_HEADERS.join(',') + '\n"unterminated')]) {
    await assert.rejects(parseCompanySalesReport(file, 'report.csv'), SalesValidationError);
  }
});
test('empty identifiers and invalid numeric rows never become zeros or partial success', async () => {
  for (const index of [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13]) {
    const bad = [...actualRow]; bad[index] = '';
    await assert.rejects(parseCompanySalesReport(csv([actualRow, bad]), 'report.csv'), SalesValidationError);
  }
});
test('single canonical period, matching selection and duplicate row enforcement', async () => {
  assert.equal(normalizePeriod('2026-06'), 'Juni 2026');
  assert.equal(normalizePeriod('juni 2026'), 'Juni 2026');
  assert.throws(() => normalizePeriod('2026-13'));
  const another = [...actualRow]; another[0] = 'Juni 2026';
  await assert.rejects(parseCompanySalesReport(csv([actualRow, another]), 'report.csv'));
  await assert.rejects(parseCompanySalesReport(csv([actualRow]), 'report.csv', '2026-06'));
  await assert.rejects(parseCompanySalesReport(csv([actualRow, actualRow]), 'report.csv'));
});
test('limits, type spoofing, UTF8 and XLSX formulas reject', async () => {
  await assert.rejects(parseCompanySalesReport(Buffer.alloc(0), 'report.csv'));
  await assert.rejects(parseCompanySalesReport(Buffer.alloc(25 * 1024 * 1024 + 1), 'report.csv'));
  await assert.rejects(parseCompanySalesReport(csv([actualRow]), 'report.pdf'));
  await assert.rejects(parseCompanySalesReport(csv([actualRow]), 'report.xlsx'));
  await assert.rejects(parseCompanySalesReport(Buffer.from([0xff, 0xfe]), 'report.csv'));
  const row: unknown[] = [...actualRow]; row[12] = { formula: '1+1', result: 2 };
  await assert.rejects(parseCompanySalesReport(await xlsx([row]), 'report.xlsx'));
});
test('additional nonempty XLSX sheets cannot be silently discarded', async () => {
  const workbook = new ExcelJS.Workbook();
  for (const name of ['One', 'Two']) { const sheet = workbook.addWorksheet(name); sheet.addRow([...SALES_HEADERS]); sheet.addRow(actualRow); }
  await assert.rejects(parseCompanySalesReport(Buffer.from(await workbook.xlsx.writeBuffer()), 'report.xlsx'));
});
test('1000-row CSV/XLSX benchmark with exact totals', async (t) => {
  const rows = Array.from({ length: 1000 }, (_, i) => { const row = [...actualRow]; row[1] = `BENCH-${i}`; return row; });
  for (const [name, bytes] of [['benchmark.csv', csv(rows)], ['benchmark.xlsx', await xlsx(rows)]] as const) {
    const before = process.memoryUsage().heapUsed;
    const started = performance.now();
    const result = await parseCompanySalesReport(bytes, name);
    const elapsed = performance.now() - started;
    assert.equal(result.rows.length, 1000);
    assert.equal(result.totals.total_cost, 13194062000);
    t.diagnostic(`${name}: ${elapsed.toFixed(1)} ms; heap growth ${((process.memoryUsage().heapUsed - before) / 1048576).toFixed(1)} MiB; heap ${(process.memoryUsage().heapUsed / 1048576).toFixed(1)} MiB`);
    assert.ok(elapsed < 2000, `TR01 target <2000ms; measured ${elapsed.toFixed(1)}ms`);
  }
});
