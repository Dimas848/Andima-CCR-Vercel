import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");
    const branch = searchParams.get("branch");

    let query = supabase.from("c2_cost_transactions").select("*");
    if (period) query = query.eq("period_month", period);
    if (branch && branch !== "ALL") query = query.eq("branch_code", branch);

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

    const rows = data || [];
    const totalActual = rows.reduce((s, r) => s + Number(r.actual_cost || 0), 0);
    const totalPlanned = rows.reduce((s, r) => s + Number(r.planned_cost || 0), 0);

    return NextResponse.json({
      success: true,
      summary: {
        total_records: rows.length,
        total_actual_cost: totalActual,
        total_planned_cost: totalPlanned,
        total_variance: totalActual - totalPlanned,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
