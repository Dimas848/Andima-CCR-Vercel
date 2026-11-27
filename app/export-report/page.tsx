"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
  useApi,
  useFilter,
  usePeriod,
  type ReportData,
  type CustomerData,
} from "@/lib/c2-client";
import { formatPeriodLabel, formatTimestamp, useLang } from "@/lib/c2-i18n";

interface ReportHistory {
  report_id: string;
  report_type: string;
  periode: string;
  company_filter: string;
  generated_by: string | null;
  status: string;
  created_at: string;
}

const VALIDATION_NOTE_EN: Record<string, string> = {
  "data sudah sesuai": "Data is verified and consistent",
  "semua data sudah sesuai": "All data is verified and consistent",
  "sudah sesuai": "Verified and consistent",
  "data sesuai": "Data is consistent",
  "data telah divalidasi": "Data has been validated",
  "data telah sesuai": "Data is verified and consistent",
  "tidak ada catatan": "No notes",
};

function formatValidationNote(note: string | null | undefined, isEn: boolean): string {
  const clean = note?.trim();
  if (!clean) return isEn ? "No validation notes." : "Tidak ada catatan pengesahan.";
  if (!isEn) return clean;
  return VALIDATION_NOTE_EN[clean.toLowerCase()] ?? clean;
}

function formatReportStatus(status: string, isEn: boolean): string {
  if (!isEn) return status;
  if (status.trim().toLowerCase() === "siap") return "Ready";
  return status;
}

function SuccessToast({
  title,
  lines,
  onClose,
}: {
  title: string;
  lines: string[];
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-6 top-20 z-50 w-[min(92vw,380px)] rounded-xl border border-[#74d6a8] bg-[#d6efe2] px-4 py-3.5 shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-[#064e3b]">{title}</p>
          <div className="mt-1 space-y-0.5 text-sm leading-snug text-[#047857]">
            {lines.map((line, idx) => (
              <p key={idx}>{line}</p>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          className="rounded-md p-1 text-[#064e3b]/70 transition-colors hover:bg-emerald-200/60 hover:text-[#064e3b]"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const { lang, isEn } = useLang();
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
  const [toastLines, setToastLines] = useState<string[] | null>(null);

  useEffect(() => {
    if (!toastLines) return;
    const timer = window.setTimeout(() => setToastLines(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toastLines]);

  const isLoading = filter.loading || result.loading;
  const loadError = filter.error || result.error || options.error;
  const isValidated = Boolean(result.data?.validation?.is_validated);

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
        throw new Error(
          failure?.message || (isEn ? `Export failed (${response.status}).` : `Ekspor gagal (${response.status}).`)
        );
      }
      if (!response.headers.get("Content-Type")?.includes(format === "xlsx" ? "spreadsheetml" : "text/csv")) {
        throw new Error(
          isEn
            ? "Server did not return the requested file format."
            : "Server tidak mengembalikan format berkas yang diminta."
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename =
        response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
        `${isEn ? "Monthly-Cost-Report" : "Laporan-Biaya-Bulanan"}-${filter.period.replace(
          /[^a-z0-9-]/gi,
          "-"
        )}.${format}`;

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setNotice(
        isEn
          ? `${
              format === "xlsx" ? "Three-sheet Excel workbook" : "14-column detail CSV file"
            } generated successfully and download has started.`
          : `${
              format === "xlsx" ? "Berkas Excel tiga lembar" : "Berkas CSV rincian 14 kolom"
            } berhasil dibuat dan unduhan dimulai.`
      );
      setToastLines(
        isEn
          ? [
              `You have successfully downloaded the ${format === "xlsx" ? "Excel (.xlsx)" : "CSV (.csv)"} report!`,
              `File: ${filename}`,
            ]
          : [
              `Laporan ${format === "xlsx" ? "Excel (.xlsx)" : "CSV (.csv)"} berhasil diunduh!`,
              `Berkas: ${filename}`,
            ]
      );
      history.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : isEn ? "Download failed." : "Unduhan gagal.");
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
              {busy
                ? isEn
                  ? "Preparing…"
                  : "Menyiapkan…"
                : format === "xlsx"
                ? isEn
                  ? "Download Excel (.xlsx)"
                  : "Unduh Excel (.xlsx)"
                : isEn
                ? "Download CSV (.csv)"
                : "Unduh CSV (.csv)"}
            </button>
          ))}
        </div>
      }
    >
      {toastLines && (
        <SuccessToast
          title={isEn ? "SUCCEED" : "BERHASIL"}
          lines={toastLines}
          onClose={() => setToastLines(null)}
        />
      )}

      <Filters
        {...filter}
        loading={isLoading || options.loading || history.loading}
        onPeriod={(value) => {
          filter.setPeriod(value);
          setError(undefined);
          setNotice(undefined);
        }}
        company={company}
        companies={options.data?.companies}
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
        <Notice>
          {isEn
            ? "No report period available yet. Upload and validate a Company Sales Report first."
            : "Belum ada periode laporan. Unggah dan validasi Laporan Penjualan Perusahaan terlebih dahulu."}
        </Notice>
      )}

      {!isLoading && !loadError && result.data && (
        <>
          <Card title={isEn ? "Period Validation" : "Pengesahan Periode"} action={<Status validated={isValidated} />}>
            <p className="text-sm">
              {result.data.validation?.validated_by ||
                (isEn ? "Validator identity not recorded" : "Identitas pengesah belum tercatat")}{" "}
              · {formatTimestamp(result.data.validation?.validated_at, lang)}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {formatValidationNote(result.data.validation?.validation_notes, isEn)}
            </p>
          </Card>

          <Card
            title={
              isEn
                ? "Cost, Share, Tax & Profit Summary Preview"
                : "Pratinjau Ringkasan Biaya, Persentase, Pajak, dan Keuntungan"
            }
          >
            <SummaryTable rows={result.data.companies} />
          </Card>

          <Card
            title={
              isEn
                ? "CSV Detail Preview · 14 Data Upload Columns"
                : "Pratinjau Rincian CSV · 14 Kolom Unggah Data"
            }
          >
            <SalesTable records={result.data.records} />
          </Card>

          <Card
            title={
              isEn
                ? "Document Evidence Timestamp History"
                : "Riwayat Stempel Waktu Bukti Dokumen"
            }
          >
            <HistoryTable rows={result.data.evidence} />
          </Card>

          <Notice>
            {isEn
              ? "Excel contents: Sheet 1 — Company Summary & Share; Sheet 2 — Customer Cost & Tax Breakdown; Sheet 3 — Evidence Timestamps & Validation Status."
              : "Isi Excel: Lembar 1 — Ringkasan & Persentase Perusahaan; Lembar 2 — Rincian Biaya Pelanggan & Pajak; Lembar 3 — Stempel Waktu Bukti & Status Validasi."}
          </Notice>
          <Notice>
            {isEn
              ? "The CSV file contains transaction details with the exact 14 Data Upload columns, fixed column order, UTF-8 encoding, and plain numeric amounts without thousand separators. Period and company filters apply to both formats. The three-sheet Excel file is a final report format, not meant for re-uploading."
              : "Berkas CSV berisi rincian transaksi dengan tepat 14 kolom Unggah Data, urutan kolom tetap, pengodean UTF-8, dan nominal angka tanpa pemisah ribuan. Filter periode dan perusahaan berlaku pada kedua format. Berkas Excel tiga lembar adalah format laporan akhir, bukan berkas untuk diunggah ulang."}
          </Notice>
        </>
      )}

      {!isLoading && (
        <Card title={isEn ? "Report Generation History" : "Riwayat Pembuatan Laporan"}>
          <LoadState
            loading={history.loading}
            error={history.error}
            onRetry={history.reload}
            variant="table-inner"
            rows={3}
          />
          {!history.loading && history.data && (
            <DataTable
              rows={history.data}
              rowKey={(row) => row.report_id}
              columns={[
                { label: isEn ? "Report" : "Laporan", cell: (row) => row.report_type },
                { label: isEn ? "Period" : "Periode", cell: (row) => formatPeriodLabel(row.periode, lang) },
                {
                  label: isEn ? "Company" : "Perusahaan",
                  cell: (row) =>
                    row.company_filter === "ALL" || row.company_filter === "Semua Perusahaan"
                      ? isEn
                        ? "All companies"
                        : "Semua perusahaan"
                      : row.company_filter,
                },
                {
                  label: isEn ? "Generated by" : "Dibuat oleh",
                  cell: (row) => row.generated_by || (isEn ? "Not recorded" : "Belum tercatat"),
                },
                { label: isEn ? "Time" : "Waktu", cell: (row) => formatTimestamp(row.created_at, lang) },
                { label: "Status", cell: (row) => formatReportStatus(row.status, isEn) },
                {
                  label: isEn ? "Re-download" : "Unduh ulang",
                  cell: (row) =>
                    row.periode === "Semua Periode" ? (
                      isEn ? (
                        "Legacy history format"
                      ) : (
                        "Format riwayat lama"
                      )
                    ) : (
                      <button
                        type="button"
                        className="text-sky-700 underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void download(row.report_type.includes("CSV") ? "csv" : "xlsx", row)}
                      >
                        {isEn ? "Download" : "Unduh"} {row.report_type.includes("CSV") ? "CSV" : "Excel"}
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