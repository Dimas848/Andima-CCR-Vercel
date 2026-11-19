"use client";

import { useEffect, useState } from "react";
import {
  Workspace,
  Filters,
  Card,
  LoadState,
  Notice,
  SummaryTable,
  SalesTable,
  HistoryTable,
  DataTable,
  Status,
  buttonClass,
} from "@/components/c2-workspace";
import {
  query,
  timestamp,
  useApi,
  useFilter,
  usePeriod,
  type ReportData,
  type CustomerData,
} from "@/lib/c2-client";

interface ReportHistory {
  report_id: string;
  report_type: string;
  periode: string;
  company_filter: string;
  generated_by: string | null;
  status: string;
  created_at: string;
}

// Cache ringan per periode & filter agar perpindahan halaman/filter tampil instan
const reportOptionsCache = new Map<string, CustomerData>();
const reportPreviewCache = new Map<string, ReportData>();
const reportHistoryCache = new Map<string, ReportHistory[]>();

export default function ReportPage() {
  const filter = usePeriod();
  const [company, setCompany] = useFilter("company");
  const options = useApi<CustomerData>(
    filter.period ? query("/api/v1/cost-analytics/customers", { period: filter.period, company: "ALL" }) : null
  );
  const result = useApi<ReportData>(
    filter.period ? query("/api/v1/cost-report/preview", { period: filter.period, company }) : null
  );
  const history = useApi<ReportHistory[]>(
    filter.period ? query("/api/v1/cost-report/history", { period: filter.period }) : null
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const cacheKey = filter.period ? `${filter.period}|${company}` : "";

  useEffect(() => {
    if (filter.period && options.data) {
      reportOptionsCache.set(filter.period, options.data);
    }
  }, [filter.period, options.data]);

  useEffect(() => {
    if (cacheKey && result.data) {
      reportPreviewCache.set(cacheKey, result.data);
    }
  }, [cacheKey, result.data]);

  useEffect(() => {
    if (filter.period && history.data) {
      reportHistoryCache.set(filter.period, history.data);
    }
  }, [filter.period, history.data]);

  const optionsData = options.data ?? (filter.period ? reportOptionsCache.get(filter.period) : undefined);
  const data =
    result.data ??
    (cacheKey ? reportPreviewCache.get(cacheKey) : undefined) ??
    (filter.period ? reportPreviewCache.get(`${filter.period}|ALL`) : undefined);
  const historyData = history.data ?? (filter.period ? reportHistoryCache.get(filter.period) : undefined);

  const loadError = filter.error || result.error || options.error;
  const isLoading = !data && !loadError && (filter.loading || result.loading);
  const isRefreshing = filter.loading || result.loading || options.loading || history.loading;
  const isHistoryLoading = !historyData && history.loading;
  const isValidated = Boolean(data?.validation?.is_validated);

  async function download(format: "xlsx" | "csv", previous?: ReportHistory) {
    if (busy || (!previous && !isValidated)) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const selected = previous
        ? {
            period: previous.periode,
            company: previous.company_filter === "Semua Perusahaan" ? "ALL" : previous.company_filter,
          }
        : { period: filter.period, company };

      const response = await fetch(query(`/api/v1/cost-report/export-${format}`, selected), {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.message || `Ekspor gagal (${response.status}).`);
      }
      if (!response.headers.get("Content-Type")?.includes(format === "xlsx" ? "spreadsheetml" : "text/csv")) {
        throw new Error("Server tidak mengembalikan format berkas yang diminta.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
        `Laporan-Biaya-Bulanan-${filter.period.replace(/[^a-z0-9-]/gi, "-")}.${format}`;

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setNotice(
        `${format === "xlsx" ? "Berkas Excel tiga lembar" : "Berkas CSV rincian 14 kolom"} berhasil dibuat dan unduhan dimulai.`
      );
      if (filter.period) reportHistoryCache.delete(filter.period);
      history.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unduhan gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Workspace
      title=""
      description=""
      action={
        <div className="flex flex-wrap gap-2">
          {(["xlsx", "csv"] as const).map((format) => (
            <button
              key={format}
              type="button"
              className={buttonClass}
              disabled={busy || isLoading || !isValidated}
              onClick={() => void download(format)}
            >
              {busy ? "Menyiapkan…" : format === "xlsx" ? "Unduh Excel (.xlsx)" : "Unduh CSV (.csv)"}
            </button>
          ))}
        </div>
      }
    >
      <Filters
        {...filter}
        loading={isRefreshing}
        onPeriod={(value) => {
          filter.setPeriod(value);
          setError(undefined);
          setNotice(undefined);
        }}
        company={company}
        companies={optionsData?.companies}
        onCompany={setCompany}
        refresh={() => {
          filter.reload();
          result.reload();
          options.reload();
          history.reload();
        }}
      />

      <LoadState
        loading={isLoading}
        error={!isLoading ? loadError : undefined}
        onRetry={result.reload}
        variant="report"
      />

      {error && <Notice error>{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}

      {!isLoading && !loadError && !filter.period && (
        <Notice>Belum ada periode laporan. Unggah dan validasi Laporan Penjualan Perusahaan terlebih dahulu.</Notice>
      )}

      {!isLoading && !loadError && data && (
        <>
          <Card title="Pengesahan Periode" action={<Status validated={isValidated} />}>
            <p className="text-sm">
              {data.validation?.validated_by || "Identitas pengesah belum tercatat"} ·{" "}
              {timestamp(data.validation?.validated_at)}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {data.validation?.validation_notes || "Tidak ada catatan pengesahan."}
            </p>
          </Card>

          <Card title="Pratinjau Ringkasan Biaya, Persentase, Pajak, dan Keuntungan">
            <SummaryTable rows={data.companies} />
          </Card>

          <Card title="Pratinjau Rincian CSV · 14 Kolom Unggah Data">
            <SalesTable records={data.records} />
          </Card>

          <Card title="Riwayat Stempel Waktu Bukti Dokumen">
            <HistoryTable rows={data.evidence} />
          </Card>

          <Notice>
            Isi Excel: Lembar 1 — Ringkasan &amp; Persentase Perusahaan; Lembar 2 — Rincian Biaya Pelanggan &amp; Pajak;
            Lembar 3 — Stempel Waktu Bukti &amp; Status Validasi.
          </Notice>
          <Notice>
            Berkas CSV berisi rincian transaksi dengan tepat 14 kolom Unggah Data, urutan kolom tetap, pengodean UTF-8,
            dan nominal angka tanpa pemisah ribuan. Filter periode dan perusahaan berlaku pada kedua format. Berkas Excel
            tiga lembar adalah format laporan akhir, bukan berkas untuk diunggah ulang.
          </Notice>
        </>
      )}

      {!isLoading && (
        <Card title="Riwayat Pembuatan Laporan">
          <LoadState
            loading={isHistoryLoading}
            error={history.error}
            onRetry={history.reload}
            variant="table-inner"
            rows={3}
          />
          {!isHistoryLoading && historyData && (
            <DataTable
              rows={historyData}
              rowKey={(row) => row.report_id}
              columns={[
                { label: "Laporan", cell: (row) => row.report_type },
                { label: "Periode", cell: (row) => row.periode },
                {
                  label: "Perusahaan",
                  cell: (row) =>
                    row.company_filter === "ALL" || row.company_filter === "Semua Perusahaan"
                      ? "Semua perusahaan"
                      : row.company_filter,
                },
                { label: "Dibuat oleh", cell: (row) => row.generated_by || "Belum tercatat" },
                { label: "Waktu", cell: (row) => timestamp(row.created_at) },
                { label: "Status", cell: (row) => row.status },
                {
                  label: "Unduh ulang",
                  cell: (row) =>
                    row.periode === "Semua Periode" ? (
                      "Format riwayat lama"
                    ) : (
                      <button
                        type="button"
                        className="text-sky-700 underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void download(row.report_type.includes("CSV") ? "csv" : "xlsx", row)}
                      >
                        Unduh {row.report_type.includes("CSV") ? "CSV" : "Excel"}
                      </button>
                    ),
                },
              ]}
            />
          )}
        </Card>
      )}
    </Workspace>
  );
}