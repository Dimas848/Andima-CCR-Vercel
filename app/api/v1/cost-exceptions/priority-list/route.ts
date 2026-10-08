import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");
    const branch = searchParams.get("branch");

    let query = supabase.from("c2_cost_transactions").select("*").order("created_at", { ascending: false });
    if (period) query = query.eq("period_month", period);
    if (branch && branch !== "ALL") query = query.eq("branch_code", branch);

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

    const priorityItems = (data || []).filter((item) => {
      const actual = Number(item.actual_cost || 0);
      const planned = Number(item.planned_cost || 0);
      const isOverBudget = Number(item.variance || (actual - planned)) > 0;
      const isMissingEvidence = !item.has_evidence;
      const isUnmatched = !item.is_job_matched || item.job_number === "UNMATCHED";
      const isHighCost = actual >= 50_000_000;
      const isOpen = item.status === "Terbuka" || item.status_computed === "Terbuka";

      return (item.review_flag || isOverBudget || isMissingEvidence || isUnmatched || isHighCost) && isOpen;
    });

    return NextResponse.json({ success: true, total_priority: priorityItems.length, data: priorityItems });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
