"use client";
import { useState } from "react";
import Link from "next/link";
import { Workspace, Filters, LoadState, Card, Kpis, HistoryTable, DataTable, Modal, Notice, Status, buttonClass, secondaryClass, fieldClass } from "@/components/c2-workspace";
import { api, amount, money, number, query, timestamp, useApi, usePeriod, type Audit, type ValidationData, type UserInfo } from "@/lib/c2-client";

export default function ValidationPage() {
  const filter = usePeriod();
  const user = useApi<UserInfo>("/api/auth/me");
  const result = useApi<ValidationData>(filter.period ? query("/api/v1/cost-validation/summary", {period: filter.period}) : null);
  const audit = useApi<Audit[]>(filter.period ? query("/api/v1/cost-validation/audit-logs", {period: filter.period}) : null);
  const [confirm, setConfirm] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const data = result.data;
  const locked = Boolean(data?.validation?.is_validated);
  const sum = (key: "sum_sub_total" | "sum_vat" | "sum_pph23" | "sum_total_cost") => data?.companies.reduce((total, row) => total + amount(row[key]), 0) ?? 0;
  async function lock() {
    if (busy || !data || locked) return;
    setBusy(true); setError(undefined);
    try {
      await api("/api/v1/cost-validation/lock", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({period: filter.period, notes})});
      setConfirm(false); setNotes(""); setNotice(`Periode ${filter.period} berhasil divalidasi dan dikunci.`); result.reload(); audit.reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Validasi gagal."); }
    finally { setBusy(false); }
  }
  return <Workspace title="Validation" description="Periksa kelengkapan biaya, komponen pajak, dan evidence sebelum mengesahkan serta mengunci periode secara permanen.">
    <Filters {...filter} onPeriod={value => {filter.setPeriod(value); setNotes(""); setNotice(undefined); setError(undefined);}} refresh={() => {result.reload(); audit.reload(); user.reload();}} />
    <LoadState loading={filter.loading || result.loading || user.loading} error={filter.error || result.error || user.error} onRetry={() => {result.reload(); user.reload();}} />
    {notice && <Notice>{notice}</Notice>}{error && !confirm && <Notice error>{error}</Notice>}
    {!filter.loading && !filter.period && !filter.error && <Notice>Belum ada periode yang dapat diperiksa.</Notice>}
    {data && <>
      <Card title={`Status periode · ${filter.period}`} action={<Status validated={locked} />}>
        <p className="text-sm">{data.history.length ? `${data.history.length} dokumen unggahan tercatat, mencakup ${data.companies.reduce((total, row) => total + Number(row.total_jobs_count), 0)} rincian biaya.` : "Belum ada Company Sales Report pada periode ini."}</p>
        {locked ? <div className="mt-4 space-y-2 text-sm"><p>Disahkan oleh {data.validation?.validated_by || "Identitas belum tercatat"} · {data.validation?.validated_by_role || "Peran belum tercatat"}</p><p>{timestamp(data.validation?.validated_at)}</p><p>Catatan: {data.validation?.validation_notes || "Tidak ada catatan"}</p><Link className={`${buttonClass} mt-3`} href={query("/export-report", {period: filter.period})}>Buka Report</Link></div> : <div className="mt-4">{user.data?.canValidate ? <button type="button" className={buttonClass} disabled={busy || !data.companies.length || !data.history.length} onClick={() => {setConfirm(true); setError(undefined);}}>Validasi &amp; Kunci Data</button> : <p className="text-sm text-slate-500">Pengesahan tersedia untuk Manager of Accounting, Tax Manager, dan Director of FAT.</p>}</div>}
      </Card>
      <Kpis items={[
        {label: "Total perusahaan", value: number(data.companies.length)},
        {label: "Sub Total Cost", value: money(sum("sum_sub_total"))},
        {label: "VAT (PPN 11%)", value: money(sum("sum_vat"))},
        {label: "Cost PPh 23", value: money(sum("sum_pph23"))},
        {label: "Total Cost Bulanan", value: money(sum("sum_total_cost"))},
      ]} />
      <Card title="Pemeriksaan timestamp evidence"><HistoryTable rows={data.history} /></Card>
    </>}
    <Card title="Audit pengesahan"><LoadState loading={audit.loading} error={audit.error} onRetry={audit.reload} />{audit.data && <DataTable rows={audit.data} rowKey={row => row.log_id} columns={[
      {label: "Waktu", cell: row => timestamp(row.action_timestamp)},
      {label: "Validator", cell: row => row.actor_name || "Belum tercatat"},
      {label: "Jabatan", cell: row => row.actor_role || "Belum tercatat"},
      {label: "Tindakan", cell: row => row.action_type},
      {label: "Total biaya", cell: row => money(row.total_cost_amount), numeric: true},
      {label: "Catatan", cell: row => row.validation_notes || "—"},
    ]} />}</Card>
    {confirm && data && <Modal title={`Validasi & Kunci Data · ${filter.period}`} onClose={() => setConfirm(false)} busy={busy}><Notice>Setelah disahkan, biaya, evidence, dan status periode ini tidak dapat diubah. Total biaya yang diperiksa: {money(sum("sum_total_cost"))}.</Notice><label className="block text-sm font-medium">Catatan pengesahan<textarea className={`${fieldClass} mt-2`} rows={4} value={notes} maxLength={1000} onChange={event => setNotes(event.target.value)} /></label>{error && <Notice error>{error}</Notice>}<div className="flex justify-end gap-3"><button type="button" className={secondaryClass} disabled={busy} onClick={() => setConfirm(false)}>Kembali</button><button type="button" className={buttonClass} disabled={busy || !notes.trim()} onClick={() => void lock()}>{busy ? "Mengesahkan…" : "Validasi & Kunci Data"}</button></div></Modal>}
  </Workspace>;
}
