"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  Workspace,
  Card,
  Filters,
  Kpis,
  LoadState,
  Notice,
  SummaryTable,
  Status,
  countRecordsIssues,
  buttonClass,
} from "@/components/c2-workspace";
import {
  amount,
  money,
  number,
  query,
  useApi,
  useFilter,
  usePeriod,
  type DashboardData,
  type CustomerData,
} from "@/lib/c2-client";
import { formatPeriodLabel, useLang } from "@/lib/c2-i18n";

const colors = [
  "#087ebd",
  "#179c77",
  "#f59e0b",
  "#7c3aed",
  "#e45c79",
  "#0891b2",
  "#4f46e5",
  "#65a30d",
];

function DashboardSkeleton() {
  const { isEn } = useLang();
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={isEn ? "Loading dashboard" : "Memuat dasbor"}
      className="space-y-6 animate-[pulse_0.85s_ease-in-out_infinite]"
    >
      <div className="flex items-center gap-3">
        <div className="h-6 w-32 rounded-full bg-slate-200" />
        <div className="h-4 w-28 rounded bg-slate-200" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 border-t-4 border-t-sky-600/40 bg-white p-4 shadow-sm"
          >
            <div className="h-3.5 w-36 rounded bg-slate-200" />
            <div className="mt-3 h-7 w-40 rounded bg-slate-200" />
            <div className="mt-2 h-2.5 w-24 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 h-5 w-48 rounded bg-slate-200" />
          <div className="flex flex-wrap items-center gap-6">
            <div className="mx-auto flex h-52 w-52 shrink-0 items-center justify-center rounded-full bg-slate-200">
              <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white p-4 shadow-inner">
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-28 rounded bg-slate-200" />
              </div>
            </div>
            <div className="min-w-44 flex-1 space-y-2.5 pr-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 rounded p-1.5">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-200" />
                  <div className="h-3.5 flex-1 rounded bg-slate-200" />
                  <div className="h-3.5 w-10 rounded bg-slate-200" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 h-3 w-3/4 rounded bg-slate-100" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 h-5 w-56 rounded bg-slate-200" />
          <div className="space-y-3.5 pr-1">
            {[92, 76, 64, 52, 40, 28].map((width, i) => (
              <div key={i} className="rounded p-1.5">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="h-3.5 w-48 rounded bg-slate-200" />
                  <div className="h-3.5 w-28 rounded bg-slate-200" />
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-200" style={{ width: `${width}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 h-5 w-44 rounded bg-slate-200" />
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-8 gap-4 bg-slate-50 px-4 py-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-3.5 rounded bg-slate-200" />
            ))}
          </div>
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 5 }).map((_, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-8 items-center gap-4 px-4 py-3.5">
                <div className="space-y-1.5">
                  <div className="h-3 w-16 rounded bg-slate-200" />
                  <div className="h-3.5 w-32 rounded bg-slate-100" />
                </div>
                {Array.from({ length: 7 }).map((__, colIdx) => (
                  <div key={colIdx} className="ml-auto h-3.5 w-20 rounded bg-slate-100" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { lang, isEn } = useLang();
  const filter = usePeriod();
  const [company, setCompany] = useFilter("company");
  const [hovered, setHovered] = useState<string | null>(null);

  const all = useApi<DashboardData>(
    filter.period
      ? query("/api/v1/cost-analytics/dashboard-summary", {
          period: filter.period,
          company: "ALL",
        })
      : null
  );

  const details = useApi<CustomerData>(
    filter.period
      ? query("/api/v1/cost-analytics/customers", {
          period: filter.period,
          company: "ALL",
        })
      : null
  );

  const data = all.data;
  const isLoading = filter.loading || all.loading;
  const errorMsg = filter.error || all.error;

  const allCompanies = useMemo(() => data?.companies ?? [], [data?.companies]);
  const rows = useMemo(() => {
    if (company === "ALL") return allCompanies;
    return allCompanies.filter((row) => row.company_name === company);
  }, [allCompanies, company]);

  const sum = (
    key: "sum_sub_total" | "sum_vat" | "sum_pph23" | "sum_others" | "sum_dip_iata" | "sum_total_cost"
  ) => rows.reduce((total, row) => total + amount(row[key]), 0);

  const issueCount = useMemo(() => {
    const records = details.data?.records ?? [];
    const scoped = company === "ALL" ? records : records.filter((r) => r.company_name === company);
    return countRecordsIssues(scoped);
  }, [details.data?.records, company]);

  const chartTotal = useMemo(
    () => rows.reduce((acc, row) => acc + amount(row.sum_total_cost), 0),
    [rows]
  );

  const positive = chartTotal > 0 && rows.every((row) => amount(row.sum_total_cost) >= 0);

  const slices = useMemo(() => {
    if (!rows.length) return [];
    const list = rows.map((row, index) => {
      const before = rows
        .slice(0, index)
        .reduce((acc, item) => acc + amount(item.company_share_pct), 0);
      return `${colors[index % colors.length]} ${before}% ${before + amount(row.company_share_pct)}%`;
    });
    const shownShare = rows.reduce((total, row) => total + amount(row.company_share_pct), 0);
    if (shownShare < 100) list.push(`#e2e8f0 ${shownShare}% 100%`);
    return list;
  }, [rows]);

  const maximum = useMemo(() => {
    if (!rows.length) return 1;
    return Math.max(1, ...rows.map((row) => Math.abs(amount(row.sum_total_cost))));
  }, [rows]);

  const focused = rows.find((row) => row.customer_code === hovered);

  return (
    <Workspace
      title=""
      description=""
      action={
        <Link href="/data-upload" className={buttonClass}>
          {isEn ? "Upload Sales Report" : "Unggah Laporan Penjualan"}
        </Link>
      }
    >
      <Filters
        {...filter}
        loading={isLoading}
        onPeriod={filter.setPeriod}
        company={company}
        companies={allCompanies}
        onCompany={setCompany}
        refresh={() => {
          filter.reload();
          all.reload();
          details.reload();
        }}
      />

      {errorMsg && <LoadState loading={false} error={errorMsg} onRetry={all.reload} />}
      {isLoading && !errorMsg && <DashboardSkeleton />}

      {!isLoading && !filter.period && !errorMsg && (
        <Notice>
          {isEn
            ? "No cost periods yet. Start from the Data Upload menu."
            : "Belum ada periode biaya. Mulai dari menu Unggah Data."}
        </Notice>
      )}

      {!isLoading && data && (
        <>
          <div className="flex items-center gap-3 text-sm">
            <Status validated={Boolean(data.validation?.is_validated)} />
            <span className="font-medium text-slate-500">{formatPeriodLabel(filter.period, lang)}</span>
          </div>

          <Kpis
            items={[
              {
                label: isEn ? "1. Total Companies" : "1. Total Perusahaan",
                value: number(rows.length),
                detail: isEn ? "Active customers this period" : "Pelanggan aktif periode ini",
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
                    ? "Review required in details"
                    : "Perlu pemeriksaan pada rincian"
                  : isEn
                  ? "All transactions valid"
                  : "Seluruh transaksi sesuai",
                alert: !details.loading && issueCount > 0,
              },
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-2">
            <Card title={isEn ? "Company Cost Share (%)" : "Porsi Biaya Perusahaan (%)"}>
              {positive ? (
                <div className="flex flex-wrap items-center gap-6">
                  <div
                    role="img"
                    aria-label={
                      isEn
                        ? "Company cost distribution; values available in the list beside the chart"
                        : "Distribusi total biaya perusahaan; nilai tersedia pada daftar di sebelah grafik"
                    }
                    className="mx-auto flex h-52 w-52 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `conic-gradient(${slices.join(",")})` }}
                  >
                    <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white p-4 text-center shadow-inner">
                      <span className="text-xs text-slate-500">
                        {focused?.customer_code || (isEn ? "Selected total" : "Total terpilih")}
                      </span>
                      <strong className="mt-1 text-sm font-bold text-slate-800">
                        {money(focused?.sum_total_cost ?? chartTotal)}
                      </strong>
                    </div>
                  </div>

                  <div className="max-h-72 min-w-44 flex-1 space-y-2 overflow-y-auto pr-1">
                    {rows.map((row, index) => (
                      <button
                        type="button"
                        key={row.customer_code}
                        onMouseEnter={() => setHovered(row.customer_code)}
                        onFocus={() => setHovered(row.customer_code)}
                        onMouseLeave={() => setHovered(null)}
                        onBlur={() => setHovered(null)}
                        onClick={() => setCompany(row.company_name)}
                        className={`flex w-full items-start gap-2 rounded p-1.5 text-left text-xs transition-colors hover:bg-sky-50 ${
                          hovered === row.customer_code ? "bg-sky-50 ring-1 ring-sky-300" : ""
                        }`}
                      >
                        <span
                          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: colors[index % colors.length] }}
                        />
                        <span className="flex-1 truncate font-medium text-slate-700">{row.company_name}</span>
                        <strong className="text-slate-900">{number(row.company_share_pct)}%</strong>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-slate-500">
                  {isEn
                    ? "Share chart is available for positive total costs without negative components. Source values remain available in the table."
                    : "Grafik porsi tersedia untuk total biaya positif tanpa komponen negatif. Nilai sumber tetap tersedia dalam tabel."}
                </p>
              )}
              <p className="mt-4 text-xs text-slate-400">
                {isEn
                  ? "Percentages use the total of all companies in the period. Gray area represents companies outside the filter. Click a company name to filter."
                  : "Persentase menggunakan total seluruh perusahaan pada periode. Area abu-abu adalah porsi perusahaan di luar filter. Pilih nama perusahaan untuk memfilter."}
              </p>
            </Card>

            <Card title={isEn ? "Cost Comparison per Customer" : "Perbandingan Biaya per Pelanggan"}>
              <div className="max-h-80 space-y-3.5 overflow-y-auto pr-1">
                {rows.map((row) => {
                  const costVal = amount(row.sum_total_cost);
                  const barWidth = Math.min(100, Math.max(2, (Math.abs(costVal) / maximum) * 100));

                  return (
                    <Link
                      key={row.customer_code}
                      href={query("/customer-cost", { period: filter.period, company: row.company_name })}
                      className="group block rounded p-1.5 transition-colors hover:bg-sky-50"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="truncate font-medium text-slate-700 group-hover:text-sky-700">
                          {row.company_name}
                        </span>
                        <strong className="shrink-0 text-slate-900">{money(row.sum_total_cost)}</strong>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            costVal < 0 ? "bg-rose-500" : "bg-sky-600"
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}

                {!rows.length && (
                  <p className="py-10 text-center text-sm text-slate-500">
                    {isEn ? "No cost details available yet." : "Belum ada rincian biaya."}
                  </p>
                )}
              </div>
            </Card>
          </div>

          <Card title={isEn ? "Company Cost & Tax Summary" : "Ringkasan Biaya & Pajak Perusahaan"}>
            <SummaryTable rows={rows} />
          </Card>
        </>
      )}
    </Workspace>
  );
}