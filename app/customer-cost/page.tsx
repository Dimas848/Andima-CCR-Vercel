"use client";

import { useState } from "react";
import {
  Workspace,
  Filters,
  LoadState,
  Card,
  Kpis,
  SummaryTable,
  SalesTable,
  Modal,
  Notice,
} from "@/components/c2-workspace";
import {
  amount,
  money,
  query,
  useApi,
  useFilter,
  usePeriod,
  type CustomerData,
} from "@/lib/c2-client";

// Komponen Skeleton untuk Loading State Customer Cost
function CustomerCostSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* KPI Grid Skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <div className="h-3.5 w-20 rounded bg-slate-200" />
            <div className="h-6 w-32 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* Summary Table Card Skeleton */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="h-44 w-full rounded bg-slate-100" />
      </div>

      {/* Sales Table Card Skeleton */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="h-4 w-52 rounded bg-slate-200" />
        <div className="h-64 w-full rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function CustomerCostPage() {
  const filter = usePeriod();
  const [company, setCompany] = useFilter("company");
  const [detail, setDetail] = useState<string | null>(null);

  const all = useApi<CustomerData>(
    filter.period
      ? query("/api/v1/cost-analytics/customers", {
          period: filter.period,
          company: "ALL",
        })
      : null
  );

  const selected = useApi<CustomerData>(
    filter.period && company !== "ALL"
      ? query("/api/v1/cost-analytics/customers", {
          period: filter.period,
          company,
        })
      : null
  );

  const result = company === "ALL" ? all : selected;
  const rows = result.data?.companies ?? [];
  const records = result.data?.records ?? [];

  const sum = (
    key:
      | "sum_sub_total"
      | "sum_vat"
      | "sum_pph23"
      | "sum_others_dip_iata"
      | "sum_total_cost"
  ) => rows.reduce((total, row) => total + amount(row[key]), 0);

  const isLoading = filter.loading || result.loading;

  return (
    <Workspace
      title="Customer Cost"
      description="Rincian biaya dan pajak pelanggan dalam mode baca saja. Kode pelanggan mengikuti daftar resmi yang tersimpan."
    >
      <Filters
        {...filter}
        onPeriod={(value) => {
          filter.setPeriod(value);
          setDetail(null);
        }}
        company={company}
        companies={all.data?.companies}
        onCompany={(value) => {
          setCompany(value);
          setDetail(null);
        }}
        refresh={() => {
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
        <Notice>Belum ada data biaya bulanan.</Notice>
      )}

      {/* Tampilkan Skeleton saat data sedang dimuat */}
      {isLoading && <CustomerCostSkeleton />}

      {!isLoading && result.data && (
        <>
          <Kpis
            items={[
              { label: "Sub Total Cost", value: money(sum("sum_sub_total")) },
              { label: "VAT (PPN 11%)", value: money(sum("sum_vat")) },
              { label: "Cost PPh 23", value: money(sum("sum_pph23")) },
              { label: "Others / DIP IATA", value: money(sum("sum_others_dip_iata")) },
              { label: "Total Cost", value: money(sum("sum_total_cost")) },
            ]}
          />
          <Card title="Breakdown perusahaan · Read-only">
            <SummaryTable
              rows={rows}
              detail={(row) => setDetail(row.company_name)}
            />
          </Card>
          <Card title="Rincian Company Sales Report">
            <SalesTable records={records} />
          </Card>
        </>
      )}

      {detail && result.data && (
        <Modal title={`${detail} · ${filter.period}`} onClose={() => setDetail(null)}>
          <SalesTable records={records.filter((row) => row.company_name === detail)} />
        </Modal>
      )}
    </Workspace>
  );
}