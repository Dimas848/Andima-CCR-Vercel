"use client";

import { useState } from "react";
import {
  Workspace,
  Filters,
  LoadState,
  Card,
  HistoryTable,
  Modal,
  SalesTable,
  Notice,
  buttonClass,
  secondaryClass,
} from "@/components/c2-workspace";
import {
  api,
  money,
  query,
  useApi,
  usePeriod,
  type Evidence,
  type SalesRecord,
  type UserInfo,
} from "@/lib/c2-client";
import { formatPeriodLabel, formatTimestamp, useLang } from "@/lib/c2-i18n";

interface Preview {
  evidence: Evidence;
  records: SalesRecord[];
}

export default function EvidencePage() {
  const { lang, isEn } = useLang();
  const filter = usePeriod();
  const user = useApi<UserInfo>("/api/auth/me");
  const history = useApi<Evidence[]>(
    filter.period ? query("/api/v1/cost-evidence/history", { period: filter.period }) : null
  );
  const [selected, setSelected] = useState<Evidence | null>(null);
  const preview = useApi<Preview>(
    selected ? `/api/v1/cost-evidence/history/${encodeURIComponent(selected.upload_id)}` : null
  );
  const [deletion, setDeletion] = useState<Evidence | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const isLoading = filter.loading || history.loading || user.loading;
  const loadError = filter.error || history.error || user.error;

  async function remove() {
    if (!deletion || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const deleted = await api<{ warning?: string }>(
        `/api/v1/cost-evidence/history/${encodeURIComponent(deletion.upload_id)}`,
        { method: "DELETE" }
      );
      setNotice(
        isEn
          ? `Document evidence ${deletion.file_name} has been deleted. Deletion audit trail saved.${
              deleted.warning ? ` ${deleted.warning}` : ""
            }`
          : `Bukti dokumen ${deletion.file_name} telah dihapus. Jejak audit penghapusan disimpan.${
              deleted.warning ? ` ${deleted.warning}` : ""
            }`
      );
      setDeletion(null);
      setSelected(null);
      history.reload();
      filter.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : isEn ? "Deletion failed." : "Penghapusan gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Workspace title="" description="">
      <Filters
        {...filter}
        loading={isLoading}
        onPeriod={(value) => {
          filter.setPeriod(value);
          setSelected(null);
        }}
        refresh={() => {
          filter.reload();
          history.reload();
          user.reload();
        }}
      />

      {notice && <Notice>{notice}</Notice>}
      {error && !deletion && <Notice error>{error}</Notice>}

      {!isLoading && !loadError && (
        <Notice>
          {user.data?.canDelete
            ? isEn
              ? "Delete permission is available for authorized Managers on open periods. Validated periods are automatically locked."
              : "Hak hapus tersedia untuk Manajer yang berwenang pada periode yang masih terbuka. Periode yang sudah tervalidasi otomatis terkunci."
            : isEn
            ? "Read and preview access only. Deleting document evidence is restricted to authorized Managers."
            : "Akses baca dan pratinjau. Penghapusan bukti dokumen hanya tersedia bagi Manajer yang berwenang."}
        </Notice>
      )}

      <Card
        title={
          isEn
            ? "Upload History & Document Timestamp Log"
            : "Riwayat Unggahan & Log Stempel Waktu Bukti"
        }
      >
        <LoadState
          loading={isLoading}
          error={!isLoading ? loadError : undefined}
          onRetry={() => {
            history.reload();
            user.reload();
          }}
          variant="table-inner"
          rows={5}
        />
        {!isLoading && !loadError && (
          <HistoryTable
            rows={history.data ?? []}
            onPreview={setSelected}
            onDelete={
              user.data?.canDelete
                ? (row) => {
                    setDeletion(row);
                    setError(undefined);
                  }
                : undefined
            }
          />
        )}
      </Card>

      {selected && (
        <Modal
          title={`${isEn ? "Preview" : "Pratinjau"} · ${selected.file_name}`}
          onClose={() => setSelected(null)}
        >
          <p className="text-sm">
            {isEn ? "Period" : "Periode"}: {formatPeriodLabel(selected.period_month, lang)} ·{" "}
            {isEn ? "Uploaded" : "Diunggah"}: {formatTimestamp(selected.uploaded_at, lang)} ·{" "}
            {isEn ? "By" : "Oleh"}: {selected.uploaded_by_name || (isEn ? "Not recorded" : "Belum tercatat")}
          </p>
          <LoadState
            loading={preview.loading}
            error={preview.error}
            onRetry={preview.reload}
            variant="table-inner"
            rows={4}
          />
          {!preview.loading && preview.data && (
            <>
              <p className="text-sm">
                {preview.data.records.length} {isEn ? "saved records" : "rincian tersimpan"} ·{" "}
                {isEn ? "Log total" : "Total log"}: {money(preview.data.evidence.total_cost_amount)}
              </p>
              <SalesTable records={preview.data.records} />
              <p className="text-xs text-slate-500">
                {isEn
                  ? "Preview displays the saved report contents linked to this document evidence."
                  : "Pratinjau menampilkan isi laporan yang tersimpan dan terhubung ke bukti dokumen ini."}
              </p>
            </>
          )}
        </Modal>
      )}

      {deletion && (
        <Modal
          title={isEn ? "Delete Document Evidence" : "Hapus Bukti Dokumen"}
          onClose={() => {
            setDeletion(null);
            setError(undefined);
          }}
          busy={busy}
        >
          <Notice error>
            {isEn
              ? `Deleting ${deletion.file_name} will also remove the linked cost records for period ${formatPeriodLabel(
                  deletion.period_month,
                  lang
                )}. This action will be recorded in the audit trail.`
              : `Penghapusan ${deletion.file_name} juga akan menghapus rincian biaya yang terhubung pada periode ${formatPeriodLabel(
                  deletion.period_month,
                  lang
                )}. Tindakan ini akan dicatat dalam jejak audit.`}
          </Notice>
          {error && <Notice error>{error}</Notice>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className={secondaryClass}
              disabled={busy}
              onClick={() => setDeletion(null)}
            >
              {isEn ? "Cancel" : "Batal"}
            </button>
            <button
              type="button"
              className={`${buttonClass} bg-red-700 hover:bg-red-800`}
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy
                ? isEn
                  ? "Deleting…"
                  : "Menghapus…"
                : isEn
                ? "Delete evidence & records"
                : "Hapus bukti dan rinciannya"}
            </button>
          </div>
        </Modal>
      )}
    </Workspace>
  );
}