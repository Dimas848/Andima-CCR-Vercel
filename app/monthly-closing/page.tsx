"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  Workspace,
  Filters,
  LoadState,
  Card,
  Kpis,
  HistoryTable,
  DataTable,
  Modal,
  Notice,
  Status,
  countRecordsIssues,
  buttonClass,
  secondaryClass,
  fieldClass,
} from "@/components/c2-workspace";
import {
  api,
  amount,
  money,
  number,
  query,
  useApi,
  usePeriod,
  type Audit,
  type ValidationData,
  type CustomerData,
  type UserInfo,
} from "@/lib/c2-client";
import { formatPeriodLabel, formatTimestamp, useLang } from "@/lib/c2-i18n";

function ValidationSkeleton() {
  const { isEn } = useLang();
  return (
    <>
      <Card title={isEn ? "Period Status" : "Status Periode"}>
        <div className="animate-[pulse_0.85s_ease-in-out_infinite] space-y-3">
          <div className="h-4 w-2/3 rounded bg-slate-200" />
          <div className="h-4 w-1/2 rounded bg-slate-200" />
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="mt-2 h-9 w-44 rounded-lg bg-slate-200" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className="animate-[pulse_0.85s_ease-in-out_infinite] rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="h-3.5 w-2/3 rounded bg-slate-200" />
            <div className="mt-3 h-6 w-1/2 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-3/4 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <Card
        title={
          isEn
            ? "Document Evidence Timestamp Verification"
            : "Pemeriksaan Stempel Waktu Bukti Dokumen"
        }
      >
        <LoadState loading variant="table-inner" rows={4} />
      </Card>

      <Card title={isEn ? "Validation Audit Trail" : "Jejak Audit Pengesahan"}>
        <LoadState loading variant="table-inner" rows={3} />
      </Card>
    </>
  );
}

export default function ValidationPage() {
  const { lang, isEn } = useLang();
  const filter = usePeriod();
  const user = useApi<UserInfo>("/api/auth/me");
  const result = useApi<ValidationData>(
    filter.period ? query("/api/v1/cost-validation/summary", { period: filter.period }) : null
  );
  const details = useApi<CustomerData>(
    filter.period ? query("/api/v1/cost-analytics/customers", { period: filter.period, company: "ALL" }) : null
  );
  const audit = useApi<Audit[]>(
    filter.period ? query("/api/v1/cost-validation/audit-logs", { period: filter.period }) : null
  );

  const [confirm, setConfirm] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [successPeriod, setSuccessPeriod] = useState<string | null>(null);

  const data = result.data;
  const isLoading = filter.loading || result.loading || user.loading;
  const loadError = filter.error || result.error || user.error;
  const locked = Boolean(data?.validation?.is_validated);
  const periodLabel = formatPeriodLabel(filter.period, lang);

  useEffect(() => {
    if (!successPeriod) return;
    const timer = window.setTimeout(() => setSuccessPeriod(null), 5000);
    return () => window.clearTimeout(timer);
  }, [successPeriod]);

  const sum = (
    key: "sum_sub_total" | "sum_vat" | "sum_pph23" | "sum_others" | "sum_dip_iata" | "sum_total_cost"
  ) => data?.companies.reduce((total, row) => total + amount(row[key]), 0) ?? 0;

  const issueCount = useMemo(
    () => countRecordsIssues(details.data?.records ?? []),
    [details.data?.records]
  );

  async function lock() {
    if (busy || !data || locked) return;
    setBusy(true);
    setError(undefined);
    try {
      await api("/api/v1/cost-validation/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: filter.period, notes }),
      });
      setConfirm(false);
      setNotes("");
      setSuccessPeriod(filter.period);
      result.reload();
      audit.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : isEn ? "Validation failed." : "Validasi gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Workspace title="" description="">
      {successPeriod && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-md rounded-2xl border border-emerald-400/80 bg-emerald-50/85 px-5 py-4 shadow-lg shadow-emerald-950/5 backdrop-blur-md sm:right-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-wide text-emerald-950">
                {isEn ? "SUCCEED" : "BERHASIL"}
              </p>
              <p className="mt-1 text-sm font-medium text-emerald-800">
                {isEn
                  ? `Period ${formatPeriodLabel(successPeriod, lang)} has been successfully validated and locked!`
                  : `Periode ${formatPeriodLabel(successPeriod, lang)} berhasil divalidasi dan dikunci!`}
              </p>
              <p className="mt-0.5 text-sm text-emerald-700">
                {isEn
                  ? "Cost data and document evidence for this period are now permanently locked."
                  : "Data biaya dan bukti dokumen periode ini kini telah terkunci permanen."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSuccessPeriod(null)}
              aria-label={isEn ? "Close notification" : "Tutup notifikasi"}
              className="rounded-lg p-1 text-emerald-700/70 transition-colors hover:bg-emerald-200/50 hover:text-emerald-950"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <Filters
        {...filter}
        loading={isLoading || audit.loading}
        onPeriod={(value) => {
          filter.setPeriod(value);
          setNotes("");
          setSuccessPeriod(null);
          setError(undefined);
        }}
        refresh={() => {
          filter.reload();
          result.reload();
          details.reload();
          audit.reload();
          user.reload();
        }}
      />

      {!isLoading && loadError && (
        <LoadState
          loading={false}
          error={loadError}
          onRetry={() => {
            result.reload();
            user.reload();
          }}
        />
      )}

      {error && !confirm && <Notice error>{error}</Notice>}

      {isLoading && !loadError && <ValidationSkeleton />}

      {!isLoading && !loadError && !filter.period && (
        <Notice>
          {isEn ? "No periods available to review yet." : "Belum ada periode yang dapat diperiksa."}
        </Notice>
      )}

      {!isLoading && !loadError && data && (
        <>
          <Card
            title={`${isEn ? "Period Status" : "Status Periode"} · ${periodLabel}`}
            action={<Status validated={locked} />}
          >
            <p className="text-sm">
              {data.history.length
                ? isEn
                  ? `${data.history.length} uploaded document(s) recorded, covering ${data.companies.reduce(
                      (total, row) => total + Number(row.total_jobs_count),
                      0
                    )} cost record(s).`
                  : `${data.history.length} dokumen unggahan tercatat, mencakup ${data.companies.reduce(
                      (total, row) => total + Number(row.total_jobs_count),
                      0
                    )} rincian biaya.`
                : isEn
                ? "No Company Sales Report uploaded for this period yet."
                : "Belum ada Laporan Penjualan Perusahaan pada periode ini."}
            </p>
            {locked ? (
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  {isEn ? "Validated by" : "Disahkan oleh"}{" "}
                  {data.validation?.validated_by || (isEn ? "Identity not recorded" : "Identitas belum tercatat")} ·{" "}
                  {data.validation?.validated_by_role || (isEn ? "Role not recorded" : "Peran belum tercatat")}
                </p>
                <p>{formatTimestamp(data.validation?.validated_at, lang)}</p>
                <p>
                  {isEn ? "Notes" : "Catatan"}:{" "}
                  {data.validation?.validation_notes || (isEn ? "No notes" : "Tidak ada catatan")}
                </p>
                <Link className={`${buttonClass} mt-3`} href={query("/export-report", { period: filter.period })}>
                  {isEn ? "Open Report" : "Buka Laporan"}
                </Link>
              </div>
            ) : (
              <div className="mt-4">
                {user.data?.canValidate ? (
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busy || !data.companies.length || !data.history.length}
                    onClick={() => {
                      setConfirm(true);
                      setError(undefined);
                    }}
                  >
                    {isEn ? "Validate & Lock Data" : "Validasi & Kunci Data"}
                  </button>
                ) : (
                  <p className="text-sm text-slate-500">
                    {isEn
                      ? "Validation is available for Manager of Accounting, Tax Manager, and Director of Finance, Accounting & Digital Transformation."
                      : "Pengesahan tersedia untuk Manager of Accounting, Tax Manager, dan Director of Finance, Accounting & Digital Transformation."}
                  </p>
                )}
              </div>
            )}
          </Card>

          <Kpis
            items={[
              {
                label: isEn ? "1. Total Companies" : "1. Total Perusahaan",
                value: number(data.companies.length),
                detail: isEn ? "Customers in period" : "Pelanggan dalam periode",
              },
              {
                label: isEn ? "2. Tax Base (DPP)" : "2. DPP (Dasar Pengenaan Pajak)",
                value: money(sum("sum_sub_total")),
                detail: isEn ? "Tax calculation basis" : "Basis perhitungan pajak",
              },
              {
                label: isEn ? "3. VAT (11%)" : "3. PPN (VAT 11%)",
                value: money(sum("sum_vat")),
                detail: isEn ? "Value-Added Tax" : "Pajak Pertambahan Nilai",
              },
              {
                label: isEn ? "4. WHT PPh 23 (2%)" : "4. PPh 23 (2%)",
                value: money(sum("sum_pph23")),
                detail: isEn ? "Withheld by customer" : "Dipungut oleh pelanggan",
              },
              {
                label: isEn ? "5. Others" : "5. Lain-lain",
                value: money(sum("sum_others")),
                detail: isEn ? "PPh 22 / PPh 26 / other costs" : "PPh 22 / PPh 26 / biaya lain",
              },
              {
                label: "6. DIP IATA",
                value: money(sum("sum_dip_iata")),
                detail: isEn ? "IATA organization fees" : "Biaya organisasi IATA",
              },
              {
                label: isEn ? "7. Total Monthly Cost" : "7. Total Biaya Bulanan",
                value: money(sum("sum_total_cost")),
                detail: isEn ? "Accumulation of all costs" : "Akumulasi seluruh biaya",
              },
              {
                label: isEn ? "8. Total Issues" : "8. Total Kendala",
                value: details.loading
                  ? isEn
                    ? "Loading…"
                    : "Memuat…"
                  : `${number(issueCount)} ${isEn ? "Issues" : "Kendala"}`,
                detail: details.loading
                  ? isEn
                    ? "Checking transactions"
                    : "Memeriksa transaksi"
                  : issueCount > 0
                  ? isEn
                    ? "Discrepancy notes detected"
                    : "Terdapat catatan ketidaksesuaian"
                  : isEn
                  ? "All transactions valid"
                  : "Seluruh transaksi sesuai",
                alert: !details.loading && issueCount > 0,
              },
            ]}
          />

          <Card
            title={
              isEn
                ? "Document Evidence Timestamp Verification"
                : "Pemeriksaan Stempel Waktu Bukti Dokumen"
            }
          >
            <HistoryTable rows={data.history} />
          </Card>

          <Card title={isEn ? "Validation Audit Trail" : "Jejak Audit Pengesahan"}>
            <LoadState
              loading={audit.loading}
              error={audit.error}
              onRetry={audit.reload}
              variant="table-inner"
              rows={3}
            />
            {!audit.loading && audit.data && (
              <DataTable
                rows={audit.data}
                rowKey={(row) => row.log_id}
                columns={[
                  { label: isEn ? "Time" : "Waktu", cell: (row) => formatTimestamp(row.action_timestamp, lang) },
                  {
                    label: isEn ? "Validator" : "Pengesah",
                    cell: (row) => row.actor_name || (isEn ? "Not recorded" : "Belum tercatat"),
                  },
                  {
                    label: isEn ? "Role" : "Jabatan",
                    cell: (row) => row.actor_role || (isEn ? "Not recorded" : "Belum tercatat"),
                  },
                  { label: isEn ? "Action" : "Tindakan", cell: (row) => row.action_type },
                  { label: isEn ? "Total Cost" : "Total Biaya", cell: (row) => money(row.total_cost_amount), numeric: true },
                  { label: isEn ? "Notes" : "Catatan", cell: (row) => row.validation_notes || "—" },
                ]}
              />
            )}
          </Card>
        </>
      )}

      {confirm && data && (
        <Modal
          title={`${isEn ? "Validate & Lock Data" : "Validasi & Kunci Data"} · ${periodLabel}`}
          onClose={() => setConfirm(false)}
          busy={busy}
        >
          <Notice>
            {isEn
              ? `Once validated, cost details, document evidence, and the status of this period cannot be modified. Total reviewed cost: ${money(
                  sum("sum_total_cost")
                )} (${issueCount} issues detected).`
              : `Setelah disahkan, rincian biaya, bukti dokumen, dan status periode ini tidak dapat diubah. Total biaya yang diperiksa: ${money(
                  sum("sum_total_cost")
                )} (${issueCount} kendala terdeteksi).`}
          </Notice>
          <label className="block text-sm font-medium">
            {isEn ? "Validation notes" : "Catatan pengesahan"}
            <textarea
              className={`${fieldClass} mt-2`}
              rows={4}
              value={notes}
              maxLength={1000}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {error && <Notice error>{error}</Notice>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className={secondaryClass}
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              {isEn ? "Back" : "Kembali"}
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={busy || !notes.trim()}
              onClick={() => void lock()}
            >
              {busy
                ? isEn
                  ? "Validating…"
                  : "Mengesahkan…"
                : isEn
                ? "Validate & Lock Data"
                : "Validasi & Kunci Data"}
            </button>
          </div>
        </Modal>
      )}
    </Workspace>
  );
}