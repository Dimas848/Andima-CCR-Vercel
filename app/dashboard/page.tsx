"use client";

import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import {
  Workspace,
  Card,
  Filters,
  Kpis,
  LoadState,
  Notice,
  SummaryTable,
  Status,
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
} from "@/lib/c2-client";

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

// Komponen Skeleton untuk Loading State
function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-5 w-24 rounded bg-slate-200" />
        <div className="h-5 w-28 rounded bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <div className="h-3.5 w-20 rounded bg-slate-200" />
            <div className="h-6 w-32 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="flex items-center justify-center py-6">
            <div className="h-52 w-52 rounded-full bg-slate-200" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="h-4 w-48 rounded bg-slate-200" />
          <div className="space-y-3 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-3 w-32 rounded bg-slate-200" />
                  <div className="h-3 w-20 rounded bg-slate-200" />
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="h-4 w-36 rounded bg-slate-200" />
        <div className="h-36 w-full rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const filter = usePeriod();
  const [company, setCompany] = useFilter("company");
  const [hovered, setHovered] = useState<string | null>(null);

  // Normalisasi filter perusahaan: jika kosong, null, undefined, atau "ALL", dianggap "Semua perusahaan"
  const isAllCompany = !company || company === "ALL" || company === "Semua perusahaan";
  const activeCompany = isAllCompany ? "ALL" : company;

  // 1. Selalu ambil data master seluruh perusahaan pada periode berjalan (company: "ALL")
  const all = useApi<DashboardData>(
    filter.period
      ? query("/api/v1/cost-analytics/dashboard-summary", {
          period: filter.period,
          company: "ALL",
        })
      : null
  );

  // 2. Jika ada perusahaan spesifik yang dipilih, ambil data analitik terfilter
  const selected = useApi<DashboardData>(
    filter.period && !isAllCompany
      ? query("/api/v1/cost-analytics/dashboard-summary", {
          period: filter.period,
          company: activeCompany,
        })
      : null
  );

  // Gunakan data gabungan saat "Semua perusahaan", atau data terfilter saat perusahaan tertentu dipilih
  const result = isAllCompany ? all : selected;
  const data = result.data;
  const rows = useMemo(() => data?.companies ?? [], [data?.companies]);

  // Master list seluruh perusahaan untuk dropdown filter
  const companyOptions = useMemo(() => {
    return (all.data as any)?.all_companies ?? all.data?.companies ?? [];
  }, [all.data]);

  // Guard: Jika periode berganti dan perusahaan yang sedang terpilih tidak ada di periode baru, reset otomatis ke "ALL"
  useEffect(() => {
    if (!isAllCompany && companyOptions.length > 0) {
      const exists = companyOptions.some((c: any) => {
        const name = String(c?.company_name || "").trim().toLowerCase();
        const code = String(c?.customer_code || "").trim().toLowerCase();
        const target = String(company).trim().toLowerCase();
        return name === target || code === target || target.includes(name);
      });
      if (!exists) {
        setCompany("ALL");
      }
    }
  }, [filter.period, companyOptions, company, isAllCompany, setCompany]);

  const chartTotal = useMemo(
    () => rows.reduce((sum, row) => sum + amount(row.sum_total_cost), 0),
    [rows]
  );

  const positive = chartTotal > 0 && rows.every((row) => amount(row.sum_total_cost) >= 0);

  const slices = useMemo(() => {
    if (!rows.length) return [];
    const list = rows.map((row, index) => {
      const before = rows
        .slice(0, index)
        .reduce((sum, item) => sum + amount(item.company_share_pct), 0);
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
  const isLoading = filter.loading || result.loading;

  const getDisplayName = (row: any) =>
    row?.company_name || row?.company || row?.customer_name || row?.customer_code || "-";

  return (
    <Workspace
      title="Dashboard"
      description="Ringkasan biaya bulanan dari Company Sales Report. Seluruh nilai mengikuti nominal sumber."
      action={
        <Link href="/data-upload" className={buttonClass}>
          Unggah Company Sales Report
        </Link>
      }
    >
      <Filters
        {...filter}
        onPeriod={(val) => {
          filter.setPeriod(val);
          setCompany("ALL"); // Reset ke "Semua perusahaan" saat periode berubah
        }}
        company={isAllCompany ? "ALL" : company}
        companies={companyOptions}
        onCompany={(val) => {
          if (!val || val === "ALL" || val === "Semua perusahaan") {
            setCompany("ALL");
          } else {
            setCompany(val);
          }
        }}
        refresh={() => {
          filter.reload();
          all.reload();
          selected.reload();
        }}
      />

      <LoadState
        loading={isLoading}
        error={filter.error || result.error}
        onRetry={result.reload}
      />

      {!filter.loading && !filter.period && !filter.error && (
        <Notice>Belum ada periode biaya. Mulai dari Data Upload.</Notice>
      )}

      {/* Tampilkan Skeleton saat data sedang dimuat */}
      {isLoading && <DashboardSkeleton />}

      {!isLoading && data && (
        <>
          <div className="flex items-center gap-3 text-sm">
            <Status validated={Boolean(data.validation?.is_validated)} />
            <span className="font-medium text-slate-500">{filter.period}</span>
          </div>

          <Kpis
            items={[
              { label: "Total Customer Aktif", value: number(data.kpis.total_customers) },
              { label: "Total Sub Total Cost", value: money(data.kpis.total_sub_total) },
              { label: "Total Tax Cost", value: money(data.kpis.total_tax), detail: "VAT + Cost PPh 23" },
              { label: "Total Cost Bulanan", value: money(data.kpis.total_cost) },
              { label: "Total Profit", value: money(data.kpis.total_profit) },
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Company Cost Share (%)">
              {positive ? (
                <div className="flex flex-wrap items-center gap-6">
                  <div
                    role="img"
                    aria-label="Distribusi total biaya perusahaan; nilai tersedia pada daftar di sebelah grafik"
                    className="mx-auto flex h-52 w-52 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `conic-gradient(${slices.join(",")})` }}
                  >
                    <button
                      type="button"
                      onClick={() => setCompany("ALL")}
                      title="Klik untuk mereset ke Semua Perusahaan"
                      className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white p-4 text-center shadow-inner hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span className="text-xs text-slate-500">{focused?.customer_code || "Total terpilih"}</span>
                      <strong className="mt-1 text-sm font-bold text-slate-800">
                        {money(focused?.sum_total_cost ?? chartTotal)}
                      </strong>
                    </button>
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
                        <span className="flex-1 truncate font-medium text-slate-700">
                          {getDisplayName(row)}
                        </span>
                        <strong className="text-slate-900">{number(row.company_share_pct)}%</strong>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-slate-500">
                  Grafik porsi tersedia untuk total biaya positif tanpa komponen negatif. Nilai sumber tetap tersedia dalam tabel.
                </p>
              )}
              <p className="mt-4 text-xs text-slate-400">
                Persentase menggunakan total seluruh perusahaan pada periode. Area abu-abu adalah porsi perusahaan di luar filter. Pilih nama perusahaan untuk memfilter.
              </p>
            </Card>

            <Card title="Breakdown Cost per Customer">
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
                          {getDisplayName(row)}
                        </span>
                        <strong className="shrink-0 text-slate-900">{money(row.sum_total_cost)}</strong>
                      </div>
                      <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
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
                  <p className="py-10 text-center text-sm text-slate-500">Belum ada rincian biaya.</p>
                )}
              </div>
            </Card>
          </div>

          <Card title="Ringkasan perusahaan">
            <SummaryTable rows={rows} />
          </Card>
        </>
      )}
    </Workspace>
  );
}