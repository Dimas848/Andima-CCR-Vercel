import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { Readable } from 'node:stream';
import { z } from 'zod';

export const SALES_HEADERS = ['Periode', 'Job Number', 'Company', 'MAWB No.', 'CW', 'DEST', 'Invoice Nominal', 'Sub Total', 'VAT', 'Cost PPH 23', 'Others', 'DIP IATA', 'Total Cost', 'Profit'] as const;
export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_ROWS = 100_000;
export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export class SalesValidationError extends Error {
  constructor(public issues: { row: number; column?: string; message: string }[]) {
    super(issues.map(x => `Baris ${x.row}${x.column ? ` (${x.column})` : ''}: ${x.message}`).join('; '));
    this.name = 'SalesValidationError';
  }
}

export function normalizePeriod(value: unknown): string {
  const input = String(value ?? '').trim();
  const iso = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(input);
  if (iso) return `${MONTHS[Number(iso[2]) - 1]} ${iso[1]}`;
  const named = /^([A-Za-z]+) (\d{4})$/.exec(input.replace(/\s+/g, ' '));
  const month = named ? MONTHS.find(m => m.toLowerCase() === named[1].toLowerCase()) : undefined;
  if (month && named) return `${month} ${named[2]}`;
  throw new Error('Periode harus YYYY-MM atau nama bulan Indonesia dan tahun, misalnya Juni 2026.');
}

// Decimal strings keep the exact source amounts through the JSON/RPC boundary.
export function parseDecimal(value: unknown, field = 'nominal'): string {
  let input: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Angka tidak valid.');
    input = String(value);
  } else if (typeof value === 'string') {
    input = value.trim();
    if (/^-?\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(input) && field !== 'cw') {
      input = input.replaceAll('.', '').replace(',', '.');
    } else if (/^-?\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(input) && field !== 'cw') {
      input = input.replaceAll(',', '');
    } else if (/^-?\d+,\d{1,2}$/.test(input)) input = input.replace(',', '.');
  } else throw new Error('Nilai harus angka, bukan formula atau objek.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(input)) throw new Error('Wajib angka dengan maksimal 2 desimal; kosong bukan nol.');
  const negative = input.startsWith('-');
  const [whole, fraction = ''] = input.replace(/^-/, '').split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  if (normalizedWhole.length > (field === 'cw' ? 10 : 13)) throw new Error('Angka melampaui kapasitas kolom database.');
  const amount = `${normalizedWhole}.${fraction.padEnd(2, '0')}`;
  return negative && amount !== '0.00' ? `-${amount}` : amount;
}

export function decimalCents(value: string | number): bigint {
  const normalized = typeof value === 'number' ? parseDecimal(value) : value;
  if (!/^-?\d+\.\d{2}$/.test(normalized)) throw new Error('Nilai desimal internal tidak valid.');
  return BigInt(normalized.replace('.', ''));
}
export function centsNumber(cents: bigint): number {
  if (cents > BigInt(Number.MAX_SAFE_INTEGER) || cents < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Total melampaui presisi aman.');
  return Number(cents) / 100;
}

const identity = (max: number) => z.string().trim().min(1, 'Identitas wajib diisi.').max(max);
const rowSchema = z.object({
  periode: identity(50), job_number: identity(50), company_name: identity(255), mawb_no: identity(50),
  cw: z.string(), dest: identity(50), invoice_nominal: z.string(), sub_total: z.string(), vat_amount: z.string(),
  pph23_amount: z.string(), others_cost: z.string(), dip_iata_cost: z.string(), total_cost: z.string(), profit_amount: z.string(),
}).strict();
export type MonthlyCostRow = z.infer<typeof rowSchema>;
export const SALES_FIELDS = ['periode', 'job_number', 'company_name', 'mawb_no', 'cw', 'dest', 'invoice_nominal', 'sub_total', 'vat_amount', 'pph23_amount', 'others_cost', 'dip_iata_cost', 'total_cost', 'profit_amount'] as const;
const FIELDS = SALES_FIELDS;
const normalizeHeader = (x: unknown) => String(x ?? '').replace(/^\uFEFF/, '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/\.$/, '');
const HEADER_ALIASES: Record<string, string> = { 'pph 23': 'cost pph 23' };
const headerKey = (x: unknown) => HEADER_ALIASES[normalizeHeader(x)] ?? normalizeHeader(x);

async function* readSheets(buffer: Buffer) {
  // ExcelJS 4.4 streaming reader fails for valid ZIP entry orders. The document
  // reader resolves shared strings independently of order. Keep a hard expanded
  // archive limit and row limit rather than silently dropping cells on failure.
  let expanded = 0;
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { end = i; break; }
  }
  if (end < 0) throw new Error('Direktori ZIP tidak valid.');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  if (count > 2000 || buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) throw new Error('Arsip multi-disk/ZIP64 tidak didukung.');
  for (let entry = 0; entry < count; entry++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50 || (buffer.readUInt16LE(offset + 8) & 1)) throw new Error('Struktur ZIP tidak valid atau terenkripsi.');
    expanded += buffer.readUInt32LE(offset + 24);
    if (expanded > 32 * 1024 * 1024) throw new SalesValidationError([{ row: 0, message: 'Ukuran XLSX setelah dekompresi terlalu besar. Pisahkan menjadi berkas lebih kecil.' }]);
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  for (const sheet of workbook.worksheets) {
    if (sheet.rowCount > MAX_ROWS + 1) throw new SalesValidationError([{ row: 0, message: `Maksimal ${MAX_ROWS} rincian per berkas.` }]);
    yield { async *[Symbol.asyncIterator]() { for (let i = 1; i <= sheet.rowCount; i++) yield sheet.getRow(i); } };
  }
}

export async function parseCompanySalesReport(buffer: Buffer, filename: string, requestedPeriod?: string) {
  if (!buffer.length || buffer.length > MAX_FILE_SIZE) throw new SalesValidationError([{ row: 0, message: 'Ukuran berkas harus 1 byte sampai 25 MB.' }]);
  const extension = filename.toLowerCase().split('.').pop();
  if (!['csv', 'xlsx'].includes(extension ?? '')) throw new SalesValidationError([{ row: 0, message: 'Hanya CSV atau XLSX Company Sales Report yang didukung.' }]);
  const rows: MonthlyCostRow[] = [];
  const issues: SalesValidationError['issues'] = [];
  let indexes: number[] | undefined;
  let period = requestedPeriod ? normalizePeriod(requestedPeriod) : '';
  let totalCost = BigInt(0), totalProfit = BigInt(0), seenCount = 0;
  const seen = new Set<string>();
  const consume = (cells: unknown[], rowNumber: number) => {
    if (cells.every(cell => cell == null || String(cell).trim() === '')) return;
    if (!indexes) {
      const keys = cells.map(headerKey);
      const expected = SALES_HEADERS.map(headerKey);
      if (cells.length !== 14 || keys.length !== new Set(keys).size || expected.some(h => !keys.includes(h))) {
        throw new SalesValidationError([{ row: rowNumber, message: `Header harus tepat 14 kolom: ${SALES_HEADERS.join(', ')}. Periode harus menjadi kolom pada setiap baris.` }]);
      }
      indexes = expected.map(h => keys.indexOf(h));
      return;
    }
    seenCount++;
    if (seenCount > MAX_ROWS) throw new SalesValidationError([{ row: rowNumber, message: `Maksimal ${MAX_ROWS} rincian per berkas.` }]);
    if (cells.length !== 14) {
      issues.push({ row: rowNumber, message: 'Jumlah kolom baris tidak sama dengan 14 kolom header.' });
    } else {
      const mapped: Record<string, string> = {};
      for (let i = 0; i < FIELDS.length; i++) {
        const field = FIELDS[i], value = cells[indexes[i]];
        try {
          mapped[field] = i >= 6 || field === 'cw' ? parseDecimal(value, field)
            : field === 'periode' ? normalizePeriod(value)
            : typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
        } catch (error) { issues.push({ row: rowNumber, column: SALES_HEADERS[i], message: error instanceof Error ? error.message : 'Nilai tidak valid.' }); }
      }
      const parsed = rowSchema.safeParse(mapped);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) issues.push({ row: rowNumber, column: String(issue.path[0]), message: issue.message });
      } else {
        if (!period) period = parsed.data.periode;
        if (parsed.data.periode !== period) issues.push({ row: rowNumber, column: 'Periode', message: 'Satu berkas harus memiliki satu periode yang sesuai pilihan.' });
        const key = JSON.stringify(parsed.data);
        if (seen.has(key)) issues.push({ row: rowNumber, message: 'Rincian identik terulang dalam berkas. Periksa sumber sebelum mengimpor.' });
        seen.add(key);
        rows.push(parsed.data);
        totalCost += decimalCents(parsed.data.total_cost);
        totalProfit += decimalCents(parsed.data.profit_amount);
      }
    }
    if (issues.length >= 50) throw new SalesValidationError(issues.slice(0, 50));
  };
  if (extension === 'csv') {
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { throw new SalesValidationError([{ row: 0, message: 'CSV harus menggunakan UTF-8.' }]); }
    await new Promise<void>((resolve, reject) => {
      let rowNumber = 0;
      Papa.parse<string[]>(Readable.from([text]), {
        skipEmptyLines: 'greedy',
        step(result, parser) {
          try {
            rowNumber++;
            if (result.errors.length) throw new SalesValidationError(result.errors.map(e => ({ row: rowNumber, message: e.message })));
            consume(result.data, rowNumber);
          } catch (error) { parser.abort(); reject(error); }
        }, complete: () => resolve(), error: reject,
      });
    });
  } else {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new SalesValidationError([{ row: 0, message: 'Isi berkas bukan XLSX yang valid.' }]);
    let nonemptySheets = 0;
    try {
      for await (const sheet of readSheets(buffer)) {
        let foundData = false;
        for await (const row of sheet) {
          const values = Array.isArray(row.values) ? row.values.slice(1) : [];
          if (!values.some(value => value != null && String(value).trim() !== '')) continue;
          if (!foundData) { foundData = true; nonemptySheets++; }
          if (nonemptySheets > 1) throw new SalesValidationError([{ row: row.number, message: 'XLSX harus memiliki satu worksheet data; worksheet tambahan tidak boleh diabaikan.' }]);
          consume(Array.from({ length: Math.max(row.cellCount, 14) }, (_, index) => {
            const value = row.getCell(index + 1).value;
            if (value && typeof value === 'object' && 'richText' in value) return value.richText.map(r => r.text).join('');
            if (value && typeof value === 'object') {
              const failure = new SalesValidationError([{ row: row.number, column: String(index + 1), message: 'Formula, tanggal Excel, atau objek tidak didukung. Gunakan nilai tabular asli.' }]);
              throw failure;
            }
            return value ?? '';
          }), row.number);
        }
      }
    } catch (error) {
      if (error instanceof SalesValidationError) throw error;
      const failure = new SalesValidationError([{ row: 0, message: 'XLSX rusak atau tidak dapat dibaca.' }]);
      failure.cause = error;
      throw failure;
    }
  }
  if (!rows.length && !issues.length) issues.push({ row: 0, message: 'Berkas tidak berisi rincian data.' });
  if (issues.length) throw new SalesValidationError(issues);
  return { rows, period, headers: [...SALES_HEADERS], totals: { total_cost: centsNumber(totalCost), profit_amount: centsNumber(totalProfit) }, warnings: [] as string[] };
}
