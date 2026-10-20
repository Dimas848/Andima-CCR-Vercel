"use client";

import { useState, useMemo } from "react";
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

// Komponen Skeleton untuk Loading State Tax Tracing
function TaxTracingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <div className="h-3.5 w-20 rounded bg-slate-200" />
            <div className="h-6 w-32 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="h-4 w-52 rounded bg-slate-200" />
        <div className="h-64 w-full rounded bg-slate-100" />
      </div>
    </div>
  );
}

// Master daftar rute destinasi operasional standar freight forwarding PT Andima Transportindo
const MASTER_OPERATIONAL_DESTINATIONS = [
  "KANSAI, JAPAN",
  "NARITA, JAPAN",
  "TOKYO, JAPAN",
  "SINGAPORE",
  "HONG KONG",
  "INCHEON, SOUTH KOREA",
  "SHANGHAI, CHINA",
  "GUANGZHOU, CHINA",
  "BEIJING, CHINA",
  "TAIPEI, TAIWAN",
  "BANGKOK, THAILAND",
  "KUALA LUMPUR, MALAYSIA",
  "HO CHI MINH, VIETNAM",
  "JAKARTA, INDONESIA",
  "SURABAYA, INDONESIA",
  "DENPASAR, INDONESIA",
  "SYDNEY, AUSTRALIA",
  "MELBOURNE, AUSTRALIA",
  "LOS ANGELES, USA",
  "FRANKFURT, GERMANY",
  "AMSTERDAM, NETHERLANDS",
];

export default function TaxTracingPage() {
  const filter = usePeriod();
  const [company, setCompany] = useFilter("company");
  const [dest, setDest] = useFilter("dest");
  const [detail, setDetail] = useState<string | null>(null);

  // Normalisasi filter: jika kosong, null, atau "", otomatis dianggap "ALL"
  const activeCompany = company && company !== "ALL" && company !== "Semua perusahaan" ? company : "ALL";
  const activeDest = dest && dest !== "ALL" && dest !== "Semua destinasi" ? dest : "ALL";

  // 1. Kueri data pajak bulanan
  const result = useApi<TaxData>(
    filter.period
      ? query("/api/v1/cost-tax/company-tracing", {
          period: filter.period,
          company: activeCompany,
          dest: activeDest,
        })
      : null
  );

  // 2. Kueri master pelanggan periode aktif untuk opsi dropdown
  const options = useApi<CustomerData>(
    filter.period
      ? query("/api/v1/cost-analytics/customers", {
          period: filter.period,
        })
      : null
  );

  const data = result.data;
  const isLoading = filter.loading || result.loading;

  // Daftar destinasi lengkap
  const availableDestinations = useMemo(() => {
    const fromRecords = [
      ...(data?.records ?? []),
      ...(options.data?.records ?? []),
    ]
      .map((row: any) => String(row.dest || "").trim())
      .filter(Boolean);

    const merged = new Set([
      ...fromRecords,
      ...MASTER_OPERATIONAL_DESTINATIONS,
    ]);

    return Array.from(merged).sort();
  }, [data?.records, options.data?.records]);

  // Daftar perusahaan lengkap untuk dropdown
  const availableCompanies = useMemo(() => {
    return options.data?.companies ?? data?.companies ?? [];
  }, [options.data?.companies, data?.companies]);

  // 3. VALIDASI KETAT DESTINASI vs PERUSAHAAN (Memastikan kosong jika tidak ada transaksi di destinasi tersebut):
  const validRecords = useMemo(() => {
    if (!data?.records || !Array.isArray(data.records)) return [];
    return data.records.filter((r: any) => {
      const matchComp =
        activeCompany === "ALL" ||
        String(r.company_name).trim().toLowerCase() === activeCompany.toLowerCase() ||
        String(r.customer_code).trim().toLowerCase() === activeCompany.toLowerCase();

      const matchDest =
        activeDest === "ALL" ||
        String(r.dest || "").trim().toLowerCase() === activeDest.toLowerCase();

      return matchComp && matchDest;
    });
  }, [data?.records, activeCompany, activeDest]);

  // Hanya tampilkan perusahaan yang benar-benar memiliki transaksi pada destinasi terpilih
  const displayCompanies = useMemo(() => {
    if (!data?.companies) return [];

    // Jika filter ALL/ALL, tampilkan apa adanya
    if (activeDest === "ALL" && activeCompany === "ALL") {
      return data.companies;
    }

    // Jika ada filter destinasi atau perusahaan, saring berdasarkan validRecords
    const validCompanyNames = new Set(
      validRecords.map((r: any) => String(r.company_name).trim().toLowerCase())
    );

    return data.companies.filter((c: any) =>
      validCompanyNames.has(String(c.company_name).trim().toLowerCase())
    );
  }, [data?.companies, validRecords, activeDest, activeCompany]);

  // Hitung total KPI secara dinamis: jika kosong, seluruh nilai otomatis Rp 0
  const displayTotals = useMemo(() => {
    if (activeDest === "ALL" && activeCompany === "ALL" && data?.totals) {
      return data.totals;
    }

    if (displayCompanies.length === 0 || validRecords.length === 0) {
      return {
        sub_total: 0,
        vat_amount: 0,
        pph23_amount: 0,
        others_cost: 0,
        dip_iata_cost: 0,
        total_cost: 0,
      };
    }

    return {
      sub_total: validRecords.reduce((s, r) => s + amount(r.sub_total), 0),
      vat_amount: validRecords.reduce((s, r) => s + amount(r.vat_amount), 0),
      pph23_amount: validRecords.reduce((s, r) => s + amount(r.pph23_amount), 0),
      others_cost: validRecords.reduce((s, r) => s + amount(r.others_cost), 0),
      dip_iata_cost: validRecords.reduce((s, r) => s + amount(r.dip_iata_cost), 0),
      total_cost: validRecords.reduce((s, r) => s + amount(r.total_cost), 0),
    };
  }, [data?.totals, displayCompanies.length, validRecords, activeDest, activeCompany]);

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
          setCompany("ALL"); // Reset ke Semua perusahaan saat periode berubah
          setDest("ALL");    // Reset ke Semua destinasi saat periode berubah
          setDetail(null);
        }}
        company={activeCompany}
        companies={availableCompanies}
        onCompany={(value) => {
          const next = !value || value === "Semua perusahaan" ? "ALL" : value;
          setCompany(next);
          setDetail(null);
        }}
        dest={activeDest}
        destinations={availableDestinations}
        onDest={(value) => {
          const next = !value || value === "Semua destinasi" ? "ALL" : value;
          setDest(next);
          setDetail(null);
        }}
        refresh={() => {
          result.reload();
          options.reload();
        }}
      />

      <LoadState
        loading={isLoading}
        error={filter.error || result.error || options.error}
        onRetry={result.reload}
      />

      {!filter.loading && !filter.period && !filter.error && (
        <Notice>Belum ada data pajak bulanan.</Notice>
      )}

      {/* Tampilkan Skeleton saat data sedang dimuat */}
      {isLoading && <TaxTracingSkeleton />}

      {!isLoading && data && (
        <>
          <Kpis
            items={[
              { label: "Sub Total Cost", value: money(displayTotals.sub_total) },
              { label: "VAT (PPN 11%)", value: money(displayTotals.vat_amount) },
              { label: "Cost PPh 23", value: money(displayTotals.pph23_amount) },
              {
                label: "Others / DIP IATA",
                value: money(
                  amount(displayTotals.others_cost) + amount(displayTotals.dip_iata_cost)
                ),
              },
              { label: "Total Cost", value: money(displayTotals.total_cost) },
            ]}
          />

          <Card
            title={
              activeDest !== "ALL"
                ? `Agregasi biaya dan pajak per perusahaan · Destinasi: ${activeDest}`
                : "Agregasi biaya dan pajak per perusahaan"
            }
          >
            {displayCompanies.length > 0 ? (
              <DataTable
                rows={displayCompanies}
                columns={columns}
                rowKey={(row) => `${row.customer_code}-${row.company_name}`}
              />
            ) : (
              <div className="py-12 text-center text-sm text-slate-500">
                Tidak ada transaksi untuk{" "}
                <strong className="text-slate-700">
                  {activeCompany !== "ALL" ? activeCompany : "seluruh perusahaan"}
                </strong>{" "}
                ke destinasi <strong className="text-slate-700">{activeDest}</strong> pada periode{" "}
                <strong className="text-slate-700">{filter.period}</strong>.
              </div>
            )}
          </Card>
        </>
      )}

      {detail && data && (
        <Modal
          title={`${detail} · ${filter.period} · ${activeDest === "ALL" ? "Semua destinasi" : activeDest}`}
          onClose={() => setDetail(null)}
        >
          <SalesTable
            records={validRecords.filter((row: any) => row.company_name === detail)}
          />
        </Modal>
      )}
    </Workspace>
  );
}