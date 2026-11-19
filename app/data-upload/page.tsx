"use client";

import { useRef, useState, useMemo } from "react";
import Link from "next/link";
import { UploadCloud } from "lucide-react";
import {
  Workspace,
  Filters,
  Card,
  Kpis,
  LoadState,
  Notice,
  SalesTable,
  HistoryTable,
  Modal,
  Status,
  countRecordsIssues,
  buttonClass,
  secondaryClass,
  fieldClass,
} from "@/components/c2-workspace";
import {
  api,
  amount,
  money,
  number,
  query,
  useApi,
  usePeriod,
  type Evidence,
  type SalesRecord,
  type ValidationData,
  type UserInfo,
} from "@/lib/c2-client";

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function getCurrentMaxMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatToIndonesianPeriod(val: string): string {
  if (!val) return "";
  const iso = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(val.trim());
  if (iso) {
    const monthIdx = Number(iso[2]) - 1;
    return `${MONTHS_ID[monthIdx]} ${iso[1]}`;
  }
  return val;
}

function toMonthInputValue(periodStr: string): string {
  if (!periodStr) return "";
  const parts = periodStr.trim().split(" ");
  if (parts.length === 2) {
    const idx = MONTHS_ID.findIndex((m) => m.toLowerCase() === parts[0].toLowerCase());
    if (idx >= 0) {
      const monthNum = String(idx + 1).padStart(2, "0");
      return `${parts[1]}-${monthNum}`;
    }
  }
  if (/^\d{4}-\d{2}$/.test(periodStr)) return periodStr;
  return "";
}

function isFuturePeriod(periodStr: string): boolean {
  const ym = toMonthInputValue(periodStr);
  if (!ym) return false;
  const maxYm = getCurrentMaxMonth();
  return ym > maxYm;
}

function UploadErrorNotice({ message }: { message: string }) {
  const headerMatch = message.match(/^(.*?kolom)\s*:\s*([\s\S]+)$/i);

  if (headerMatch) {
    const heading = headerMatch[1].trim();
    const rest = headerMatch[2].trim();
    const sentenceSplit = rest.split(/(?<!No)\.\s+(?=[A-Z])/);
    const rawColumns = sentenceSplit[0] ?? "";
    const extraNotes = sentenceSplit
      .slice(1)
      .map((item) => item.trim())
      .filter(Boolean);

    const columns = rawColumns
      .replace(/\.$/, "")
      .split(",")
      .map((col) => col.trim())
      .filter(Boolean);

    return (
      <Notice error>
        <div className="space-y-2.5">
          <p className="font-semibold">{heading}:</p>
          {columns.length > 0 && (
            <ol className="columns-1 gap-x-8 space-y-1 sm:columns-2 lg:columns-3">
              {columns.map((col, idx) => (
                <li key={`${col}-${idx}`} className="flex items-baseline gap-2 break-inside-avoid">
                  <span className="w-6 shrink-0 text-right font-medium tabular-nums">{idx + 1}.</span>
                  <span>{col}</span>
                </li>
              ))}
            </ol>
          )}
          {extraNotes.length > 0 && (
            <ul className="list-disc space-y-1 border-t border-red-200/80 pl-5 pt-2">
              {extraNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      </Notice>
    );
  }

  const points = message
    .split(/\n+|;\s+|(?<!No)\.\s+(?=[A-Z])/)
    .map((item) => item.trim().replace(/\.$/, ""))
    .filter(Boolean);

  if (points.length > 1) {
    return (
      <Notice error>
        <ul className="list-disc space-y-1 pl-5">
          {points.map((point, idx) => (
            <li key={idx}>{point}.</li>
          ))}
        </ul>
      </Notice>
    );
  }

  return <Notice error>{message}</Notice>;
}

interface Draft {
  draftId: string;
  upload_id: string;
  period: string;
  records: SalesRecord[];
  warnings: string[];
}

export default function DataUploadPage() {
  const filter = usePeriod();
  const user = useApi<UserInfo>("/api/auth/me");
  const history = useApi<Evidence[]>(
    filter.period ? query("/api/v1/cost-evidence/history", { period: filter.period }) : null
  );
  const status = useApi<ValidationData>(
    filter.period ? query("/api/v1/cost-validation/summary", { period: filter.period }) : null
  );

  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const maxAllowedMonth = useMemo(() => getCurrentMaxMonth(), []);
  const maxAllowedLabel = useMemo(() => formatToIndonesianPeriod(maxAllowedMonth), [maxAllowedMonth]);
  const currentMonthValue = useMemo(() => toMonthInputValue(filter.period), [filter.period]);
  const futureBlocked = useMemo(() => isFuturePeriod(filter.period), [filter.period]);

  const locked = Boolean(status.data?.validation?.is_validated);
  const isInitialLoading = filter.loading || status.loading || user.loading;

  const disabled =
    busy ||
    locked ||
    futureBlocked ||
    !filter.period ||
    isInitialLoading ||
    Boolean(status.error) ||
    !user.data;

  function changePeriod(value: string) {
    if (busy) return;
    const formatted = formatToIndonesianPeriod(value);
    setDraft(null);
    setFileName("");
    setNotice(undefined);

    if (isFuturePeriod(formatted)) {
      filter.setPeriod(formatted);
      setError(
        `Kalender ${formatted} belum berjalan. Unggahan data hanya diizinkan maksimal sampai bulan berjalan (${maxAllowedLabel}).`
      );
      return;
    }

    setError(undefined);
    filter.setPeriod(formatted);
  }

  async function preview(file: File | undefined) {
    if (!file || disabled) return;
    if (isFuturePeriod(filter.period)) {
      setError(
        `Tidak dapat mengunggah data untuk bulan mendatang (${filter.period}). Maksimal kalender yang diizinkan adalah ${maxAllowedLabel}.`
      );
      return;
    }

    setError(undefined);
    setNotice(undefined);
    setDraft(null);
    setFileName(file.name);

    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setError("Pilih berkas Laporan Penjualan Perusahaan berformat .csv atau .xlsx.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("Ukuran berkas maksimal 25 MB.");
      return;
    }

    const form = new FormData();
    form.set("file", file);
    form.set("period", formatToIndonesianPeriod(filter.period));

    setBusy(true);
    try {
      const res = await api<Draft>("/api/v1/cost-ingestion/upload", {
        method: "POST",
        body: form,
      });
      if (isFuturePeriod(res.period)) {
        setError(
          `Berkas ditolak: Isi berkas menunjukkan bulan mendatang (${res.period}). Maksimal kalender yang diizinkan adalah ${maxAllowedLabel}.`
        );
        return;
      }
      setDraft(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pratinjau gagal dibuat.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function commit() {
    if (!draft || busy || isFuturePeriod(draft.period)) return;
    setBusy(true);
    setError(undefined);
    try {
      const saved = await api<{ upload_id: string; inserted_rows: number }>("/api/v1/cost-ingestion/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.draftId }),
      });
      setNotice(
        `Penyimpanan berhasil: ${saved.inserted_rows ?? draft.records.length} baris. ID unggahan: ${
          saved.upload_id
        }. Waktu unggah tersedia pada riwayat.`
      );
      setDraft(null);
      setConfirm(false);
      history.reload();
      status.reload();
      filter.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Penyimpanan gagal.");
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  const draftSum = (
    key: "sub_total" | "vat_amount" | "pph23_amount" | "others_cost" | "dip_iata_cost" | "total_cost"
  ) => draft?.records.reduce((total, row) => total + amount(row[key]), 0) ?? 0;

  return (
    <Workspace
      title=""
      description=""
      action={
        <Link href="/evidence" className={secondaryClass}>
          Lihat Bukti Dokumen
        </Link>
      }
    >
      <Filters
        {...filter}
        periods={filter.periods.filter((p) => !isFuturePeriod(p))}
        loading={isInitialLoading}
        onPeriod={changePeriod}
        refresh={() => {
          filter.reload();
          history.reload();
          status.reload();
        }}
      />

      <Card title="Kalender">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          {isInitialLoading ? (
            <div className="animate-[pulse_0.85s_ease-in-out_infinite] space-y-2">
              <div className="h-3.5 w-56 rounded bg-slate-200" />
              <div className="h-10 w-52 rounded-lg bg-slate-200" />
            </div>
          ) : (
            <label className="text-xs font-semibold text-slate-600">
              Kalender laporan
              <input
                type="month"
                value={currentMonthValue}
                max={maxAllowedMonth}
                className={`${fieldClass} mt-1.5`}
                disabled={busy}
                onChange={(event) => {
                  if (event.target.value) changePeriod(event.target.value);
                }}
              />
            </label>
          )}
          <div className="text-sm text-slate-500">
            {isInitialLoading ? (
              <div className="animate-[pulse_0.85s_ease-in-out_infinite] space-y-2">
                <div className="h-4 w-48 rounded bg-slate-200" />
                <div className="ml-auto h-6 w-28 rounded-full bg-slate-200" />
              </div>
            ) : (
              <>
                {user.data && (
                  <p>
                    {user.data.name} · {user.data.role}
                  </p>
                )}
                {status.data && (
                  <div className="mt-2">
                    <Status validated={locked} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {(filter.error || status.error || user.error) && (
          <LoadState
            loading={false}
            error={filter.error || status.error || user.error}
            onRetry={() => {
              status.reload();
              user.reload();
            }}
          />
        )}

        {locked && (
          <Notice>
            Kalender ini telah disahkan dan dikunci. Unggahan baru tidak dapat disimpan pada kalender yang sudah terkunci.
          </Notice>
        )}

        {futureBlocked && (
          <Notice error>
            Kalender {filter.period} belum berjalan. Sistem mengunci unggahan untuk bulan mendatang (maksimal kalender
            yang diizinkan: {maxAllowedLabel}).
          </Notice>
        )}

        {isInitialLoading ? (
          <div className="mt-4 animate-[pulse_0.85s_ease-in-out_infinite] rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <div className="mx-auto mb-3 h-9 w-9 rounded-full bg-slate-200" />
            <div className="mx-auto h-4 w-64 rounded bg-slate-200" />
            <div className="mx-auto mt-2 h-3.5 w-80 rounded bg-slate-100" />
            <div className="mx-auto mt-4 h-10 w-32 rounded-lg bg-slate-200" />
          </div>
        ) : (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!disabled) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (event.dataTransfer.files.length > 1) {
                setError("Unggah satu berkas setiap kali.");
              } else {
                void preview(event.dataTransfer.files[0]);
              }
            }}
            className={`mt-4 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging
                ? "border-sky-600 bg-sky-100"
                : disabled
                ? "border-slate-200 bg-slate-100/70 opacity-75"
                : "border-slate-300 bg-slate-50"
            }`}
          >
            <UploadCloud className="mx-auto mb-3 text-sky-700" size={36} />
            <p className="font-semibold text-slate-800">Tarik berkas Laporan Penjualan Perusahaan ke sini</p>
            <p className="mb-4 mt-2 text-sm text-slate-500">
              CSV atau XLSX · maksimal 25 MB · hanya untuk bulan berjalan atau sebelumnya
            </p>
            <input
              ref={input}
              type="file"
              className="sr-only"
              accept=".csv,.xlsx"
              aria-label="Pilih Laporan Penjualan Perusahaan"
              disabled={disabled}
              onChange={(event) => void preview(event.target.files?.[0])}
            />
            <button
              type="button"
              className={buttonClass}
              disabled={disabled}
              onClick={() => input.current?.click()}
            >
              {busy ? "Memproses…" : "Pilih berkas"}
            </button>
            {fileName && <p className="mt-3 break-all text-sm font-medium text-slate-700">{fileName}</p>}
          </div>
        )}

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Kolom wajib: Kalender, Nomor Job, Perusahaan, No. MAWB, CW, Tujuan, Nominal Invoice, DPP (Sub Total), PPN (VAT
          11%), PPh 23, Lain-lain, DIP IATA, Total Biaya, dan Keuntungan.
        </p>
      </Card>

      {error && <UploadErrorNotice message={error} />}
      {notice && <Notice>{notice}</Notice>}

      {draft && (
        <>
          <Kpis
            items={[
              {
                label: "1. Total Perusahaan",
                value: number(new Set(draft.records.map((row) => row.company_name)).size),
                detail: `${number(draft.records.length)} baris transaksi valid`,
              },
              {
                label: "2. DPP (Dasar Pengenaan Pajak)",
                value: money(draftSum("sub_total")),
              },
              {
                label: "3. PPN (VAT 11%)",
                value: money(draftSum("vat_amount")),
              },
              {
                label: "4. PPh 23 (2%)",
                value: money(draftSum("pph23_amount")),
              },
              {
                label: "5. Lain-lain",
                value: money(draftSum("others_cost")),
              },
              {
                label: "6. DIP IATA",
                value: money(draftSum("dip_iata_cost")),
              },
              {
                label: "7. Total Biaya Bulanan",
                value: money(draftSum("total_cost")),
              },
              {
                label: "8. Total Kendala",
                value: `${number(countRecordsIssues(draft.records))} Kendala`,
                alert: countRecordsIssues(draft.records) > 0,
              },
            ]}
          />
          {draft.warnings?.map((warning, index) => (
            <Notice key={index}>{warning}</Notice>
          ))}
          <Card
            title={`Pratinjau 14 Kolom · ${draft.period}`}
            action={
              <button
                type="button"
                className={buttonClass}
                disabled={busy || locked || futureBlocked}
                onClick={() => setConfirm(true)}
              >
                Konfirmasi Penyimpanan
              </button>
            }
          >
            <SalesTable records={draft.records} />
          </Card>
        </>
      )}

      <Card title="Riwayat Unggahan Kalender">
        <LoadState
          loading={isInitialLoading || history.loading}
          error={!isInitialLoading ? history.error : undefined}
          onRetry={history.reload}
          variant="table-inner"
          rows={4}
        />
        {!isInitialLoading && !history.loading && history.data && <HistoryTable rows={history.data} />}
      </Card>

      {confirm && draft && (
        <Modal
          title="Konfirmasi Penyimpanan Laporan Penjualan Perusahaan"
          onClose={() => setConfirm(false)}
          busy={busy}
        >
          <p className="text-sm leading-relaxed text-slate-700">
            Simpan <strong>{draft.records.length} baris</strong> dari <strong>{fileName}</strong> untuk kalender{" "}
            <strong>{draft.period}</strong>? Data biaya dan riwayat unggahan akan disimpan bersama.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className={secondaryClass} disabled={busy} onClick={() => setConfirm(false)}>
              Kembali ke pratinjau
            </button>
            <button type="button" className={buttonClass} disabled={busy} onClick={() => void commit()}>
              {busy ? "Menyimpan…" : "Simpan data"}
            </button>
          </div>
        </Modal>
      )}
    </Workspace>
  );
}