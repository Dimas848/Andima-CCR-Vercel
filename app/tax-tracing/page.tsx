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
  countRecordsIssues,
  type Column,
} from "@/components/c2-workspace";
import {
  money,
  number,
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
  const isLoading = filter.loading || result.loading;
  const loadError = filter.error || result.error || options.error;
  const allIssues = countRecordsIssues(data?.records ?? []);

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
    { label: "Job", cell: (row) => number(row.job_count), numeric: true },
    { label: "DPP (Dasar Pajak)", cell: (row) => money(row.total_sub_total), numeric: true },
    { label: "PPN (VAT 11%)", cell: (row) => money(row.total_vat_11), numeric: true },
    { label: "PPh 23 (2%)", cell: (row) => money(row.total_pph_23), numeric: true },
    { label: "Lain-lain", cell: (row) => money(row.total_others_only), numeric: true },
    { label: "DIP IATA", cell: (row) => money(row.total_dip_iata), numeric: true },
    { label: "Total Biaya", cell: (row) => <strong>{money(row.total_cost)}</strong>, numeric: true },
    {
      label: "Kendala",
      cell: (row) => {
        const compRecords = (data?.records ?? []).filter((r) => r.company_name === row.company_name);
        const compIssues = countRecordsIssues(compRecords);
        return compIssues === 0 ? (
          <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            0 Kendala
          </span>
        ) : (
          <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            {compIssues} Kendala
          </span>
        );
      },
    },
    {
      label: "Rincian",
      cell: (row) => (
        <button
          type="button"
          className="cursor-pointer font-medium text-sky-700 underline hover:text-sky-900"
          onClick={() => setDetail(row.company_name)}
        >
          Lihat rincian
        </button>
      ),
    },
  ];

  return (
    <Workspace title="" description="">
      <Filters
        {...filter}
        loading={isLoading}
        onPeriod={(value) => {
          filter.setPeriod(value);
          setDetail(null);
        }}
        company={company}
        companies={options.data?.companies}
        onCompany={(value) => {
          setCompany(value);
          setDest("ALL");
          setDetail(null);
        }}
        dest={dest}
        destinations={[...new Set(options.data?.records.map((row) => row.dest) ?? [])].filter(Boolean)}
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
        loading={isLoading}
        error={!isLoading ? loadError : undefined}
        onRetry={result.reload}
        variant="page"
      />

      {!isLoading && !filter.period && !loadError && <Notice>Belum ada data pajak bulanan.</Notice>}

      {!isLoading && !loadError && data && (
        <>
          <Kpis
            items={[
              { label: "1. Total Perusahaan", value: number(data.companies.length), detail: "Perusahaan sesuai filter" },
              { label: "2. DPP (Dasar Pengenaan Pajak)", value: money(data.totals.sub_total), detail: "Basis perhitungan pajak" },
              { label: "3. PPN (VAT 11%)", value: money(data.totals.vat_amount), detail: "Pajak Pertambahan Nilai" },
              { label: "4. PPh 23 (2%)", value: money(data.totals.pph23_amount), detail: "Dipungut oleh pelanggan" },
              { label: "5. Lain-lain", value: money(data.totals.others_cost), detail: "PPh 22 / PPh 26 / biaya lain" },
              { label: "6. DIP IATA", value: money(data.totals.dip_iata_cost), detail: "Biaya organisasi IATA" },
              { label: "7. Total Biaya Bulanan", value: money(data.totals.total_cost), detail: "Akumulasi seluruh biaya" },
              {
                label: "8. Total Kendala",
                value: `${number(allIssues)} Kendala`,
                detail: allIssues > 0 ? "Transaksi perlu diperiksa" : "Seluruh komponen pajak sesuai",
                alert: allIssues > 0,
              },
            ]}
          />

          <Card title="Agregasi DPP, Pajak, Lain-lain, dan DIP IATA per Perusahaan">
            <DataTable rows={data.companies} columns={columns} rowKey={(row) => row.customer_code} />
          </Card>
        </>
      )}

      {detail && data && (
        <Modal
          title={`${detail} · ${filter.period} · ${dest === "ALL" ? "Semua destinasi" : dest}`}
          onClose={() => setDetail(null)}
        >
          <SalesTable records={data.records.filter((row) => row.company_name === detail)} />
        </Modal>
      )}
    </Workspace>
  );
}