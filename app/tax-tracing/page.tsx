"use client";

import { useState } from "react";
import {
  Workspace,
  Filters,
  LoadState,
  Card,
  Kpis,
  DataTable,
  SalesTable,
  Modal,
  Notice,
  type Column,
} from "@/components/c2-workspace";
import {
  amount,
  money,
  query,
  useApi,
  useFilter,
  usePeriod,
  type TaxData,
  type TaxSummary,
  type CustomerData,
} from "@/lib/c2-client";

export default function TaxTracingPage() {
  const filter = usePeriod();
  const [company, setCompany] = useFilter("company");
  const [dest, setDest] = useFilter("dest");
  const [detail, setDetail] = useState<string | null>(null);

  const options = useApi<CustomerData>(
    filter.period
      ? query("/api/v1/cost-analytics/customers", {
          period: filter.period,
          company: "ALL",
        })
      : null
  );

  const result = useApi<TaxData>(
    filter.period
      ? query("/api/v1/cost-tax/company-tracing", {
          period: filter.period,
          company,
          dest,
        })
      : null
  );

  const data = result.data;

  const columns: Column<TaxSummary>[] = [
    {
      label: "Perusahaan",
      cell: (row) => (
        <>
          <p className="text-xs font-semibold text-sky-700">{row.customer_code}</p>
          <span className="font-medium text-slate-800">{row.company_name}</span>
        </>
      ),
    },
    { label: "Job", cell: (row) => row.job_count, numeric: true },
    { label: "Sub Total", cell: (row) => money(row.total_sub_total), numeric: true },
    { label: "VAT (PPN 11%)", cell: (row) => money(row.total_vat_11), numeric: true },
    { label: "Cost PPh 23", cell: (row) => money(row.total_pph_23), numeric: true },
    { label: "Others / DIP IATA", cell: (row) => money(row.total_others), numeric: true },
    { label: "Total Cost", cell: (row) => money(row.total_cost), numeric: true },
    {
      label: "Rincian",
      cell: (row) => (
        <button
          type="button"
          className="text-sky-700 hover:text-sky-900 underline font-medium cursor-pointer"
          onClick={() => setDetail(row.company_name)}
        >
          Lihat rincian
        </button>
      ),
    },
  ];

  return (
    <Workspace
      title="Tax Component Tracing"
      description="Telusuri komponen biaya, VAT, dan PPh 23 per perusahaan. Kartu, tabel, dan rincian memakai filter yang sama."
    >
      <Filters
        {...filter}
        onPeriod={(value) => {
          filter.setPeriod(value);
          setDetail(null);
        }}
        company={company}
        companies={options.data?.companies}
        onCompany={(value) => {
          setCompany(value);
          setDest("ALL"); // Otomatis reset destinasi ke Semua saat perusahaan diubah
          setDetail(null);
        }}
        dest={dest}
        destinations={[
          ...new Set(options.data?.records.map((row) => row.dest) ?? []),
        ].filter(Boolean)}
        onDest={(value) => {
          setDest(value);
          setDetail(null);
        }}
        refresh={() => {
          result.reload();
          options.reload();
        }}
      />

      <LoadState
        loading={filter.loading || result.loading}
        error={filter.error || result.error || options.error}
        onRetry={result.reload}
      />

      {!filter.loading && !filter.period && !filter.error && (
        <Notice>Belum ada data pajak bulanan.</Notice>
      )}

      {data && (
        <>
          <Kpis
            items={[
              { label: "Sub Total Cost", value: money(data.totals.sub_total) },
              { label: "VAT (PPN 11%)", value: money(data.totals.vat_amount) },
              { label: "Cost PPh 23", value: money(data.totals.pph23_amount) },
              {
                label: "Others / DIP IATA",
                value: money(
                  amount(data.totals.others_cost) + amount(data.totals.dip_iata_cost)
                ),
              },
              { label: "Total Cost", value: money(data.totals.total_cost) },
            ]}
          />

          <Card title="Agregasi biaya dan pajak per perusahaan">
            <DataTable rows={data.companies} columns={columns} rowKey={(row) => row.customer_code} />
          </Card>
        </>
      )}

      {detail && data && (
        <Modal
          title={`${detail} · ${filter.period} · ${dest === "ALL" ? "Semua destinasi" : dest}`}
          onClose={() => setDetail(null)}
        >
          <SalesTable
            records={data.records.filter((row) => row.company_name === detail)}
          />
        </Modal>
      )}
    </Workspace>
  );
}