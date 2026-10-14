import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { transaction_ids, transactionId, status, resolutionNotes } = body;

    // MODE 1: Evaluasi Batch Otomatis 3 Tag Anomali sesuai Kontrak TR-2909-003 & FR-2909-003
    if (Array.isArray(transaction_ids)) {
      let query = supabase.from("c2_cost_actual_transactions").select("*");
      if (transaction_ids.length > 0) {
        query = query.in("id", transaction_ids);
      }

      const { data: rows, error: fetchError } = await query;
      if (fetchError) {
        return NextResponse.json({ success: false, message: fetchError.message }, { status: 500 });
      }

      const evaluatedResults = [];

      for (const item of rows || []) {
        const tags: string[] = [];
        const actual = Number(item.actual_cost || 0);
        const planned = Number(item.planned_cost || 0);
        const variance = actual - planned;

        // 1. Tag OVER_BUDGET (FR-CCR2-003-01)
        if (planned > 0 && variance > 0) {
          tags.push("OVER_BUDGET");
        }
        // 2. Tag MISSING_EVIDENCE (FR-CCR2-003-02)
        if (!item.has_evidence) {
          tags.push("MISSING_EVIDENCE");
        }
        // 3. Tag JOB_NOT_FOUND (FR-CCR2-003-03)
        if (
          !item.is_job_matched ||
          !item.job_number ||
          item.job_number === "UNMATCHED" ||
          item.job_number === "-"
        ) {
          tags.push("JOB_NOT_FOUND");
        }

        // Aktivasi Review Flag = TRUE jika ada minimal 1 tag (FR-CCR2-003-04)
        const reviewFlag = tags.length > 0;

        await supabase
          .from("c2_cost_actual_transactions")
          .update({
            review_flag: reviewFlag,
            exception_tags: JSON.stringify(tags),
          })
          .eq("id", item.id);

        evaluatedResults.push({
          transaction_id: item.id,
          job_number: item.job_number,
          exception_tags: tags,
          review_flag: reviewFlag,
          review_flag_display: reviewFlag ? "YES" : "NO",
        });
      }

      return NextResponse.json({
        success: true,
        message: "Evaluasi otomatis 3 tag anomali selesai",
        evaluated_count: evaluatedResults.length,
        data: evaluatedResults,
      });
    }

    // MODE 2: Penyelesaian / Update Status Exception dari UI
    const targetId = transactionId || body.id;
    const finalStatus = status || "Selesai";
    const isResolved = finalStatus === "Selesai";
    const finalNotes = resolutionNotes || `Status diperbarui ke ${finalStatus}`;

    const { data, error } = await supabase
      .from("c2_cost_actual_transactions")
      .update({
        status: finalStatus,
        review_flag: !isResolved,
        description: finalNotes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetId)
      .select();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    await supabase
      .from("c2_cost_exceptions")
      .update({
        is_resolved: isResolved,
        resolution_notes: finalNotes,
      })
      .eq("transaction_id", targetId);

    await supabase
      .from("reconciliation_exceptions")
      .update({
        is_resolved: isResolved,
        resolution_notes: finalNotes,
      })
      .eq("id", targetId);

    await supabase
      .from("job_reconciliations")
      .update({
        review_flag: !isResolved,
      })
      .eq("id", targetId);

    return NextResponse.json({
      success: true,
      message: "Status exception diperbarui",
      data,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}