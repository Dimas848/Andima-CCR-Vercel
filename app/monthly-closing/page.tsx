"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  timestamp,
  useApi,
  usePeriod,
  type Audit,
  type ValidationData,
  type CustomerData,
  type UserInfo,
} from "@/lib/c2-client";

// Cache ringan per periode & akun agar perpindahan halaman/periode tampil instan
let cachedUser: UserInfo | undefined;
const validationCache = new Map<string, ValidationData>();
const validationDetailsCache = new Map<string, CustomerData>();
const auditCache = new Map<string, Audit[]>();

function ValidationSkeleton() {
  return (
    <>
      <Card title="Status Periode">
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

      <Card title="Pemeriksaan Stempel Waktu Bukti Dokumen">
        <LoadState loading variant="table-inner" rows={4} />
      </Card>

      <Card title="Jejak Audit Pengesahan">
        <LoadState loading variant="table-inner" rows={3} />
      </Card>
    </>
  );
}

export default function ValidationPage() {
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
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    if (user.data) cachedUser = user.data;
  }, [user.data]);

  useEffect(() => {
    if (filter.period && result.data) {
      validationCache.set(filter.period, result.data);
    }
  }, [filter.period, result.data]);

  useEffect(() => {
    if (filter.period && details.data) {
      validationDetailsCache.set(filter.period, details.data);
    }
  }, [filter.period, details.data]);

  useEffect(() => {
    if (filter.period && audit.data) {
      auditCache.set(filter.period, audit.data);
    }
  }, [filter.period, audit.data]);

  const userData = user.data ?? cachedUser;
  const data = result.data ?? (filter.period ? validationCache.get(filter.period) : undefined);
  const detailsData = details.data ?? (filter.period ? validationDetailsCache.get(filter.period) : undefined);
  const auditData = audit.data ?? (filter.period ? auditCache.get(filter.period) : undefined);

  const isLoading = (!data || !userData) && (filter.loading || result.loading || user.loading);
  const isRefreshing = filter.loading || result.loading || user.loading || details.loading || audit.loading;
  const detailsLoading = !detailsData && details.loading;
  const auditLoading = !auditData && audit.loading;
  const loadError = filter.error || result.error || user.error;
  const locked = Boolean(data?.validation?.is_validated);

  const sum = (
    key: "sum_sub_total" | "sum_vat" | "sum_pph23" | "sum_others" | "sum_dip_iata" | "sum_total_cost"
  ) => data?.companies.reduce((total, row) => total + amount(row[key]), 0) ?? 0;

  const issueCount = useMemo(
    () => countRecordsIssues(detailsData?.records ?? []),
    [detailsData?.records]
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
      if (filter.period) {
        validationCache.delete(filter.period);
        auditCache.delete(filter.period);
      }
      setConfirm(false);
      setNotes("");
      setNotice(`Periode ${filter.period} berhasil divalidasi dan dikunci.`);
      result.reload();
      audit.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validasi gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Workspace title="" description="">
      <Filters
        {...filter}
        loading={isRefreshing}
        onPeriod={(value) => {
          filter.setPeriod(value);
          setNotes("");
          setNotice(undefined);
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

      {notice && <Notice>{notice}</Notice>}
      {error && !confirm && <Notice error>{error}</Notice>}

      {isLoading && !loadError && <ValidationSkeleton />}

      {!isLoading && !loadError && !filter.period && (
        <Notice>Belum ada periode yang dapat diperiksa.</Notice>
      )}

      {!isLoading && !loadError && data && (
        <>
          <Card title={`Status Periode · ${filter.period}`} action={<Status validated={locked} />}>
            <p className="text-sm">
              {data.history.length
                ? `${data.history.length} dokumen unggahan tercatat, mencakup ${data.companies.reduce(
                    (total, row) => total + Number(row.total_jobs_count),
                    0
                  )} rincian biaya.`
                : "Belum ada Laporan Penjualan Perusahaan pada periode ini."}
            </p>
            {locked ? (
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  Disahkan oleh {data.validation?.validated_by || "Identitas belum tercatat"} ·{" "}
                  {data.validation?.validated_by_role || "Peran belum tercatat"}
                </p>
                <p>{timestamp(data.validation?.validated_at)}</p>
                <p>Catatan: {data.validation?.validation_notes || "Tidak ada catatan"}</p>
                <Link className={`${buttonClass} mt-3`} href={query("/export-report", { period: filter.period })}>
                  Buka Laporan
                </Link>
              </div>
            ) : (
              <div className="mt-4">
                {userData?.canValidate ? (
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={busy || !data.companies.length || !data.history.length}
                    onClick={() => {
                      setConfirm(true);
                      setError(undefined);
                    }}
                  >
                    Validasi &amp; Kunci Data
                  </button>
                ) : (
                  <p className="text-sm text-slate-500">
                    Pengesahan tersedia untuk Manager of Accounting, Tax Manager, dan Director of Finance, Accounting &amp; Digital Transformation.
                  </p>
                )}
              </div>
            )}
          </Card>

          <Kpis
            items={[
              { label: "1. Total Perusahaan", value: number(data.companies.length), detail: "Pelanggan dalam periode" },
              { label: "2. DPP (Dasar Pengenaan Pajak)", value: money(sum("sum_sub_total")), detail: "Basis perhitungan pajak" },
              { label: "3. PPN (VAT 11%)", value: money(sum("sum_vat")), detail: "Pajak Pertambahan Nilai" },
              { label: "4. PPh 23 (2%)", value: money(sum("sum_pph23")), detail: "Dipungut oleh pelanggan" },
              { label: "5. Lain-lain", value: money(sum("sum_others")), detail: "PPh 22 / PPh 26 / biaya lain" },
              { label: "6. DIP IATA", value: money(sum("sum_dip_iata")), detail: "Biaya organisasi IATA" },
              { label: "7. Total Biaya Bulanan", value: money(sum("sum_total_cost")), detail: "Akumulasi seluruh biaya" },
              {
                label: "8. Total Kendala",
                value: detailsLoading ? "Memuat…" : `${number(issueCount)} Kendala`,
                detail: detailsLoading
                  ? "Memeriksa transaksi"
                  : issueCount > 0
                  ? "Terdapat catatan ketidaksesuaian"
                  : "Seluruh transaksi sesuai",
                alert: !detailsLoading && issueCount > 0,
              },
            ]}
          />

          <Card title="Pemeriksaan Stempel Waktu Bukti Dokumen">
            <HistoryTable rows={data.history} />
          </Card>

          <Card title="Jejak Audit Pengesahan">
            <LoadState
              loading={auditLoading}
              error={audit.error}
              onRetry={audit.reload}
              variant="table-inner"
              rows={3}
            />
            {!auditLoading && auditData && (
              <DataTable
                rows={auditData}
                rowKey={(row) => row.log_id}
                columns={[
                  { label: "Waktu", cell: (row) => timestamp(row.action_timestamp) },
                  { label: "Pengesah", cell: (row) => row.actor_name || "Belum tercatat" },
                  { label: "Jabatan", cell: (row) => row.actor_role || "Belum tercatat" },
                  { label: "Tindakan", cell: (row) => row.action_type },
                  { label: "Total Biaya", cell: (row) => money(row.total_cost_amount), numeric: true },
                  { label: "Catatan", cell: (row) => row.validation_notes || "—" },
                ]}
              />
            )}
          </Card>
        </>
      )}

      {confirm && data && (
        <Modal
          title={`Validasi & Kunci Data · ${filter.period}`}
          onClose={() => setConfirm(false)}
          busy={busy}
        >
          <Notice>
            Setelah disahkan, rincian biaya, bukti dokumen, dan status periode ini tidak dapat diubah. Total biaya yang diperiksa:{" "}
            {money(sum("sum_total_cost"))} ({issueCount} kendala terdeteksi).
          </Notice>
          <label className="block text-sm font-medium">
            Catatan pengesahan
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
              Kembali
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={busy || !notes.trim()}
              onClick={() => void lock()}
            >
              {busy ? "Mengesahkan…" : "Validasi & Kunci Data"}
            </button>
          </div>
        </Modal>
      )}
    </Workspace>
  );
}