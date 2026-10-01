"use client";

import { useState } from "react";
import { Play, AlertTriangle, FileCheck2, FileX, Loader2 } from "lucide-react";
import CustomButton from "../dashboard/CustomButton";
import StatusBadge, { type Tone } from "../dashboard/StatusBadge";

export interface TransactionRecord {
  id: string;
  voucherNo: string;
  customerName: string;
  jobNumber: string;
  category: "TRUCKING" | "HANDLING" | "STORAGE" | "OTHER_OPERATIONAL" | "INVALID";
  amount: number;
  hasEvidence: boolean;
  status: "Valid" | "Warning" | "Invalid";
  reasons: string[];
}

interface PreviewTableProps {
  records: TransactionRecord[];
  onCommit: () => void;
  onCancel: () => void;
  isCommitting: boolean;
}

const statusTone: Record<TransactionRecord["status"], Tone> = {
  Valid: "success",
  Warning: "warning",
  Invalid: "danger",
};

function formatRupiah(val: number): string {
  if (isNaN(val) || val < 0) return "Rp -";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
}

export default function PreviewTable({
  records,
  onCommit,
  onCancel,
  isCommitting,
}: PreviewTableProps) {
  const [filter, setFilter] = useState<"ALL" | "Valid" | "Warning" | "Invalid">("ALL");

  const counts = {
    all: records.length,
    valid: records.filter((r) => r.status === "Valid").length,
    warning: records.filter((r) => r.status === "Warning").length,
    invalid: records.filter((r) => r.status === "Invalid").length,
  };

  const filteredRows = records.filter((r) => {
    if (filter === "ALL") return true;
    return r.status === filter;
  });

  const commitReadyCount = counts.valid + counts.warning;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {/* Header & Filter Tabs */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Preview & Validasi Data Transaksi (FR-CCR2-001-02)
          </h3>
          <p className="text-[11px] text-slate-400">
            Menampilkan {filteredRows.length} dari {counts.all} baris transaksi
          </p>
        </div>

        {/* Tab Filter Interaktif */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter("ALL")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
              filter === "ALL"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Semua ({counts.all})
          </button>
          <button
            onClick={() => setFilter("Valid")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
              filter === "Valid"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Valid ({counts.valid})
          </button>
          <button
            onClick={() => setFilter("Warning")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
              filter === "Warning"
                ? "bg-amber-500 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            Warning ({counts.warning})
          </button>
          <button
            onClick={() => setFilter("Invalid")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
              filter === "Invalid"
                ? "bg-rose-600 text-white"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            Invalid ({counts.invalid})
          </button>
        </div>
      </div>

      {/* Tabel 7 Atribut Wajib (FR-CCR2-001-02) */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 font-bold">Voucher No</th>
              <th className="px-4 py-3 font-bold">Customer</th>
              <th className="px-4 py-3 font-bold">Job Number</th>
              <th className="px-4 py-3 font-bold">Kategori</th>
              <th className="px-4 py-3 font-bold text-right">Nominal (Rp)</th>
              <th className="px-4 py-3 font-bold text-center">Bukti Transaksi</th>
              <th className="px-4 py-3 font-bold">Status & Catatan Anomali</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-xs text-slate-400">
                  Belum ada berkas yang diunggah atau tidak ada data yang cocok dengan filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-3 font-semibold text-slate-600 text-xs">
                    {r.voucherNo}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800 text-xs">
                    {r.customerName}
                  </td>
                  <td className="px-4 py-3 font-semibold text-xs">
                    {r.jobNumber === "UNMATCHED" || r.jobNumber.includes("UNKNOWN") ? (
                      <span className="inline-flex items-center gap-1 rounded bg-[#FFEDD5] px-1.5 py-0.5 text-[10px] font-bold text-[#EA580C]">
                        <AlertTriangle className="h-3 w-3" /> JOB NOT FOUND
                      </span>
                    ) : (
                      <span className="text-slate-700">{r.jobNumber}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                        r.category === "INVALID"
                          ? "bg-rose-100 text-rose-600"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {r.category}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-extrabold text-xs ${
                      r.amount <= 0 ? "text-rose-600" : "text-slate-800"
                    }`}
                  >
                    {r.amount <= 0 ? "INVALID NOMINAL" : formatRupiah(r.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.hasEvidence ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <FileCheck2 className="h-4 w-4" /> Ada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#D99A18] bg-[#FEF3C7] px-1.5 py-0.5 rounded">
                        <FileX className="h-3 w-3" /> MISSING
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      <StatusBadge value={r.status} tone={statusTone[r.status]} />
                      {r.reasons.length > 0 && (
                        <p className="text-[10px] font-semibold text-slate-500">
                          {r.reasons.join(" · ")}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer & Tombol Aksi Transaksional */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <p className="text-[11px] text-slate-400">
          * {counts.invalid} baris invalid akan diabaikan. {commitReadyCount} baris siap disimpan langsung ke tabel Supabase.
        </p>
        <div className="flex items-center gap-2">
          <CustomButton variant="outline" size="sm" onClick={onCancel}>
            Batalkan
          </CustomButton>
          <CustomButton
            size="sm"
            onClick={onCommit}
            disabled={isCommitting || commitReadyCount === 0}
            className="bg-[#0a7ebf] hover:bg-[#08689d]"
          >
            {isCommitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan ke Supabase...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Konfirmasi & Simpan {commitReadyCount} Data
              </>
            )}
          </CustomButton>
        </div>
      </div>
    </div>
  );
}