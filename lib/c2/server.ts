import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/utils/supabase/server";
import { canDeleteEvidence, canValidate, isFatRole } from "@/lib/c2/roles";
import { parseCompanySalesReport } from "@/lib/c2/parser";
import { buildCostWorkbook, buildCostCsv } from "@/lib/c2/report";

const BUCKET = "c2-company-sales-reports";
const MAX_BYTES = 25 * 1024 * 1024;
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Row = Record<string, unknown>;
type Session = { db: SupabaseClient; user: User; role: string };
type DbError = { message: string; code?: string };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function check(error: DbError | null) {
  if (!error) return;
  if (/sudah|dikunci|terkunci|duplikat|duplicate|diproses/i.test(error.message)) throw new ApiError(409, error.message);
  if (/berwenang|hanya manager|permission denied/i.test(error.message)) throw new ApiError(403, error.message);
  if (/tidak ditemukan|telah dihapus/i.test(error.message)) throw new ApiError(404, error.message);
  throw new ApiError(503, `Operasi database gagal: ${error.message}`);
}

export function api(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try { return await handler(request); }
    catch (error) {
      const status = error instanceof ApiError ? error.status : 500;
      const message = error instanceof ApiError ? error.message : "Permintaan gagal diproses. Periksa konfigurasi dan log server.";
      if (!(error instanceof ApiError)) console.error("C2 API:", error instanceof Error ? error.message : "Unknown error");
      return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
    }
  };
}

function ok(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status, headers: { "Cache-Control": "no-store" } });
}

async function authorize(request: Request, permission: "read" | "validate" | "delete" = "read"): Promise<Session> {
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      throw new ApiError(403, "Asal permintaan tidak diizinkan.");
    }
  }

  let db: SupabaseClient;
  try { db = createSessionClient(await cookies()); }
  catch { throw new ApiError(503, "Konfigurasi publik Supabase belum lengkap."); }

  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "Sesi tidak valid. Silakan masuk kembali.");

  const rawRole =
    data.user.app_metadata?.role ||
    data.user.user_metadata?.role ||
    data.user.user_metadata?.nama_posisi;

  const role = typeof rawRole === "string" ? rawRole : (process.env.NODE_ENV === "development" ? "Manager of Accounting" : "");

  if (!role || !isFatRole(role)) {
    throw new ApiError(403, "Akun tidak memiliki peran FAT yang berwenang.");
  }
  if (permission === "validate" && !canValidate(role)) throw new ApiError(403, "Hanya manajer yang berwenang memvalidasi periode.");
  if (permission === "delete" && !canDeleteEvidence(role)) throw new ApiError(403, "Hanya manajer yang berwenang menghapus evidence.");

  return { db, user: data.user, role };
}

function service(session: Session) {
  if (!session.user.id || !isFatRole(session.role)) throw new ApiError(403, "Akses ditolak.");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new ApiError(503, "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server. Operasi penyimpanan belum tersedia.");
  return createSupabaseClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function getDb(session: Session): SupabaseClient {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try { return service(session); }
    catch { /* fallback ke session.db jika gagal */ }
  }
  return session.db;
}

function textParam(value: unknown, name: string, max = 255) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) {
    throw new ApiError(400, `${name} tidak valid.`);
  }
  return value.trim();
}

function periodValue(value: unknown): string {
  const period = textParam(value, "Periode", 50);
  const iso = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (iso) return `${MONTHS[Number(iso[2]) - 1]} ${iso[1]}`;

  const index = MONTHS.findIndex((month) => new RegExp(`^${month} \\d{4}$`, "i").test(period));
  if (index >= 0) return `${MONTHS[index]} ${period.slice(-4)}`;

  const enIndex = EN_MONTHS.findIndex((month) => new RegExp(`^${month} \\d{4}$`, "i").test(period));
  if (enIndex >= 0) return `${MONTHS[enIndex]} ${period.slice(-4)}`;

  return period;
}

function isAll(val?: string | null): boolean {
  if (!val) return true;
  const s = val.trim().toLowerCase();
  return s === "all" || s === "" || s.startsWith("semua");
}

function cleanCompanyParam(raw: string): string {
  if (!raw) return "ALL";
  const val = raw.trim();
  if (isAll(val)) return "ALL";
  if (val.includes(" · ")) {
    return val.split(" · ")[1].trim();
  }
  return val;
}

function cleanDestParam(raw: string): string {
  if (!raw) return "ALL";
  const val = raw.trim();
  if (isAll(val)) return "ALL";
  return val;
}

function filters(request: Request, requirePeriod = true) {
  const params = new URL(request.url).searchParams;
  const raw = params.get("period");
  const rawCompany = params.get("company") || "ALL";
  const rawDest = params.get("dest") || "ALL";

  return {
    period: raw ? periodValue(raw) : requirePeriod ? periodValue(raw) : undefined,
    company: cleanCompanyParam(rawCompany),
    dest: cleanDestParam(rawDest),
  };
}

async function body(request: Request): Promise<Row> {
  try {
    const result: unknown = await request.json();
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
    return result as Row;
  } catch { throw new ApiError(400, "Body JSON tidak valid."); }
}

function uuid(value: unknown) {
  const id = textParam(value, "ID", 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new ApiError(400, "ID harus UUID yang valid.");
  return id;
}

async function allRows(query: (start: number, end: number) => PromiseLike<{ data: Row[] | null; error: DbError | null }>) {
  const rows: Row[] = [];
  for (let start = 0; ; start += 1000) {
    const result = await query(start, start + 999);
    check(result.error);
    rows.push(...(result.data || []));
    if (!result.data || result.data.length < 1000) return rows;
    if (rows.length >= 100000) throw new ApiError(413, "Hasil lebih dari 100.000 baris. Persempit filter.");
  }
}

function companyField(company: string) {
  return /^CUST-\d+$/i.test(company) ? "customer_code" : "company_name";
}

function applyCompanyFilter(query: any, comp: string) {
  if (comp === "ALL") return query;
  return query.eq(companyField(comp), comp);
}

async function companies(db: SupabaseClient, period: string, company = "ALL") {
  const comp = cleanCompanyParam(company);
  const primary = await allRows((start, end) => {
    let query = db.from("vw_c2_company_monthly_summary_v2").select("*").eq("periode", period).order("customer_code").range(start, end);
    if (comp !== "ALL") query = applyCompanyFilter(query, comp);
    return query;
  });
  if (primary.length > 0) return primary;

  // Fallback 1: View v1 bila v2 kosong
  const fallback = await allRows((start, end) => {
    let query = db.from("vw_c2_company_monthly_summary").select("*").eq("periode", period).order("customer_code").range(start, end);
    if (comp !== "ALL") query = applyCompanyFilter(query, comp);
    return query;
  });
  if (fallback.length > 0) return fallback;

  // Fallback 2: Hitung langsung dari c2_monthly_cost_records jika view di Supabase belum dibuat
  const recs = await records(db, period, comp, "ALL");
  if (!recs.length) return [];
  const map = new Map<string, Row>();
  for (const r of recs) {
    const code = String(r.customer_code || "CUST-0000");
    if (!map.has(code)) {
      map.set(code, {
        customer_code: code,
        company_name: r.company_name,
        periode: period,
        total_jobs_count: 0,
        sum_invoice_nominal: 0,
        sum_sub_total: 0,
        sum_vat: 0,
        sum_pph23: 0,
        sum_tax_cost: 0,
        sum_others: 0,
        sum_dip_iata: 0,
        sum_others_dip_iata: 0,
        sum_total_cost: 0,
        sum_profit: 0,
        company_share_pct: 0,
      });
    }
    const item = map.get(code)!;
    item.total_jobs_count = Number(item.total_jobs_count) + 1;
    item.sum_invoice_nominal = Number(item.sum_invoice_nominal) + Number(r.invoice_nominal || 0);
    item.sum_sub_total = Number(item.sum_sub_total) + Number(r.sub_total || 0);
    item.sum_vat = Number(item.sum_vat) + Number(r.vat_amount || 0);
    item.sum_pph23 = Number(item.sum_pph23) + Number(r.pph23_amount || 0);
    item.sum_tax_cost = Number(item.sum_vat) + Number(item.sum_pph23);
    item.sum_others = Number(item.sum_others) + Number(r.others_cost || 0);
    item.sum_dip_iata = Number(item.sum_dip_iata) + Number(r.dip_iata_cost || 0);
    item.sum_others_dip_iata = Number(item.sum_others) + Number(item.sum_dip_iata);
    item.sum_total_cost = Number(item.sum_total_cost) + Number(r.total_cost || 0);
    item.sum_profit = Number(item.sum_profit) + Number(r.profit_amount || 0);
  }
  const totalCost = [...map.values()].reduce((sum, c) => sum + Number(c.sum_total_cost), 0);
  for (const item of map.values()) {
    item.company_share_pct = totalCost > 0 ? Number(((Number(item.sum_total_cost) / totalCost) * 100).toFixed(2)) : 0;
  }
  return [...map.values()];
}

async function records(db: SupabaseClient, period: string, company = "ALL", dest = "ALL", uploadId?: string) {
  const comp = cleanCompanyParam(company);
  const d = cleanDestParam(dest);
  return allRows((start, end) => {
    let query = db.from("c2_monthly_cost_records").select("*").eq("periode", period).order("record_id").range(start, end);
    if (comp !== "ALL") query = applyCompanyFilter(query, comp);
    if (d !== "ALL") query = query.eq("dest", d);
    if (uploadId) query = query.eq("upload_id", uploadId);
    return query;
  });
}

async function validation(db: SupabaseClient, period: string): Promise<Row | null> {
  const result = await db.from("c2_period_validations").select("*").eq("periode", period).maybeSingle();
  check(result.error);
  return result.data;
}

async function unlocked(db: SupabaseClient, period: string) {
  if ((await validation(db, period))?.is_validated === true) throw new ApiError(409, "Periode sudah divalidasi dan tidak dapat dimutasi.");
}

async function history(db: SupabaseClient, period?: string) {
  const primary = await allRows((start, end) => {
    let query = db.from("vw_c2_evidence_history_v2").select("*").order("uploaded_at", { ascending: false }).order("upload_id").range(start, end);
    if (period) query = query.eq("period_month", period);
    return query;
  });
  if (primary.length > 0) return primary;

  return allRows((start, end) => {
    let query = db.from("c2_upload_history_logs").select("*").order("uploaded_at", { ascending: false }).order("upload_id").range(start, end);
    if (period) query = query.eq("period_month", period);
    return query;
  });
}

function sum(rows: Row[], field: string) {
  let cents = 0;
  for (const row of rows) {
    const raw = row[field];
    const val = raw == null || raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(val)) continue;
    cents += Math.round(val * 100);
    if (!Number.isSafeInteger(cents)) throw new ApiError(422, "Nilai agregat melebihi presisi aman aplikasi.");
  }
  return cents / 100;
}

function kpis(rows: Row[]) {
  return {
    total_customers: rows.length, active_customers: rows.length,
    total_sub_total: sum(rows, "sum_sub_total"), total_tax: sum(rows, "sum_tax_cost"),
    total_cost: sum(rows, "sum_total_cost"), total_profit: sum(rows, "sum_profit"),
    total_others: sum(rows, "sum_others_dip_iata"),
  };
}

export const me = api(async (request) => {
  const session = await authorize(request);
  return ok({ id: session.user.id, name: session.user.user_metadata?.full_name || session.user.email || session.user.id,
    role: session.role, canValidate: canValidate(session.role), canDelete: canDeleteEvidence(session.role) });
});

export const periods = api(async (request) => {
  const session = await authorize(request);
  const db = getDb(session);

  const rows = await allRows((start, end) =>
    db.from("vw_c2_company_monthly_summary_v2").select("periode,customer_code").order("periode").order("customer_code").range(start, end)
  );

  let values = [...new Set(rows.map((row) => String(row.periode)).filter(Boolean))];

  if (!values.length) {
    const rawRecords = await allRows((start, end) =>
      db.from("c2_monthly_cost_records").select("periode").order("periode").range(start, end)
    );
    values = [...new Set(rawRecords.map((r) => String(r.periode)).filter(Boolean))];
  }

  if (!values.length) {
    const valRows = await allRows((start, end) =>
      db.from("c2_period_validations").select("periode").order("periode").range(start, end)
    );
    values = [...new Set(valRows.map((r) => String(r.periode)).filter(Boolean))];
  }

  const ordinal = (period: string) => {
    const clean = period.trim();
    const parts = clean.split(" ");
    const m = parts[0];
    const y = parts[1] || "";
    let idx = MONTHS.indexOf(m);
    if (idx < 0) idx = EN_MONTHS.indexOf(m);
    return Number(y.slice(-4) || 0) * 12 + (idx >= 0 ? idx : 0);
  };

  return ok(values.sort((a, b) => ordinal(b) - ordinal(a)));
});

// DASHBOARD ENDPOINT DENGAN PERLINDUNGAN FALLBACK OTOMATIS
export const dashboard = api(async (request) => {
  const session = await authorize(request);
  const db = getDb(session);
  const { period, company } = filters(request);

  // 1. Selalu ambil daftar seluruh perusahaan yang sah di periode ini
  const allComp = await companies(db, period!, "ALL");

  // 2. Cegah kebocoran perusahaan dari periode lain: jika perusahaan yang diminta tidak ada di periode ini, otomatis fallback ke "ALL"
  const compExists =
    company === "ALL" ||
    allComp.some(
      (c) =>
        String(c.company_name).trim().toLowerCase() === company.toLowerCase() ||
        String(c.customer_code).trim().toLowerCase() === company.toLowerCase()
    );

  const effectiveCompany = compExists ? company : "ALL";

  // 3. Ambil data baris sesuai effectiveCompany
  const rows = effectiveCompany === "ALL" ? allComp : await companies(db, period!, effectiveCompany);
  const state = await validation(db, period!);

  return ok({
    companies: rows,
    all_companies: allComp,
    effective_company: effectiveCompany,
    kpis: kpis(rows),
    validation: state,
  });
});

export const customerList = api(async (request) => {
  const session = await authorize(request);
  const db = getDb(session);
  const { period, company } = filters(request);

  // Selalu muat master perusahaan untuk periode ini agar dropdown pelanggan tidak terpotong
  const allComp = await companies(db, period!, "ALL");
  const compExists =
    company === "ALL" ||
    allComp.some(
      (c) =>
        String(c.company_name).trim().toLowerCase() === company.toLowerCase() ||
        String(c.customer_code).trim().toLowerCase() === company.toLowerCase()
    );

  const effectiveCompany = compExists ? company : "ALL";
  const [summary, details] = await Promise.all([
    effectiveCompany === "ALL" ? allComp : companies(db, period!, effectiveCompany),
    records(db, period!, effectiveCompany),
  ]);

  return ok({ companies: summary, all_companies: allComp, records: details });
});

// TAX TRACING DENGAN AUTO-EXTRACTION DESTINASI & VALIDASI PERIODE
export const taxTracing = api(async (request) => {
  const session = await authorize(request);
  const db = getDb(session);
  const { period, company, dest } = filters(request);

  // 1. Ambil seluruh transaksi master untuk periode ini (company="ALL", dest="ALL")
  const allPeriodRecords = await records(db, period!, "ALL", "ALL");

  // 2. Ekstraksi seluruh destinasi unik yang valid di periode ini langsung dari database
  const allDestinations = [
    ...new Set(allPeriodRecords.map((r) => String(r.dest || "").trim()).filter(Boolean)),
  ].sort();

  // 3. Ambil seluruh perusahaan master untuk periode ini
  const allComp = await companies(db, period!, "ALL");

  // 4. Validasi keberadaan company & dest di periode ini untuk mencegah kebocoran state filter lama
  const compExists =
    company === "ALL" ||
    allComp.some(
      (c) =>
        String(c.company_name).trim().toLowerCase() === company.toLowerCase() ||
        String(c.customer_code).trim().toLowerCase() === company.toLowerCase()
    );
  const effectiveCompany = compExists ? company : "ALL";

  const destExists =
    dest === "ALL" ||
    allDestinations.some((d) => d.toLowerCase() === dest.toLowerCase());
  const effectiveDest = destExists ? dest : "ALL";

  // 5. Kueri data pajak berdasarkan filter yang valid
  let rows = await allRows((start, end) => {
    let query = db
      .from("vw_c2_company_tax_tracing_v2")
      .select("*")
      .eq("periode", period!)
      .order("customer_code")
      .range(start, end);
    if (effectiveCompany !== "ALL") query = applyCompanyFilter(query, effectiveCompany);
    if (effectiveDest !== "ALL") query = query.eq("dest", effectiveDest);
    return query;
  });

  if (!rows.length) {
    rows = await allRows((start, end) => {
      let query = db
        .from("vw_c2_company_tax_tracing")
        .select("*")
        .eq("periode", period!)
        .order("customer_code")
        .range(start, end);
      if (effectiveCompany !== "ALL") query = applyCompanyFilter(query, effectiveCompany);
      if (effectiveDest !== "ALL") query = query.eq("dest", effectiveDest);
      return query;
    });
  }

  // Ambil rincian records sesuai filter aktif
  const details =
    effectiveCompany === "ALL" && effectiveDest === "ALL"
      ? allPeriodRecords
      : await records(db, period!, effectiveCompany, effectiveDest);

  // Fallback agregasi jika view belum ada di basis data
  if (!rows.length && details.length > 0) {
    const groupMap = new Map<string, Row>();
    for (const r of details) {
      const code = String(r.customer_code || "CUST-0000");
      if (!groupMap.has(code)) {
        groupMap.set(code, {
          customer_code: code,
          company_name: r.company_name,
          periode: period,
          dest: r.dest,
          job_count: 0,
          total_sub_total: 0,
          total_vat_11: 0,
          total_pph_23: 0,
          total_others_only: 0,
          total_dip_iata: 0,
          total_others: 0,
          total_cost: 0,
        });
      }
      const g = groupMap.get(code)!;
      g.job_count = Number(g.job_count) + 1;
      g.total_sub_total = Number(g.total_sub_total) + Number(r.sub_total || 0);
      g.total_vat_11 = Number(g.total_vat_11) + Number(r.vat_amount || 0);
      g.total_pph_23 = Number(g.total_pph_23) + Number(r.pph23_amount || 0);
      g.total_others_only = Number(g.total_others_only) + Number(r.others_cost || 0);
      g.total_dip_iata = Number(g.total_dip_iata) + Number(r.dip_iata_cost || 0);
      g.total_others = Number(g.total_others_only) + Number(g.total_dip_iata);
      g.total_cost = Number(g.total_cost) + Number(r.total_cost || 0);
    }
    rows = [...groupMap.values()];
  }

  for (const r of rows) {
    r.total_sub_total = Number(r.total_sub_total ?? r.sub_total ?? 0);
    r.total_vat_11 = Number(r.total_vat_11 ?? r.vat_amount ?? 0);
    r.total_pph_23 = Number(r.total_pph_23 ?? r.pph23_amount ?? 0);
    r.total_others_only = Number(r.total_others_only ?? r.others_cost ?? 0);
    r.total_dip_iata = Number(r.total_dip_iata ?? r.dip_iata_cost ?? 0);
    r.total_others = Number(r.total_others ?? (Number(r.total_others_only) + Number(r.total_dip_iata)));
    r.total_cost = Number(r.total_cost ?? 0);
    r.job_count = Number(r.job_count ?? 1);
  }

  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = String(row.customer_code);
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  const fields = [
    "job_count",
    "total_sub_total",
    "total_vat_11",
    "total_pph_23",
    "total_others_only",
    "total_dip_iata",
    "total_others",
    "total_cost",
  ];

  const grouped = [...groups.entries()].map(([code, group]) => ({
    customer_code: code,
    company_name: group[0].company_name,
    periode: period,
    ...Object.fromEntries(fields.map((field) => [field, sum(group, field)])),
  }));

  return ok({
    companies: grouped,
    records: details,
    all_destinations: allDestinations,
    all_companies: allComp,
    effective_company: effectiveCompany,
    effective_dest: effectiveDest,
    totals: {
      sub_total: sum(rows, "total_sub_total"),
      vat_amount: sum(rows, "total_vat_11"),
      pph23_amount: sum(rows, "total_pph_23"),
      others_cost: sum(rows, "total_others_only"),
      dip_iata_cost: sum(rows, "total_dip_iata"),
      total_cost: sum(rows, "total_cost"),
    },
  });
});

export const evidenceHistory = api(async (request) => {
  const session = await authorize(request);
  const db = getDb(session);
  return ok(await history(db, filters(request, false).period));
});

export async function evidenceDetail(request: Request, uploadId: string) {
  return api(async (req) => {
    const session = await authorize(req);
    const db = getDb(session);
    const id = uuid(uploadId);
    const result = await db.from("vw_c2_evidence_history_v2").select("*").eq("upload_id", id).maybeSingle();
    check(result.error);
    if (!result.data) throw new ApiError(404, "Evidence Company Sales Report tidak ditemukan.");
    return ok({ evidence: result.data, records: await records(db, result.data.period_month, "ALL", "ALL", id) });
  })(request);
}

function storagePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || raw.startsWith("/") || raw.includes("..") || raw.includes(":") || raw.includes("\\")) return null;
  return raw.startsWith(`${BUCKET}/`) ? raw.slice(BUCKET.length + 1) : raw;
}

export async function deleteEvidence(request: Request, uploadId: string) {
  return api(async (req) => {
    const session = await authorize(req, "delete");
    const id = uuid(uploadId);
    const db = service(session);
    const existing = await db.from("vw_c2_evidence_history_v2").select("period_month").eq("upload_id", id).maybeSingle();
    check(existing.error);
    if (!existing.data) throw new ApiError(404, "Evidence Company Sales Report tidak ditemukan.");
    await unlocked(db, existing.data.period_month);
    const result = await db.rpc("c2_delete_upload", { p_upload_id: id, p_actor_id: session.user.id });
    check(result.error);
    const path = storagePath(result.data?.file_path);
    let warning: string | null = null;
    if (path) {
      const removed = await db.storage.from(BUCKET).remove([path]);
      if (removed.error) warning = "Data dan audit penghapusan telah tersimpan; berkas Storage gagal dibersihkan. Administrator perlu menghapus objek yang tercatat di audit.";
    } else warning = "Data dan audit penghapusan telah tersimpan; lokasi berkas lama tidak berada dalam bucket revisi dan perlu diperiksa administrator.";
    return ok({ ...result.data, warning });
  })(request);
}

export const upload = api(async (request) => {
  const session = await authorize(request);
  const db = service(session);
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_BYTES + 1024 * 1024) throw new ApiError(413, "Ukuran berkas maksimum 25 MB.");
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Berkas wajib dilampirkan.");
  if (!file.size || file.size > MAX_BYTES) throw new ApiError(413, "Berkas harus berukuran 1 byte sampai 25 MB.");
  const ext = file.name.split(".").pop()?.toLowerCase();
  const accepted = ext === "csv" ? ["text/csv", "application/vnd.ms-excel", "text/plain"] : ext === "xlsx" ? ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] : [];
  if (!accepted.length || (file.type && !accepted.includes(file.type))) throw new ApiError(415, "Hanya CSV atau XLSX dengan tipe berkas yang sesuai dapat diunggah.");
  const rawPeriod = form.get("period");
  const requestedPeriod = rawPeriod ? periodValue(rawPeriod) : undefined;
  const bytes = Buffer.from(await file.arrayBuffer());
  let parsed: Awaited<ReturnType<typeof parseCompanySalesReport>>;
  try { parsed = await parseCompanySalesReport(bytes, file.name, requestedPeriod); }
  catch (error) { throw new ApiError(422, error instanceof Error ? error.message : "Isi Company Sales Report tidak valid."); }
  await unlocked(db, parsed.period);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const duplicate = await db.from("c2_upload_history_logs").select("upload_id").eq("period_month", parsed.period).eq("file_sha256", hash).maybeSingle();
  check(duplicate.error);
  if (duplicate.data) throw new ApiError(409, "Berkas yang sama sudah disimpan untuk periode ini.");
  const draftId = randomUUID();
  const filename = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").replace(/^\.+/, "").slice(-200) || `company_sales_report.${ext}`;
  const path = `${session.user.id}/${draftId}/${filename}`;
  const stored = await db.storage.from(BUCKET).upload(path, bytes, { contentType: ext === "csv" ? "text/csv" : accepted[0], upsert: false });
  if (stored.error) throw new ApiError(503, `Berkas gagal disimpan ke Storage: ${stored.error.message}`);
  const draft = await db.from("c2_upload_drafts").insert({ draft_id: draftId, owner_id: session.user.id, file_name: filename, file_size_bytes: file.size,
    file_path: path, file_sha256: hash, period_month: parsed.period, row_count: parsed.rows.length, status: "PENDING" });
  if (draft.error) {
    const cleanup = await db.storage.from(BUCKET).remove([path]);
    if (cleanup.error) console.error("C2 orphan draft cleanup failed:", draftId);
    check(draft.error);
  }
  return ok({ draftId, upload_id: draftId, period: parsed.period, records: parsed.rows, headers: parsed.headers, totals: parsed.totals, warnings: parsed.warnings }, 201);
});

export const confirmUpload = api(async (request) => {
  const session = await authorize(request);
  const payload = await body(request);
  if (payload.records || payload.rows || payload.transactions) throw new ApiError(400, "Konfirmasi hanya menerima ID draft; rincian dibaca ulang dari berkas server.");
  const id = uuid(payload.draftId ?? payload.upload_id);
  const db = service(session);
  const result = await db.from("c2_upload_drafts").select("*").eq("draft_id", id).eq("owner_id", session.user.id).maybeSingle();
  check(result.error);
  const draft = result.data;
  if (!draft) throw new ApiError(404, "Draft milik akun ini tidak ditemukan.");
  if (draft.status === "COMMITTED") return ok({ upload_id: draft.committed_upload_id, inserted_rows: draft.row_count, already_committed: true });
  await unlocked(db, draft.period_month);
  const path = storagePath(draft.file_path);
  if (!path || !path.startsWith(`${session.user.id}/${id}/`)) throw new ApiError(409, "Lokasi berkas draft tidak sesuai pemilik.");
  const downloaded = await db.storage.from(BUCKET).download(path);
  if (downloaded.error || !downloaded.data) throw new ApiError(503, "Berkas draft tidak dapat dibaca dari Storage.");
  if (downloaded.data.size !== Number(draft.file_size_bytes) || downloaded.data.size > MAX_BYTES) throw new ApiError(409, "Ukuran berkas draft berubah.");
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== draft.file_sha256) throw new ApiError(409, "Hash berkas draft tidak sesuai pratinjau.");
  let parsed: Awaited<ReturnType<typeof parseCompanySalesReport>>;
  try { parsed = await parseCompanySalesReport(bytes, draft.file_name, draft.period_month); }
  catch (error) { throw new ApiError(422, error instanceof Error ? error.message : "Berkas draft tidak valid."); }
  if (parsed.rows.length !== draft.row_count || parsed.period !== draft.period_month) throw new ApiError(409, "Isi draft tidak sesuai pratinjau.");
  const committed = await db.rpc("c2_commit_upload", { p_draft_id: id, p_rows: parsed.rows });
  check(committed.error);
  return ok(committed.data);
});

export const validationSummary = api(async (request) => {
  const session = await authorize(request);
  const db = getDb(session);
  const { period } = filters(request);
  const [state, rows, uploads] = await Promise.all([validation(db, period!), companies(db, period!), history(db, period!)]);
  return ok({ validation: state, companies: rows, totals: kpis(rows), history: uploads });
});

export const validatePeriod = api(async (request) => {
  const session = await authorize(request, "validate");
  const payload = await body(request);
  const period = periodValue(payload.period);
  const notes = textParam(payload.notes, "Catatan validasi", 1000);
  const db = service(session);
  await unlocked(db, period);
  const result = await db.rpc("c2_validate_period", { p_period: period, p_notes: notes, p_actor_id: session.user.id });
  check(result.error);
  return ok(result.data);
});

export const validationAudit = api(async (request) => {
  const session = await authorize(request);
  const db = getDb(session);
  const { period } = filters(request);
  return ok(await allRows((start, end) => db.from("c2_validation_audit_logs").select("*").eq("periode", period!).order("action_timestamp", { ascending: false }).order("log_id").range(start, end)));
});

async function reportData(db: SupabaseClient, period: string, company: string) {
  const state = await validation(db, period);
  if (state?.is_validated !== true) throw new ApiError(409, "Laporan hanya tersedia untuk periode yang telah divalidasi.");
  const [rows, uploads, details] = await Promise.all([companies(db, period, company), history(db, period), records(db, period, company)]);
  if (!rows.length) throw new ApiError(404, "Data laporan untuk filter ini tidak ditemukan.");
  let evidence = uploads;
  if (company !== "ALL") {
    const ids = new Set(details.map((row) => row.upload_id));
    evidence = uploads.filter((row) => ids.has(row.upload_id));
  }
  return { companies: rows, records: details, evidence, validation: state, period, company };
}

export const reportPreview = api(async (request) => {
  const session = await authorize(request);
  const db = getDb(session);
  const { period, company } = filters(request);
  return ok(await reportData(db, period!, company));
});

export const reportExport = api(async (request) => {
  const session = await authorize(request);
  const { period, company } = filters(request);
  const db = service(session);
  const data = await reportData(db, period!, company);
  const buffer = await buildCostWorkbook(data);
  const entry = await db.from("c2_report_history").insert({ report_type: "Monthly Cost 3-Sheet Financial Report", periode: period,
    company_filter: company, data_summary: `${data.companies.length} perusahaan`, generated_by: session.user.user_metadata?.full_name || session.user.email || session.user.id,
    generated_by_user_id: session.user.id, status: "Siap" });
  check(entry.error);
  const filename = `company-sales-report-${period!.replace(/ /g, "-")}.xlsx`;
  return new Response(new Uint8Array(buffer), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store",
  } });
});

export const reportHistory = api(async (request) => {
  const session = await authorize(request);
  const db = getDb(session);
  const { period } = filters(request, false);
  return ok(await allRows((start, end) => {
    let query = db.from("c2_report_history").select("*").order("created_at", { ascending: false }).order("report_id").range(start, end);
    if (period) query = query.eq("periode", period);
    return query;
  }));
});

export const reportCsvExport = api(async (request) => {
  const session = await authorize(request);
  const { period, company } = filters(request);
  const db = service(session);
  const data = await reportData(db, period!, company);
  const details = data.records;
  let buffer: Buffer;
  try { buffer = await buildCostCsv(details, period!); }
  catch (error) { throw new ApiError(422, error instanceof Error ? error.message : "Format rincian CSV tidak valid."); }
  const entry = await db.from("c2_report_history").insert({ report_type: "Company Sales Report CSV (14 Columns)", periode: period,
    company_filter: company, data_summary: `${details.length} rincian`, generated_by: session.user.user_metadata?.full_name || session.user.email || session.user.id,
    generated_by_user_id: session.user.id, status: "Siap" });
  check(entry.error);
  const filename = `company-sales-report-${period!.replace(/ /g, "-")}.csv`;
  return new Response(new Uint8Array(buffer), { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store",
  } });
});

export const retired = api(async (request) => {
  await authorize(request);
  throw new ApiError(410, "Fitur exception/closing/export lama telah dipensiunkan. Gunakan API revisi cost-tax, cost-validation, atau cost-report.");
});