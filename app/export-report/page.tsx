"use client";

import { useState } from "react";
import Link from "next/link";
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

// Komponen Skeleton untuk Loading State Report Page
function ReportSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Pengesahan Card Skeleton */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="h-6 w-24 rounded bg-slate-200" />
        </div>
        <div className="h-4 w-64 rounded bg-slate-100" />
        <div className="h-3 w-48 rounded bg-slate-100" />
      </div>

      {/* Summary Table Card Skeleton */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="h-4 w-60 rounded bg-slate-200" />
        <div className="h-36 w-full rounded bg-slate-100" />
      </div>

      {/* Sales Table Card Skeleton */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="h-4 w-56 rounded bg-slate-200" />
        <div className="h-48 w-full rounded bg-slate-100" />
      </div>

      {/* History Card Skeleton */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="h-4 w-48 rounded bg-slate-200" />
        <div className="h-32 w-full rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function ReportPage() {
  const filter = usePeriod();
  const [company, setCompany] = useFilter("company");
  const options = useApi<CustomerData>(
    filter.period
      ? query("/api/v1/cost-analytics/customers", {
          period: filter.period,
          company: "ALL",
        })
      : null
  );
  const result = useApi<ReportData>(
    filter.period
      ? query("/api/v1/cost-report/preview", { period: filter.period, company })
      : null
  );
  const history = useApi<ReportHistory[]>(
    filter.period
      ? query("/api/v1/cost-report/history", { period: filter.period })
      : null
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function download(format: "xlsx" | "csv", previous?: ReportHistory) {
    if (busy || (!previous && !result.data?.validation?.is_validated)) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const selected = previous
        ? {
            period: previous.periode,
            company:
              previous.company_filter === "Semua Perusahaan"
                ? "ALL"
                : previous.company_filter,
          }
        : { period: filter.period, company };
      const response = await fetch(
        query(`/api/v1/cost-report/export-${format}`, selected),
        { credentials: "same-origin", cache: "no-store" }
      );
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(
          failure?.message || `Ekspor gagal (${response.status}).`
        );
      }
      if (
        !response
          .headers.get("Content-Type")
          ?.includes(format === "xlsx" ? "spreadsheetml" : "text/csv")
      ) {
        throw new Error(
          "Server tidak mengembalikan format berkas yang diminta."
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ||
        `Monthly-Cost-${filter.period.replace(
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
        `${
          format === "xlsx" ? "Excel tiga sheet" : "CSV rincian 14 kolom"
        } berhasil dibuat dan unduhan dimulai.`
      );
      history.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unduhan gagal.");
    } finally {
      setBusy(false);
    }
  }

  const isLoading = filter.loading || result.loading;

  return (
    <Workspace
      title="Report"
      description="Pratinjau periode tervalidasi. Unduh laporan Excel tiga sheet atau rincian CSV dengan format kolom Data Upload."
      action={
        <div className="flex flex-wrap gap-2">
          {(["xlsx", "csv"] as const).map((format) => (
            <button
              key={format}
              type="button"
              className={buttonClass}
              disabled={busy || !result.data?.validation?.is_validated}
              onClick={() => void download(format)}
            >
              {busy
                ? "Menyiapkan…"
                : format === "xlsx"
                ? "Unduh Excel (.xlsx)"
                : "Unduh CSV (.csv)"}
            </button>
          ))}
        </div>
      }
    >
      <Filters
        {...filter}
        onPeriod={(value) => {
          filter.setPeriod(value);
          setError(undefined);
          setNotice(undefined);
        }}
        company={company}
        companies={options.data?.companies}
        onCompany={setCompany}
        refresh={() => {
          result.reload();
          options.reload();
          history.reload();
        }}
      />

      <LoadState
        loading={isLoading}
        error={filter.error || result.error || options.error}
        onRetry={result.reload}
      />

      {error && <Notice error>{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}

      {!filter.loading && !filter.period && !filter.error && (
        <Notice>
          Belum ada periode laporan. Unggah dan validasi Company Sales Report
          terlebih dahulu.
        </Notice>
      )}

      {isLoading && <ReportSkeleton />}

      {!isLoading && result.data && (
        <>
          <Card
            title="Pengesahan periode"
            action={
              <Status validated={result.data.validation.is_validated} />
            }
          >
            <p className="text-sm">
              {result.data.validation.validated_by ||
                "Identitas validator belum tercatat"}{" "}
              · {timestamp(result.data.validation.validated_at)}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {result.data.validation.validation_notes ||
                "Tidak ada catatan pengesahan."}
            </p>
          </Card>
          <Card title="Pratinjau ringkasan biaya, persentase, pajak, dan profit">
            <SummaryTable rows={result.data.companies} />
          </Card>
          <Card title="Pratinjau rincian CSV · 14 kolom Data Upload">
            <SalesTable records={result.data.records} />
          </Card>
          <Card title="Riwayat timestamp evidence">
            <HistoryTable rows={result.data.evidence} />
          </Card>
          <Notice>
            Isi Excel: Sheet 1 — Ringkasan &amp; Persentase Perusahaan; Sheet 2
            — Breakdown Customer Cost &amp; Pajak; Sheet 3 — Timestamp Evidence
            &amp; Status Validation.
          </Notice>
          <Notice>
            CSV berisi rincian transaksi dengan tepat 14 kolom Data Upload,
            urutan kolom tetap, encoding UTF-8, dan nominal angka tanpa pemisah
            ribuan. Filter periode dan perusahaan berlaku pada kedua format.
            Workbook Excel tiga sheet adalah format laporan, bukan berkas untuk
            diunggah ulang.
          </Notice>
        </>
      )}

      <Card title="Riwayat pembuatan laporan">
        <LoadState
          loading={history.loading}
          error={history.error}
          onRetry={history.reload}
        />
        {history.data && (
          <DataTable
            rows={history.data}
            rowKey={(row) => row.report_id}
            columns={[
              { label: "Laporan", cell: (row) => row.report_type },
              { label: "Periode", cell: (row) => row.periode },
              {
                label: "Perusahaan",
                cell: (row) =>
                  row.company_filter === "ALL"
                    ? "Semua perusahaan"
                    : row.company_filter,
              },
              {
                label: "Dibuat oleh",
                cell: (row) => row.generated_by || "Belum tercatat",
              },
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
                      onClick={() =>
                        void download(
                          row.report_type.includes("CSV") ? "csv" : "xlsx",
                          row
                        )
                      }
                    >
                      Unduh {row.report_type.includes("CSV") ? "CSV" : "Excel"}
                    </button>
                  ),
              },
            ]}
          />
        )}
      </Card>
    </Workspace>
  );
}