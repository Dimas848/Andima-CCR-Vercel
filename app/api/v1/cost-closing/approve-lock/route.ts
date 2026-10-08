import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { periodMonth, managerNotes, totalAmount } = await request.json();

    const { data: lockData, error: lockError } = await supabase
      .from("c2_cost_period_locks")
      .upsert({
        period_month: periodMonth,
        status: "CLOSED",
        total_locked_amount: Number(totalAmount || 0),
        locked_at: new Date().toISOString(),
        override_notes: managerNotes || "Persetujuan tutup buku",
      }, { onConflict: "period_month" })
      .select();

    if (lockError) return NextResponse.json({ success: false, message: lockError.message }, { status: 500 });

    await supabase.from("c2_cost_closing_audit_logs").insert({
      period_month: periodMonth,
      action_type: "LOCK_PERIOD",
      unresolved_exceptions_count: 0,
      manager_notes: managerNotes || "Periode dikunci secara sah",
      action_timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, message: "Periode berhasil dikunci", data: lockData });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
