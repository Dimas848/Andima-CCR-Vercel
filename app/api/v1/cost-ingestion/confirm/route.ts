import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { batchInfo, transactions } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ success: false, message: "Data transaksi kosong" }, { status: 400 });
    }

    const { data: batchData, error: batchError } = await supabase
      .from("c2_cost_ingestion_batches")
      .insert({
        file_name: batchInfo?.fileName || "upload_data.xlsx",
        file_size_bytes: batchInfo?.fileSizeBytes || 0,
        period_month: batchInfo?.periodMonth || "September 2026",
        branch_code: batchInfo?.branchCode || "Jakarta Pusat",
        total_rows: batchInfo?.totalRows || transactions.length,
        valid_rows: transactions.length,
        error_rows: batchInfo?.errorRows || 0,
        total_amount: transactions.reduce((s: number, t: { actual_cost?: number }) => s + Number(t.actual_cost || 0), 0),
        status: "COMMITTED",
      })
      .select()
      .single();

    if (batchError) {
      return NextResponse.json({ success: false, message: batchError.message }, { status: 500 });
    }

    const payload = transactions.map((t: Record<string, unknown>) => ({
      voucher_no: t.voucher_no || `VCH-${Date.now()}`,
      job_number: t.job_number || "UNMATCHED",
      customer_name: t.customer_name || "-",
      branch_code: t.branch_code || "Jakarta Pusat",
      cost_category: t.cost_category || "OPERATIONAL",
      period_month: t.period_month || "September 2026",
      planned_cost: Number(t.planned_cost || 0),
      actual_cost: Number(t.actual_cost || 0),
      has_evidence: Boolean(t.has_evidence),
      reconciliation_result: t.job_number && t.job_number !== "UNMATCHED" ? "MATCH" : "UNMATCHED",
      review_flag: Boolean(t.review_flag),
      exception_tags: Array.isArray(t.exception_tags) ? JSON.stringify(t.exception_tags) : "[]",
      status: t.status || "Terbuka",
      description: `Batch #${batchData.batch_id.slice(0, 8)}`,
    }));

    const { data: insertedData, error: insertError } = await supabase
      .from("c2_cost_actual_transactions")
      .insert(payload)
      .select();

    if (insertError) {
      return NextResponse.json({ success: false, message: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Data tersimpan",
      batch_id: batchData.batch_id,
      inserted_rows: insertedData.length,
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
