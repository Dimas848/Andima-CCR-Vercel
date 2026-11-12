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
  countRecordsIssues,
} from "@/components/c2-workspace";
import {
  amount,
  money,
  number,
  query,
  useApi,
  useFilter,
  usePeriod,
  type CustomerData,
} from "@/lib/c2-client";

function CustomerCostSkeleton() {
  return (
    <>
      <LoadState loading variant="cards" />
      <Card title="Rincian per Perusahaan (Mode Baca)">
        <LoadState loading variant="table-inner" rows={5} />
      </Card>
      <Card title="Rincian Transaksi Laporan Penjualan Perusahaan">
        <LoadState loading variant="table-inner" rows={6} />
      </Card>
    </>
  );
}

export default function CustomerCostPage() {
  const filter = usePeriod();
  const [company, setCompany] = useFilter("company");
  const [detail, setDetail] = useState<string | null>(null);

  const all = useApi<CustomerData>(
    filter.period ? query("/api/v1/cost-analytics/customers", { period: filter.period, company: "ALL" }) : null
  );
  const selected = useApi<CustomerData>(
    filter.period && company !== "ALL"
      ? query("/api/v1/cost-analytics/customers", { period: filter.period, company })
      : null
  );

  const result = company === "ALL" ? all : selected;
  const rows = result.data?.companies ?? [];
  const records = result.data?.records ?? [];
  const isLoading = filter.loading || result.loading;
  const loadError = filter.error || result.error;

  const sum = (
    key: "sum_sub_total" | "sum_vat" | "sum_pph23" | "sum_others" | "sum_dip_iata" | "sum_total_cost"
  ) => rows.reduce((total, row) => total + amount(row[key]), 0);

  const issueCount = countRecordsIssues(records);

  return (
    <Workspace
      title="Customer Cost"
      description="Rincian biaya dan pajak pelanggan dalam mode baca saja. Seluruh 8 indikator kinerja utama selaras dengan Dasbor dan Validasi."
    >
      <Filters
        {...filter}
        loading={isLoading}
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

      {!isLoading && loadError && <LoadState loading={false} error={loadError} onRetry={result.reload} />}
      {isLoading && <CustomerCostSkeleton />}

      {!isLoading && !filter.period && !loadError && <Notice>Belum ada data biaya bulanan.</Notice>}

      {!isLoading && !loadError && result.data && (
        <>
          <Kpis
            items={[
              { label: "1. Total Perusahaan", value: number(rows.length), detail: "Pelanggan aktif periode ini" },
              { label: "2. DPP (Dasar Pengenaan Pajak)", value: money(sum("sum_sub_total")), detail: "Basis perhitungan pajak" },
              { label: "3. PPN (VAT 11%)", value: money(sum("sum_vat")), detail: "Pajak Pertambahan Nilai" },
              { label: "4. PPh 23 (2%)", value: money(sum("sum_pph23")), detail: "Dipungut oleh pelanggan" },
              { label: "5. Lain-lain", value: money(sum("sum_others")), detail: "PPh 22 / PPh 26 / biaya lain" },
              { label: "6. DIP IATA", value: money(sum("sum_dip_iata")), detail: "Biaya organisasi IATA" },
              { label: "7. Total Biaya Bulanan", value: money(sum("sum_total_cost")), detail: "Akumulasi seluruh biaya" },
              {
                label: "8. Total Kendala",
                value: `${number(issueCount)} Kendala`,
                detail: issueCount > 0 ? "Perlu pemeriksaan pada rincian" : "Seluruh transaksi sesuai",
                alert: issueCount > 0,
              },
            ]}
          />

          <Card title="Rincian per Perusahaan (Mode Baca)">
            <SummaryTable rows={rows} detail={(row) => setDetail(row.company_name)} />
          </Card>

          <Card title="Rincian Transaksi Laporan Penjualan Perusahaan">
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