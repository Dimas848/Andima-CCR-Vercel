"use client";

import { useEffect, useMemo, useState } from "react";
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

// Cache ringan per periode agar perpindahan halaman/periode tampil instan
const customerCostCache = new Map<string, CustomerData>();

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

  useEffect(() => {
    if (filter.period && all.data) {
      customerCostCache.set(filter.period, all.data);
    }
  }, [filter.period, all.data]);

  const data = all.data ?? (filter.period ? customerCostCache.get(filter.period) : undefined);
  const isLoading = !data && (filter.loading || all.loading);
  const isRefreshing = filter.loading || all.loading;
  const loadError = filter.error || all.error;

  const allCompanies = useMemo(() => data?.companies ?? [], [data?.companies]);
  const rows = useMemo(() => {
    if (company === "ALL") return allCompanies;
    return allCompanies.filter((row) => row.company_name === company);
  }, [allCompanies, company]);

  const records = useMemo(() => {
    const allRecords = data?.records ?? [];
    if (company === "ALL") return allRecords;
    return allRecords.filter((row) => row.company_name === company);
  }, [data?.records, company]);

  const sum = (
    key: "sum_sub_total" | "sum_vat" | "sum_pph23" | "sum_others" | "sum_dip_iata" | "sum_total_cost"
  ) => rows.reduce((total, row) => total + amount(row[key]), 0);

  const issueCount = useMemo(() => countRecordsIssues(records), [records]);

  return (
    <Workspace title="" description="">
      <Filters
        {...filter}
        loading={isRefreshing}
        onPeriod={(value) => {
          filter.setPeriod(value);
          setDetail(null);
        }}
        company={company}
        companies={allCompanies}
        onCompany={(value) => {
          setCompany(value);
          setDetail(null);
        }}
        refresh={() => {
          filter.reload();
          all.reload();
        }}
      />

      {!isLoading && loadError && <LoadState loading={false} error={loadError} onRetry={all.reload} />}
      {isLoading && !loadError && <CustomerCostSkeleton />}

      {!isLoading && !filter.period && !loadError && <Notice>Belum ada data biaya bulanan.</Notice>}

      {!isLoading && !loadError && data && (
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

      {detail && data && (
        <Modal title={`${detail} · ${filter.period}`} onClose={() => setDetail(null)}>
          <SalesTable records={records.filter((row) => row.company_name === detail)} />
        </Modal>
      )}
    </Workspace>
  );
}