import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { transactionId, status, resolutionNotes } = await request.json();

    const { data, error } = await supabase
      .from("c2_cost_actual_transactions")
      .update({ status: status || "Selesai", updated_at: new Date().toISOString() })
      .eq("id", transactionId)
      .select();

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

    return NextResponse.json({ success: true, message: "Status exception diperbarui", data });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
