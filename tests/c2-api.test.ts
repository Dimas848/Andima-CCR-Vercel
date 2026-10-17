import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import ExcelJS from "exceljs";
import * as roles from "../lib/c2/roles";
import { buildCostWorkbook, buildCostCsv } from "../lib/c2/report";

// Run the actual Route Handler implementation with isolated framework/database
// boundaries. No credentials, production connections, or test hooks in server code.
const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL("../lib/c2/server.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
type Query = { source: string; operation: string; filters: Record<string, unknown>; payload?: unknown };
type Result = { data: unknown; error: { message: string } | null };
type Handler = (request: Request, id?: string) => Promise<Response>;
const owner = "12345678-1234-4123-8123-123456789abc";
const draftId = "22345678-1234-4123-8123-123456789abc";
const uploadId = "32345678-1234-4123-8123-123456789abc";
const period = "Mei 2026";
const company = {
  customer_code: "CUST-0001", company_name: "PT Contoh Uji", periode: period,
  total_jobs_count: 1, sum_invoice_nominal: "150", sum_sub_total: "100", sum_vat: "11", sum_pph23: "2",
  sum_tax_cost: "13", sum_others: "3", sum_dip_iata: "4", sum_others_dip_iata: "7", sum_total_cost: "120", sum_profit: "30", company_share_pct: "100",
};
const evidence = { upload_id: uploadId, file_name: "report.csv", period_month: period, uploaded_at: "2026-05-31T01:00:00Z", uploaded_by_name: "Test actor", status: "VALIDATED" };
const validation = { periode: period, is_validated: true, validation_status: "Validated", validated_by: "Test manager", validated_at: "2026-06-01T01:00:00Z" };

function harness(options: {
  role?: string; noUser?: boolean; userMetadataRole?: string;
  query?: (query: Query) => Result | Promise<Result>;
  bytes?: Buffer; parsed?: Record<string, unknown>;
} = {}) {
  const calls: Query[] = [];
  const parserCalls: unknown[][] = [];
  let serviceCalls = 0;
  const dispatch = async (query: Query) => {
    calls.push(structuredClone(query));
    if (options.query) return options.query(query);
    return { data: [], error: null };
  };
  const db = {
    auth: { getUser: async () => ({ data: { user: options.noUser ? null : {
      id: owner, email: "test@localhost", app_metadata: { role: options.role ?? "Accounting Associate" },
      user_metadata: { role: options.userMetadataRole },
    } }, error: null }) },
    from(table: string) {
      const query: Query = { source: table, operation: "select", filters: {} };
      const builder = {
        select() { return builder; },
        eq(key: string, value: unknown) { query.filters[key] = value; return builder; },
        order() { return builder; },
        range() { return builder; },
        maybeSingle() { return builder; },
        insert(payload: unknown) { query.operation = "insert"; query.payload = payload; return builder; },
        then(resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) { return dispatch(query).then(resolve, reject); },
      };
      return builder;
    },
    rpc(name: string, payload: unknown) { return dispatch({ source: name, operation: "rpc", filters: {}, payload }); },
    storage: { from: () => ({
      download: async () => ({ data: new Blob([new Uint8Array(options.bytes || Buffer.from("original"))]), error: null }),
      upload: async () => ({ data: {}, error: null }),
      remove: async () => ({ data: {}, error: null }),
    }) },
  };
  const compiledModule = { exports: {} as Record<string, Handler> };
  const sandbox = {
    module: compiledModule, exports: compiledModule.exports, Buffer, Request, Response, File, Blob, URL, console,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "http://localhost", SUPABASE_SERVICE_ROLE_KEY: randomUUID() } },
    require(name: string) {
      if (name === "server-only") return {};
      if (name === "next/headers") return { cookies: async () => ({}) };
      if (name === "next/server") return { NextResponse: { json: (data: unknown, init?: ResponseInit) => new Response(JSON.stringify(data), init) } };
      if (name === "@supabase/supabase-js") return { createClient: () => { serviceCalls++; return db; } };
      if (name === "@/utils/supabase/server") return { createClient: () => db };
      if (name === "@/lib/c2/roles") return roles;
      if (name === "@/lib/c2/report") return { buildCostWorkbook, buildCostCsv };
      if (name === "@/lib/c2/parser") return { parseCompanySalesReport: async (...args: unknown[]) => {
        parserCalls.push(args);
        return options.parsed || { rows: [{ periode: period, total_cost: "120.00" }], period, headers: [], totals: { total_cost: 120, profit_amount: 30 }, warnings: [] };
      } };
      if (name.startsWith("node:")) return require(name);
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  vm.runInNewContext(source, sandbox, { filename: "lib/c2/server.ts" });
  return { handlers: compiledModule.exports, calls, parserCalls, serviceCalls: () => serviceCalls };
}

function request(path = "/api?period=2026-05", method = "GET", payload?: unknown) {
  return new Request(`http://localhost${path}`, {
    method, headers: payload ? { "Content-Type": "application/json", Origin: "http://localhost" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

test("unauthenticated API is 401 and never creates a service client", async () => {
  const app = harness({ noUser: true });
  assert.equal((await app.handlers.dashboard(request())).status, 401);
  assert.equal(app.serviceCalls(), 0);
  assert.equal(app.calls.length, 0);
});

test("user-editable metadata cannot grant FAT or manager permissions", async () => {
  const absent = harness({ role: "", userMetadataRole: "Manager of Accounting" });
  assert.equal((await absent.handlers.me(request())).status, 403);
  const staff = harness({ userMetadataRole: "Manager of Accounting" });
  assert.equal((await staff.handlers.deleteEvidence(request("/api", "DELETE"), uploadId)).status, 403);
  assert.equal(staff.serviceCalls(), 0);
});

test("cross-origin mutations are rejected before any database access", async () => {
  const app = harness();
  const response = await app.handlers.confirmUpload(new Request("http://localhost/api", {
    method: "POST", headers: { Origin: "https://untrusted.example" }, body: JSON.stringify({ draftId }),
  }));
  assert.equal(response.status, 403);
  assert.equal(app.calls.length, 0);
});

test("validated evidence cannot be deleted and no mutation RPC runs", async () => {
  const app = harness({ role: "Tax Manager", query: (query) => ({
    data: query.source === "vw_c2_evidence_history_v2" ? { period_month: period } : validation, error: null,
  }) });
  assert.equal((await app.handlers.deleteEvidence(request("/api", "DELETE"), uploadId)).status, 409);
  assert.equal(app.calls.some((call) => call.operation === "rpc"), false);
});

test("validated period rejects upload before creating a draft or storage write", async () => {
  const app = harness({ query: () => ({ data: validation, error: null }) });
  const form = new FormData();
  form.set("file", new File(["source"], "report.csv", { type: "text/csv" }));
  form.set("period", "2026-05");
  assert.equal((await app.handlers.upload(new Request("http://localhost/api", { method: "POST", body: form }))).status, 409);
  assert.equal(app.calls.some((call) => call.operation !== "select"), false);
});

test("confirm checks owner and rejects posted transaction rows", async () => {
  const app = harness({ query: () => ({ data: null, error: null }) });
  assert.equal((await app.handlers.confirmUpload(request("/api", "POST", { draftId }))).status, 404);
  assert.deepEqual(app.calls[0].filters, { draft_id: draftId, owner_id: owner });
  assert.equal((await app.handlers.confirmUpload(request("/api", "POST", { draftId, rows: [] }))).status, 400);
});

test("confirm rejects changed bytes and never calls the commit RPC", async () => {
  const bytes = Buffer.from("changed!");
  const draft = { draft_id: draftId, owner_id: owner, status: "PENDING", period_month: period, file_path: `${owner}/${draftId}/report.csv`,
    file_name: "report.csv", file_size_bytes: bytes.length, file_sha256: createHash("sha256").update("original").digest("hex"), row_count: 1 };
  const app = harness({ bytes, query: (query) => ({ data: query.source === "c2_upload_drafts" ? draft : null, error: null }) });
  assert.equal((await app.handlers.confirmUpload(request("/api", "POST", { draftId }))).status, 409);
  assert.equal(app.calls.some((call) => call.operation === "rpc"), false);
  assert.equal(app.parserCalls.length, 0);
});

test("confirm reparses owned immutable source and commits using one atomic RPC", async () => {
  const bytes = Buffer.from("original");
  const draft = { draft_id: draftId, owner_id: owner, status: "PENDING", period_month: period, file_path: `${owner}/${draftId}/report.csv`,
    file_name: "report.csv", file_size_bytes: bytes.length, file_sha256: createHash("sha256").update(bytes).digest("hex"), row_count: 1 };
  const app = harness({ bytes, query: (query) => ({
    data: query.source === "c2_upload_drafts" ? draft : query.source === "c2_commit_upload" ? { upload_id: uploadId, inserted_rows: 1 } : null, error: null,
  }) });
  assert.equal((await app.handlers.confirmUpload(request("/api", "POST", { draftId }))).status, 200);
  assert.equal(app.parserCalls.length, 1);
  assert.equal(app.parserCalls[0][1], "report.csv");
  const mutations = app.calls.filter((call) => call.operation !== "select");
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].source, "c2_commit_upload");
  assert.deepEqual(mutations[0].payload, { p_draft_id: draftId, p_rows: [{ periode: period, total_cost: "120.00" }] });
});

test("validation passes the authenticated actor and preserves DB failure", async () => {
  const app = harness({ role: "Tax Manager", query: (query) => ({ data: null,
    error: query.operation === "rpc" ? { message: "Periode sudah divalidasi" } : null,
  }) });
  assert.equal((await app.handlers.validatePeriod(request("/api", "POST", { period: "2026-05", notes: "Checked source", actor_id: randomUUID() }))).status, 409);
  assert.deepEqual(app.calls.find((call) => call.operation === "rpc")?.payload, { p_period: period, p_notes: "Checked source", p_actor_id: owner });
});

test("company and destination filters apply to both tax aggregate and drilldown", async () => {
  const app = harness();
  assert.equal((await app.handlers.taxTracing(request("/api?period=2026-05&company=CUST-0001&dest=CGK"))).status, 200);
  assert.equal(app.calls.length, 2);
  for (const query of app.calls) assert.deepEqual(query.filters, { periode: period, customer_code: "CUST-0001", dest: "CGK" });
});

test("report preview and actual three-sheet XLSX use identical validated values", async () => {
  const app = harness({ query: (query) => {
    const data = query.source === "c2_period_validations" ? validation : query.source === "vw_c2_company_monthly_summary_v2" ? [company]
      : query.source === "vw_c2_evidence_history_v2" ? [evidence] : [];
    return { data, error: null };
  } });
  const preview = await app.handlers.reportPreview(request());
  assert.equal(preview.status, 200);
  const previewData = await preview.json();
  const response = await app.handlers.reportExport(request());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /spreadsheetml/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());
  assert.equal(workbook.worksheets.length, 3);
  assert.equal(workbook.worksheets[0].getCell("D2").value, Number(previewData.data.companies[0].sum_total_cost));
  assert.equal(app.calls.filter((call) => call.operation === "insert").length, 1);
  assert.equal(app.calls.find((call) => call.operation === "insert")?.source, "c2_report_history");
});

test("unvalidated reports are rejected and old export returns 410 without fake URL", async () => {
  const app = harness({ query: () => ({ data: null, error: null }) });
  assert.equal((await app.handlers.reportPreview(request())).status, 409);
  const retired = await app.handlers.retired(request("/api", "POST"));
  assert.equal(retired.status, 410);
  assert.equal("download_url" in await retired.json(), false);
});

test("CSV report uses validated filtered records, fixed upload columns and durable history", async () => {
  const row = { record_id: uploadId, upload_id: uploadId, customer_code: 'CUST-0001', periode: period, job_number: 'TEST/1', company_name: 'PT Contoh Uji', mawb_no: 'TEST-MAWB', cw: '10.00', dest: 'CGK', invoice_nominal: '150.00', sub_total: '100.00', vat_amount: '11.00', pph23_amount: '2.00', others_cost: '3.00', dip_iata_cost: '4.00', total_cost: '120.00', profit_amount: '30.00' };
  const app = harness({ query: query => ({ data: query.source === 'c2_period_validations' ? validation
    : query.source === 'vw_c2_company_monthly_summary_v2' ? [company]
    : query.source === 'vw_c2_evidence_history_v2' ? [evidence]
    : query.source === 'c2_monthly_cost_records' ? [row] : [], error: null }) });
  const response = await app.handlers.reportCsvExport(request('/api?period=2026-05&company=CUST-0001'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/csv/);
  assert.match(response.headers.get('content-disposition') || '', /\.csv/);
  const text = await response.text();
  assert.match(text, /"Periode","Job Number","Company","MAWB No\."/);
  assert.match(text, /"120\.00","30\.00"/);
  for (const query of app.calls.filter(query => query.source === 'c2_monthly_cost_records')) assert.deepEqual(query.filters, { periode: period, customer_code: 'CUST-0001' });
  const insert = app.calls.find(query => query.operation === 'insert');
  assert.equal(insert?.source, 'c2_report_history');
  assert.match(String((insert?.payload as Record<string, unknown>).report_type), /CSV/);
  const unvalidated = harness({ query: () => ({ data: null, error: null }) });
  assert.equal((await unvalidated.handlers.reportCsvExport(request())).status, 409);
  assert.equal(unvalidated.calls.some(query => query.operation === 'insert'), false);
});
