import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "September 2026";

    const { data, error } = await supabase
      .from("c2_cost_period_locks")
      .select("*")
      .eq("period_month", period)
      .maybeSingle();

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      period_month: period,
      status: data?.status || "OPEN",
      is_locked: data?.status === "CLOSED",
      details: data || null,
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
