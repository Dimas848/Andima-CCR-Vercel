"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, File, AlertCircle, RefreshCw } from "lucide-react";
import CustomButton from "../dashboard/CustomButton";

interface UploadZoneProps {
  onFileLoaded: (file: File) => void;
  isValidating: boolean;
  progress: number;
  validationStage: string;
  loadedFile: {
    name: string;
    size: string;
    rowCount: number;
  } | null;
  onReset: () => void;
}

export default function UploadZone({
  onFileLoaded,
  isValidating,
  progress,
  validationStage,
  loadedFile,
  onReset,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const validateAndPassFile = (file: File) => {
    setUploadError(null);

    // Validasi Format (FR-CCR2-001-01)
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExtensions.includes(fileExt)) {
      setUploadError("Format berkas tidak didukung! Harap gunakan .xlsx, .xls, atau .csv.");
      return;
    }

    // Batas Ukuran 25 MB
    const maxSizeBytes = 25 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setUploadError("Ukuran berkas melebihi 25 MB.");
      return;
    }

    onFileLoaded(file);
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
      {/* Area Drag-and-Drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndPassFile(e.dataTransfer.files[0]);
          }
        }}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging
            ? "border-sky-500 bg-sky-50/70"
            : "border-sky-200 bg-white hover:border-sky-300"
        }`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-50">
          <UploadCloud className="h-6 w-6 text-sky-600" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-800">
          Tarik file ke sini atau pilih dari perangkat
        </p>
        <p className="mt-1 text-[11px] text-slate-400">
          Format .xlsx, .xls, atau .csv · Maksimal 25 MB (FR-CCR2-001-01)
        </p>

        {uploadError && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {uploadError}
          </div>
        )}

        <CustomButton
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => inputRef.current?.click()}
        >
          <File className="h-4 w-4" /> Pilih File
        </CustomButton>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              validateAndPassFile(e.target.files[0]);
            }
          }}
        />
      </div>

      {/* Panel Status & Validasi Struktur */}
      <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">File Terpilih</p>
              <p className="text-[11px] text-slate-400">
                {loadedFile ? "Inspeksi Skema & Relasi Job" : "Menunggu pengunggahan berkas"}
              </p>
            </div>
            {loadedFile && !isValidating && (
              <button
                onClick={onReset}
                title="Ganti Berkas"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          </div>

          {loadedFile ? (
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3 border border-slate-100">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-[13px] font-bold text-slate-800 truncate">{loadedFile.name}</p>
                <p className="text-[11px] text-slate-400">
                  {loadedFile.rowCount} baris terdeteksi · {loadedFile.size}
                </p>
              </div>
              {!isValidating && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-3 rounded-lg border border-dashed border-slate-200 p-4 text-slate-400">
              <p className="text-xs">Belum ada berkas yang dimuat untuk dianalisis.</p>
            </div>
          )}
        </div>

        {/* Progress Bar Validasi */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-600">
              {isValidating ? validationStage : "Status Validasi Berkas"}
            </p>
            <span className="text-[11px] font-bold text-sky-600">{progress}%</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                progress === 100 ? "bg-emerald-500" : "bg-[#0a7ebf]"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">
            {isValidating
              ? "Memvalidasi tipe data nominal, relasi Job Number, dan kategori..."
              : progress === 100
              ? "Pemeriksaan selesai. Data siap dipratinjau & dikomit."
              : "Menunggu masukan berkas..."}
          </p>
        </div>
      </div>
    </div>
  );
}