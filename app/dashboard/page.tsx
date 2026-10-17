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

export default function DashboardPage() {
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

  const selected = useApi<DashboardData>(
    filter.period && company !== "ALL"
      ? query("/api/v1/cost-analytics/dashboard-summary", {
          period: filter.period,
          company,
        })
      : null
  );

  const result = company === "ALL" ? all : selected;
  const data = result.data;
  const rows = data?.companies ?? [];

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
        onPeriod={filter.setPeriod}
        company={company}
        companies={all.data?.companies}
        onCompany={setCompany}
        refresh={() => {
          filter.reload();
          all.reload();
          selected.reload();
        }}
      />

      <LoadState
        loading={filter.loading || result.loading}
        error={filter.error || result.error}
        onRetry={result.reload}
      />

      {!filter.loading && !filter.period && !filter.error && (
        <Notice>Belum ada periode biaya. Mulai dari Data Upload.</Notice>
      )}

      {data && (
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
                    <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white p-4 text-center shadow-inner">
                      <span className="text-xs text-slate-500">{focused?.customer_code || "Total terpilih"}</span>
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
                          {row.company_name}
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