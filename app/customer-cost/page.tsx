"use client";

import { useMemo, useState } from "react";
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
import { formatPeriodLabel, useLang } from "@/lib/c2-i18n";

function CustomerCostSkeleton() {
  const { isEn } = useLang();
  return (
    <>
      <LoadState loading variant="cards" />
      <Card title={isEn ? "Breakdown per Company (Read-Only)" : "Rincian per Perusahaan (Mode Baca)"}>
        <LoadState loading variant="table-inner" rows={5} />
      </Card>
      <Card
        title={
          isEn
            ? "Company Sales Report Transaction Details"
            : "Rincian Transaksi Laporan Penjualan Perusahaan"
        }
      >
        <LoadState loading variant="table-inner" rows={6} />
      </Card>
    </>
  );
}

export default function CustomerCostPage() {
  const { lang, isEn } = useLang();
  const filter = usePeriod();
  const [company, setCompany] = useFilter("company");
  const [detail, setDetail] = useState<string | null>(null);

  const all = useApi<CustomerData>(
    filter.period ? query("/api/v1/cost-analytics/customers", { period: filter.period, company: "ALL" }) : null
  );

  const data = all.data;
  const isLoading = filter.loading || all.loading;
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
        loading={isLoading}
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

      {!isLoading && !filter.period && !loadError && (
        <Notice>{isEn ? "No monthly cost data available yet." : "Belum ada data biaya bulanan."}</Notice>
      )}

      {!isLoading && !loadError && data && (
        <>
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
                value: `${number(issueCount)} ${isEn ? "Issues" : "Kendala"}`,
                detail:
                  issueCount > 0
                    ? isEn
                      ? "Review required in details"
                      : "Perlu pemeriksaan pada rincian"
                    : isEn
                    ? "All transactions valid"
                    : "Seluruh transaksi sesuai",
                alert: issueCount > 0,
              },
            ]}
          />

          <Card title={isEn ? "Breakdown per Company (Read-Only)" : "Rincian per Perusahaan (Mode Baca)"}>
            <SummaryTable rows={rows} detail={(row) => setDetail(row.company_name)} />
          </Card>

          <Card
            title={
              isEn
                ? "Company Sales Report Transaction Details"
                : "Rincian Transaksi Laporan Penjualan Perusahaan"
            }
          >
            <SalesTable records={records} />
          </Card>
        </>
      )}

      {detail && data && (
        <Modal
          title={`${detail} · ${formatPeriodLabel(filter.period, lang)}`}
          onClose={() => setDetail(null)}
        >
          <SalesTable records={records.filter((row) => row.company_name === detail)} />
        </Modal>
      )}
    </Workspace>
  );
}