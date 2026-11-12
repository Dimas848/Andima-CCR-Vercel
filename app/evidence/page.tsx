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
  timestamp,
  useApi,
  usePeriod,
  type Evidence,
  type SalesRecord,
  type UserInfo,
} from "@/lib/c2-client";

interface Preview {
  evidence: Evidence;
  records: SalesRecord[];
}

export default function EvidencePage() {
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
        `Bukti dokumen ${deletion.file_name} telah dihapus. Jejak audit penghapusan disimpan.${
          deleted.warning ? ` ${deleted.warning}` : ""
        }`
      );
      setDeletion(null);
      setSelected(null);
      history.reload();
      filter.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Penghapusan gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Workspace
      title="Evidence"
      description="Riwayat dokumen Laporan Penjualan Perusahaan beserta waktu unggah dan identitas pengunggah. Tanggal dan jam ditampilkan dalam WIB."
    >
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
            ? "Hak hapus tersedia untuk Manajer yang berwenang pada periode yang masih terbuka. Periode yang sudah tervalidasi otomatis terkunci."
            : "Akses baca dan pratinjau. Penghapusan bukti dokumen hanya tersedia bagi Manajer yang berwenang."}
        </Notice>
      )}

      <Card title="Riwayat Unggahan & Log Stempel Waktu Bukti">
        <LoadState
          loading={isLoading}
          error={loadError}
          onRetry={() => {
            history.reload();
            user.reload();
          }}
          variant="table"
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
        <Modal title={`Pratinjau · ${selected.file_name}`} onClose={() => setSelected(null)}>
          <p className="text-sm">
            Periode: {selected.period_month} · Diunggah: {timestamp(selected.uploaded_at)} · Oleh:{" "}
            {selected.uploaded_by_name || "Belum tercatat"}
          </p>
          <LoadState
            loading={preview.loading}
            error={preview.error}
            onRetry={preview.reload}
            variant="table"
            rows={4}
          />
          {!preview.loading && preview.data && (
            <>
              <p className="text-sm">
                {preview.data.records.length} rincian tersimpan · Total log:{" "}
                {money(preview.data.evidence.total_cost_amount)}
              </p>
              <SalesTable records={preview.data.records} />
              <p className="text-xs text-slate-500">
                Pratinjau menampilkan isi laporan yang tersimpan dan terhubung ke bukti dokumen ini.
              </p>
            </>
          )}
        </Modal>
      )}

      {deletion && (
        <Modal
          title="Hapus Bukti Dokumen"
          onClose={() => {
            setDeletion(null);
            setError(undefined);
          }}
          busy={busy}
        >
          <Notice error>
            Penghapusan {deletion.file_name} juga akan menghapus rincian biaya yang terhubung pada periode{" "}
            {deletion.period_month}. Tindakan ini akan dicatat dalam jejak audit.
          </Notice>
          {error && <Notice error>{error}</Notice>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className={secondaryClass}
              disabled={busy}
              onClick={() => setDeletion(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className={`${buttonClass} bg-red-700 hover:bg-red-800`}
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "Menghapus…" : "Hapus bukti dan rinciannya"}
            </button>
          </div>
        </Modal>
      )}
    </Workspace>
  );
}