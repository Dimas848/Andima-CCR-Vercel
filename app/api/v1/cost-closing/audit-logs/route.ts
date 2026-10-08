import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("c2_cost_closing_audit_logs")
      .select("*")
      .order("action_timestamp", { ascending: false });

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

    return NextResponse.json({ success: true, logs: data || [] });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
