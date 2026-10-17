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

// Helper mengubah "2026-11" -> "November 2026"
function formatToIndonesianPeriod(val: string): string {
  if (!val) return "";
  const iso = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(val.trim());
  if (iso) {
    const monthIdx = Number(iso[2]) - 1;
    return `${MONTHS_ID[monthIdx]} ${iso[1]}`;
  }
  return val;
}

// Helper mengubah "November 2026" -> "2026-11" untuk input kalender
function toMonthInputValue(periodStr: string): string {
  if (!periodStr) return "";
  const parts = periodStr.trim().split(" ");
  if (parts.length === 2) {
    const idx = MONTHS_ID.findIndex(
      (m) => m.toLowerCase() === parts[0].toLowerCase()
    );
    if (idx >= 0) {
      const monthNum = String(idx + 1).padStart(2, "0");
      return `${parts[1]}-${monthNum}`;
    }
  }
  if (/^\d{4}-\d{2}$/.test(periodStr)) return periodStr;
  return "";
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
    filter.period
      ? query("/api/v1/cost-evidence/history", { period: filter.period })
      : null
  );
  const status = useApi<ValidationData>(
    filter.period
      ? query("/api/v1/cost-validation/summary", { period: filter.period })
      : null
  );

  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const locked = Boolean(status.data?.validation?.is_validated);
  const disabled =
    busy ||
    locked ||
    !filter.period ||
    status.loading ||
    Boolean(status.error) ||
    !user.data;

  const currentMonthValue = useMemo(
    () => toMonthInputValue(filter.period),
    [filter.period]
  );

  function changePeriod(value: string) {
    if (busy) return;
    const formatted = formatToIndonesianPeriod(value);
    filter.setPeriod(formatted);
    setDraft(null);
    setFileName("");
    setError(undefined);
    setNotice(undefined);
  }

  async function preview(file: File | undefined) {
    if (!file || disabled) return;
    setError(undefined);
    setNotice(undefined);
    setDraft(null);
    setFileName(file.name);

    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setError("Pilih berkas Company Sales Report berformat .csv atau .xlsx.");
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
      setDraft(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pratinjau gagal dibuat.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function commit() {
    if (!draft || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const saved = await api<{ upload_id: string; inserted_rows: number }>(
        "/api/v1/cost-ingestion/confirm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId: draft.draftId }),
        }
      );
      setNotice(
        `Penyimpanan berhasil: ${
          saved.inserted_rows ?? draft.records.length
        } baris. ID unggahan: ${saved.upload_id}. Waktu unggah tersedia pada riwayat.`
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

  return (
    <Workspace
      title="Data Upload"
      description="Unggah Company Sales Report, periksa 14 kolom dan ringkasan, lalu konfirmasi penyimpanan."
      action={
        <Link href="/evidence" className={secondaryClass}>
          Lihat Evidence
        </Link>
      }
    >
      <Filters
        {...filter}
        onPeriod={changePeriod}
        refresh={() => {
          filter.reload();
          history.reload();
          status.reload();
        }}
      />

      <Card title="Periode dan dokumen sumber">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <label className="text-xs font-semibold text-slate-600">
            Periode baru (bila belum ada pada daftar)
            <input
              type="month"
              value={currentMonthValue}
              className={`${fieldClass} mt-1.5`}
              disabled={busy}
              onChange={(event) => {
                if (event.target.value) changePeriod(event.target.value);
              }}
            />
          </label>
          <div className="text-sm text-slate-500">
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
          </div>
        </div>

        <LoadState
          loading={filter.loading || status.loading || user.loading}
          error={filter.error || status.error || user.error}
          onRetry={() => {
            status.reload();
            user.reload();
          }}
        />

        {locked && (
          <Notice>
            Periode ini telah divalidasi. Unggahan baru tidak dapat disimpan
            pada periode terkunci.
          </Notice>
        )}

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
              : "border-slate-300 bg-slate-50"
          }`}
        >
          <UploadCloud className="mx-auto mb-3 text-sky-700" size={36} />
          <p className="font-semibold text-slate-800">
            Tarik berkas Company Sales Report ke sini
          </p>
          <p className="mb-4 mt-2 text-sm text-slate-500">
            CSV atau XLSX · maksimal 25 MB · pilih periode terlebih dahulu
          </p>
          <input
            ref={input}
            type="file"
            className="sr-only"
            accept=".csv,.xlsx"
            aria-label="Pilih Company Sales Report"
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
          {fileName && (
            <p className="mt-3 break-all text-sm font-medium text-slate-700">
              {fileName}
            </p>
          )}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Kolom wajib: Periode, Job Number, Company, MAWB No., CW, DEST, Invoice
          Nominal, Sub Total, VAT, Cost PPH 23, Others, DIP IATA, Total Cost,
          dan Profit.
        </p>
      </Card>

      {error && <Notice error>{error}</Notice>}
      {notice && <Notice>{notice}</Notice>}

      {draft && (
        <>
          <Kpis
            items={[
              {
                label: "Baris valid",
                value: number(draft.records.length),
              },
              {
                label: "Total perusahaan",
                value: number(
                  new Set(draft.records.map((row) => row.company_name)).size
                ),
              },
              {
                label: "Total Cost",
                value: money(
                  draft.records.reduce(
                    (sum, row) => sum + amount(row.total_cost),
                    0
                  )
                ),
              },
            ]}
          />
          {draft.warnings?.map((warning, index) => (
            <Notice key={index}>{warning}</Notice>
          ))}
          <Card
            title={`Pratinjau 14 kolom · ${draft.period}`}
            action={
              <button
                type="button"
                className={buttonClass}
                disabled={busy || locked}
                onClick={() => setConfirm(true)}
              >
                Konfirmasi penyimpanan
              </button>
            }
          >
            <SalesTable records={draft.records} />
          </Card>
        </>
      )}

      <Card title="Riwayat unggahan periode">
        <LoadState
          loading={history.loading}
          error={history.error}
          onRetry={history.reload}
        />
        {history.data && <HistoryTable rows={history.data} />}
      </Card>

      {confirm && draft && (
        <Modal
          title="Konfirmasi penyimpanan Company Sales Report"
          onClose={() => setConfirm(false)}
          busy={busy}
        >
          <p className="text-sm leading-relaxed text-slate-700">
            Simpan <strong>{draft.records.length} baris</strong> dari{" "}
            <strong>{fileName}</strong> untuk periode{" "}
            <strong>{draft.period}</strong>? Data biaya dan riwayat unggahan
            akan disimpan bersama.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              className={secondaryClass}
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Kembali ke pratinjau
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={busy}
              onClick={() => void commit()}
            >
              {busy ? "Menyimpan…" : "Simpan data"}
            </button>
          </div>
        </Modal>
      )}
    </Workspace>
  );
}