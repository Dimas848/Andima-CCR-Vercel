"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import {
  Workspace,
  LoadState,
  Card,
  Kpis,
  DataTable,
  SalesTable,
  Modal,
  Notice,
  countRecordsIssues,
  buttonClass,
  secondaryClass,
  fieldClass,
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
import { formatPeriodLabel, useLang } from "@/lib/c2-i18n";

type SummaryBucket = {
  customer_code: string;
  company_name: string;
  job_count: number;
  total_sub_total: number;
  total_vat_11: number;
  total_pph_23: number;
  total_others: number;
  total_others_only: number;
  total_dip_iata: number;
  total_cost: number;
};

function readAmount(record: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() !== "") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function ModalSearchField({
  label,
  value,
  allLabel,
  options,
  hasError,
  onChange,
  onClearError,
}: {
  label: string;
  value: string;
  allLabel: string;
  options: { value: string; label: string; badge?: string }[];
  hasError: boolean;
  onChange: (next: string) => void;
  onClearError: () => void;
}) {
  const { isEn } = useLang();
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const keyword = value.trim().toLowerCase();
  const filtered = keyword
    ? options.filter(
        (item) =>
          item.label.toLowerCase().includes(keyword) ||
          (item.badge && item.badge.toLowerCase().includes(keyword))
      )
    : options;

  return (
    <div ref={boxRef} className="relative">
      <label className={`mb-1.5 block text-xs font-semibold ${hasError ? "text-red-600" : "text-slate-700"}`}>
        {label}
      </label>
      <div className="relative flex items-center">
        <Search size={15} className="pointer-events-none absolute left-3 text-slate-400" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          placeholder={isEn ? "Search" : "Cari"}
          value={value}
          onFocus={() => {
            setOpen(true);
            onClearError();
          }}
          onChange={(event) => {
            onChange(event.target.value);
            onClearError();
            setOpen(true);
          }}
          className={`${fieldClass} h-[42px] pl-9 ${value ? "pr-9" : ""} ${
            hasError ? "border-red-300 focus:outline-red-500" : ""
          }`}
        />
        {value && (
          <button
            type="button"
            aria-label={`Reset ${label}`}
            onClick={() => {
              onChange("");
              onClearError();
              setOpen(false);
            }}
            className="absolute right-2.5 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onChange("");
              onClearError();
              setOpen(false);
            }}
            className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-sm transition-colors hover:bg-sky-50 ${
              !value ? "bg-sky-50 font-semibold text-sky-700" : "text-slate-700"
            }`}
          >
            <span>{allLabel}</span>
            <span className="text-xs text-slate-400">{options.length}</span>
          </button>

          {filtered.map((item) => {
            const selected = value.toLowerCase() === item.value.toLowerCase();
            return (
              <button
                type="button"
                key={item.value}
                onClick={() => {
                  onChange(item.value);
                  onClearError();
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-sm transition-colors hover:bg-sky-50 ${
                  selected ? "bg-sky-50 font-semibold text-sky-700" : "text-slate-700"
                }`}
              >
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {filtered.length === 0 && (
            <p className="px-3.5 py-2.5 text-center text-xs text-slate-500">
              {isEn ? "No matching options found." : "Pilihan tidak ditemukan."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaxTracingPage() {
  const { lang, isEn } = useLang();
  const filter = usePeriod();
  const [company, setCompany] = useFilter("company");
  const [dest, setDest] = useFilter("dest");
  const [detail, setDetail] = useState<string | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [draftPeriod, setDraftPeriod] = useState("");
  const [draftCompany, setDraftCompany] = useState("");
  const [draftDest, setDraftDest] = useState("");
  const [filterErrors, setFilterErrors] = useState<("period" | "company" | "dest")[]>([]);

  const activeOptionsPeriod = filterOpen && draftPeriod ? draftPeriod : filter.period;

  const options = useApi<CustomerData>(
    activeOptionsPeriod
      ? query("/api/v1/cost-analytics/customers", {
          period: activeOptionsPeriod,
          company: "ALL",
        })
      : null
  );

  // Selalu kirim dest: "ALL" agar backend tidak memfilter kolom vw_c2_company_tax_tracing.dest yang tidak ada
  const result = useApi<TaxData>(
    filter.period
      ? query("/api/v1/cost-tax/company-tracing", {
          period: filter.period,
          company,
          dest: "ALL",
        })
      : null
  );

  // Filter berdasarkan destinasi & hitung ulang agregasi di frontend saat dest dipilih
  const data = useMemo<TaxData | undefined>(() => {
    const rawData = result.data;
    if (!rawData) return undefined;
    if (dest === "ALL") return rawData;

    const targetDest = dest.trim().toLowerCase();
    const filteredRecords = (rawData.records ?? []).filter(
      (row) => (row.dest ?? "").trim().toLowerCase() === targetDest
    );

    const companyCodeMap = new Map(
      (rawData.companies ?? []).map((item) => [item.company_name, item.customer_code])
    );

    const summaryMap = new Map<string, SummaryBucket>();

    for (const row of filteredRecords) {
      const r = row as unknown as Record<string, unknown>;
      const companyName = row.company_name;
      const customerCode =
        (typeof r.customer_code === "string" && r.customer_code) ||
        companyCodeMap.get(companyName) ||
        companyName;

      const subTotal = readAmount(r, ["sub_total", "total_sub_total", "dpp"]);
      const vat11 = readAmount(r, ["vat_11", "vat_amount", "total_vat_11", "vat", "ppn"]);
      const pph23 = readAmount(r, ["pph_23", "pph23_amount", "total_pph_23", "pph23"]);
      const othersOnly = readAmount(r, ["others_only", "others_cost", "total_others_only", "others"]);
      const dipIata = readAmount(r, ["dip_iata", "dip_iata_cost", "total_dip_iata"]);
      const totalOthers = readAmount(r, ["total_others", "others"]) || othersOnly + dipIata;
      const totalCost = readAmount(r, ["total_cost", "total"]);

      const existing = summaryMap.get(companyName);
      if (existing) {
        existing.job_count += 1;
        existing.total_sub_total += subTotal;
        existing.total_vat_11 += vat11;
        existing.total_pph_23 += pph23;
        existing.total_others += totalOthers;
        existing.total_others_only += othersOnly;
        existing.total_dip_iata += dipIata;
        existing.total_cost += totalCost;
      } else {
        summaryMap.set(companyName, {
          customer_code: customerCode,
          company_name: companyName,
          job_count: 1,
          total_sub_total: subTotal,
          total_vat_11: vat11,
          total_pph_23: pph23,
          total_others: totalOthers,
          total_others_only: othersOnly,
          total_dip_iata: dipIata,
          total_cost: totalCost,
        });
      }
    }

    const filteredCompanies = [...summaryMap.values()];
    const filteredTotals = filteredCompanies.reduce(
      (acc, item) => ({
        sub_total: acc.sub_total + item.total_sub_total,
        vat_amount: acc.vat_amount + item.total_vat_11,
        pph23_amount: acc.pph23_amount + item.total_pph_23,
        others_cost: acc.others_cost + item.total_others_only,
        dip_iata_cost: acc.dip_iata_cost + item.total_dip_iata,
        total_cost: acc.total_cost + item.total_cost,
      }),
      {
        sub_total: 0,
        vat_amount: 0,
        pph23_amount: 0,
        others_cost: 0,
        dip_iata_cost: 0,
        total_cost: 0,
      }
    );

    return {
      ...rawData,
      records: filteredRecords,
      companies: filteredCompanies,
      totals: {
        ...rawData.totals,
        ...filteredTotals,
      },
    };
  }, [result.data, dest]);

  const isLoading = filter.loading || result.loading;
  const loadError = filter.error || result.error || options.error;

  const allIssues = useMemo(() => countRecordsIssues(data?.records ?? []), [data?.records]);

  const periodOptions = useMemo(
    () => [...new Set([filter.period, ...filter.periods].filter(Boolean))],
    [filter.period, filter.periods]
  );

  const companyOptions = useMemo(
    () =>
      [...new Map((options.data?.companies ?? []).map((row) => [row.company_name, row])).values()].map((row) => ({
        value: row.company_name,
        label: row.company_name,
        badge: row.customer_code,
      })),
    [options.data?.companies]
  );

  const destOptions = useMemo(() => {
    const records = options.data?.records ?? [];
    const companyInput = draftCompany.trim().toLowerCase();

    const matchedCompanyNames = companyInput
      ? new Set(
          companyOptions
            .filter(
              (item) =>
                item.value.toLowerCase().includes(companyInput) ||
                (item.badge && item.badge.toLowerCase().includes(companyInput))
            )
            .map((item) => item.value.toLowerCase())
        )
      : null;

    const matchedRecords = matchedCompanyNames
      ? records.filter((row) => matchedCompanyNames.has(row.company_name.toLowerCase()))
      : records;

    return [...new Set(matchedRecords.map((row) => row.dest))]
      .filter(Boolean)
      .map((value) => ({ value, label: value }));
  }, [options.data?.records, companyOptions, draftCompany]);

  function openFilterModal() {
    setDraftPeriod(filter.period);
    setDraftCompany(company === "ALL" ? "" : company);
    setDraftDest(dest === "ALL" ? "" : dest);
    setFilterErrors([]);
    setFilterOpen(true);
  }

  function applyFilter() {
    const invalid: ("period" | "company" | "dest")[] = [];

    if (!draftPeriod.trim()) {
      invalid.push("period");
    }

    let resolvedCompany = "ALL";
    const companyInput = draftCompany.trim().toLowerCase();
    if (companyInput) {
      const exact = companyOptions.find(
        (item) =>
          item.value.toLowerCase() === companyInput ||
          (item.badge && item.badge.toLowerCase() === companyInput)
      );
      const partial =
        exact ??
        companyOptions.find(
          (item) =>
            item.value.toLowerCase().includes(companyInput) ||
            (item.badge && item.badge.toLowerCase().includes(companyInput))
        );
      if (partial) {
        resolvedCompany = partial.value;
      } else {
        invalid.push("company");
      }
    }

    let resolvedDest = "ALL";
    const destInput = draftDest.trim().toLowerCase();
    if (destInput) {
      const exact = destOptions.find((item) => item.value.toLowerCase() === destInput);
      const partial = exact ?? destOptions.find((item) => item.value.toLowerCase().includes(destInput));
      if (partial) {
        resolvedDest = partial.value;
      } else {
        invalid.push("dest");
      }
    }

    if (invalid.length > 0) {
      setFilterErrors(invalid);
      return;
    }

    filter.setPeriod(draftPeriod);
    setCompany(resolvedCompany);
    setDest(resolvedDest);
    setDetail(null);
    setFilterErrors([]);
    setFilterOpen(false);
  }

  const columns: Column<TaxSummary>[] = [
    {
      label: isEn ? "Company" : "Perusahaan",
      cell: (row) => (
        <>
          <p className="text-xs font-semibold text-sky-700">{row.customer_code}</p>
          <span className="font-medium text-slate-800">{row.company_name}</span>
        </>
      ),
    },
    { label: "Job", cell: (row) => number(row.job_count), numeric: true },
    { label: isEn ? "Tax Base (Sub Total)" : "DPP (Dasar Pajak)", cell: (row) => money(row.total_sub_total), numeric: true },
    { label: isEn ? "VAT (11%)" : "PPN (VAT 11%)", cell: (row) => money(row.total_vat_11), numeric: true },
    { label: isEn ? "WHT PPh 23 (2%)" : "PPh 23 (2%)", cell: (row) => money(row.total_pph_23), numeric: true },
    { label: isEn ? "Others" : "Lain-lain", cell: (row) => money(row.total_others_only), numeric: true },
    { label: "DIP IATA", cell: (row) => money(row.total_dip_iata), numeric: true },
    { label: isEn ? "Total Cost" : "Total Biaya", cell: (row) => <strong>{money(row.total_cost)}</strong>, numeric: true },
    {
      label: isEn ? "Issues" : "Kendala",
      cell: (row) => {
        const compRecords = (data?.records ?? []).filter((r) => r.company_name === row.company_name);
        const compIssues = countRecordsIssues(compRecords);
        return compIssues === 0 ? (
          <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {isEn ? "0 Issues" : "0 Kendala"}
          </span>
        ) : (
          <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            {compIssues} {isEn ? "Issues" : "Kendala"}
          </span>
        );
      },
    },
    {
      label: isEn ? "Details" : "Rincian",
      cell: (row) => (
        <button
          type="button"
          className="cursor-pointer font-medium text-sky-700 underline hover:text-sky-900"
          onClick={() => setDetail(row.company_name)}
        >
          {isEn ? "View details" : "Lihat rincian"}
        </button>
      ),
    },
  ];

  const errorFieldLabel = (key: "period" | "company" | "dest") => {
    if (key === "period") return isEn ? "Period" : "Periode";
    if (key === "company") return isEn ? "Company" : "Perusahaan";
    return isEn ? "City / Destination" : "Kota/Destinasi";
  };

  return (
    <Workspace title="" description="">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={openFilterModal} className={buttonClass}>
            <SlidersHorizontal size={16} />
            {isEn ? "Apply Filter" : "Terapkan Filter"}
          </button>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {filter.period && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-700">
                {isEn ? "Period" : "Periode"}: <strong>{formatPeriodLabel(filter.period, lang)}</strong>
              </span>
            )}
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-700">
              {isEn ? "Company" : "Perusahaan"}:{" "}
              <strong>{company === "ALL" ? (isEn ? "All" : "Semua") : company}</strong>
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-700">
              {isEn ? "Destination" : "Destinasi"}:{" "}
              <strong>{dest === "ALL" ? (isEn ? "All" : "Semua") : dest}</strong>
            </span>

            {(company !== "ALL" || dest !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setCompany("ALL");
                  setDest("ALL");
                  setDetail(null);
                }}
                className="text-xs font-semibold text-sky-700 underline hover:text-sky-900"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            filter.reload();
            result.reload();
            options.reload();
          }}
          className={`${secondaryClass} h-[40px]`}
        >
          <RefreshCw size={15} className={isLoading || options.loading ? "animate-spin" : ""} />
          {isEn ? "Refresh" : "Muat ulang"}
        </button>
      </div>

      <LoadState
        loading={isLoading}
        error={!isLoading ? loadError : undefined}
        onRetry={result.reload}
        variant="page"
      />

      {!isLoading && !filter.period && !loadError && (
        <Notice>{isEn ? "No monthly tax data available yet." : "Belum ada data pajak bulanan."}</Notice>
      )}

      {!isLoading && !loadError && data && (
        <>
          <Kpis
            items={[
              {
                label: isEn ? "1. Total Companies" : "1. Total Perusahaan",
                value: number(data.companies.length),
                detail: isEn ? "Companies matching filter" : "Perusahaan sesuai filter",
              },
              {
                label: isEn ? "2. Tax Base (DPP)" : "2. DPP (Dasar Pengenaan Pajak)",
                value: money(data.totals.sub_total),
                detail: isEn ? "Tax calculation basis" : "Basis perhitungan pajak",
              },
              {
                label: isEn ? "3. VAT (11%)" : "3. PPN (VAT 11%)",
                value: money(data.totals.vat_amount),
                detail: isEn ? "Value-Added Tax" : "Pajak Pertambahan Nilai",
              },
              {
                label: isEn ? "4. WHT PPh 23 (2%)" : "4. PPh 23 (2%)",
                value: money(data.totals.pph23_amount),
                detail: isEn ? "Withheld by customer" : "Dipungut oleh pelanggan",
              },
              {
                label: isEn ? "5. Others" : "5. Lain-lain",
                value: money(data.totals.others_cost),
                detail: isEn ? "PPh 22 / PPh 26 / other costs" : "PPh 22 / PPh 26 / biaya lain",
              },
              {
                label: "6. DIP IATA",
                value: money(data.totals.dip_iata_cost),
                detail: isEn ? "IATA organization fees" : "Biaya organisasi IATA",
              },
              {
                label: isEn ? "7. Total Monthly Cost" : "7. Total Biaya Bulanan",
                value: money(data.totals.total_cost),
                detail: isEn ? "Accumulation of all costs" : "Akumulasi seluruh biaya",
              },
              {
                label: isEn ? "8. Total Issues" : "8. Total Kendala",
                value: `${number(allIssues)} ${isEn ? "Issues" : "Kendala"}`,
                detail:
                  allIssues > 0
                    ? isEn
                      ? "Transactions require review"
                      : "Transaksi perlu diperiksa"
                    : isEn
                    ? "All tax components valid"
                    : "Seluruh komponen pajak sesuai",
                alert: allIssues > 0,
              },
            ]}
          />

          <Card
            title={
              isEn
                ? "Tax Base, VAT, WHT PPh 23, Others, and DIP IATA Aggregation per Company"
                : "Agregasi DPP, Pajak, Lain-lain, dan DIP IATA per Perusahaan"
            }
          >
            <DataTable rows={data.companies} columns={columns} rowKey={(row) => row.customer_code} />
          </Card>
        </>
      )}

      {filterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          onClick={() => setFilterOpen(false)}
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="tax-filter-title"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              applyFilter();
            }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-[#087ebd]">
                  <SlidersHorizontal size={18} />
                </div>
                <h2 id="tax-filter-title" className="text-base font-bold text-[#102846]">
                  {isEn ? "Apply Filter" : "Terapkan Filter"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                aria-label={isEn ? "Close" : "Tutup"}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="modal-filter-period"
                  className={`mb-1.5 block text-xs font-semibold ${
                    filterErrors.includes("period") ? "text-red-600" : "text-slate-700"
                  }`}
                >
                  {isEn ? "Period" : "Periode"}
                </label>
                <select
                  id="modal-filter-period"
                  value={draftPeriod}
                  onChange={(event) => {
                    setDraftPeriod(event.target.value);
                    setDraftCompany("");
                    setDraftDest("");
                    setFilterErrors((prev) => prev.filter((item) => item !== "period"));
                  }}
                  className={`${fieldClass} h-[42px] ${
                    filterErrors.includes("period") ? "border-red-300 focus:outline-red-500" : ""
                  }`}
                >
                  <option value="">{isEn ? "Select period" : "Pilih periode"}</option>
                  {periodOptions.map((value) => (
                    <option key={value} value={value}>
                      {formatPeriodLabel(value, lang)}
                    </option>
                  ))}
                </select>
              </div>

              <ModalSearchField
                label={isEn ? "Company" : "Perusahaan"}
                value={draftCompany}
                allLabel={isEn ? "All companies" : "Semua perusahaan"}
                options={companyOptions}
                hasError={filterErrors.includes("company")}
                onChange={(next) => {
                  setDraftCompany(next);
                  setDraftDest("");
                }}
                onClearError={() => setFilterErrors((prev) => prev.filter((item) => item !== "company"))}
              />

              <ModalSearchField
                label={isEn ? "City / Destination" : "Kota/Destinasi"}
                value={draftDest}
                allLabel={isEn ? "All destinations" : "Semua destinasi"}
                options={destOptions}
                hasError={filterErrors.includes("dest")}
                onChange={setDraftDest}
                onClearError={() => setFilterErrors((prev) => prev.filter((item) => item !== "dest"))}
              />

              {filterErrors.length > 0 && (
                <div role="alert" className="rounded-xl bg-sky-50/90 px-4 py-3 text-xs text-red-600">
                  <p className="font-semibold">
                    {isEn
                      ? "Error Please complete the following fields:"
                      : "Error Mohon lengkapi kolom berikut:"}
                  </p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4">
                    {filterErrors.map((key) => (
                      <li key={key}>{errorFieldLabel(key)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className={secondaryClass}
              >
                {isEn ? "Cancel" : "Batal"}
              </button>
              <button type="submit" className={buttonClass}>
                {isEn ? "Apply" : "Terapkan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {detail && data && (
        <Modal
          title={`${detail} · ${formatPeriodLabel(filter.period, lang)} · ${
            dest === "ALL" ? (isEn ? "All destinations" : "Semua destinasi") : dest
          }`}
          onClose={() => setDetail(null)}
        >
          <SalesTable records={data.records.filter((row) => row.company_name === detail)} />
        </Modal>
      )}
    </Workspace>
  );
}