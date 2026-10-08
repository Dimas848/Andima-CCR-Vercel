import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period");

    let query = supabase.from("c2_cost_transactions").select("customer_name, cost_category, actual_cost");
    if (period) query = query.eq("period_month", period);

    const { data, error } = await query;
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

    const map: Record<string, { total: number; trucking: number; handling: number; storage: number; other: number }> = {};
    (data || []).forEach((r) => {
      const name = r.customer_name || "Unknown";
      const cat = (r.cost_category || "").toUpperCase();
      const cost = Number(r.actual_cost || 0);

      if (!map[name]) map[name] = { total: 0, trucking: 0, handling: 0, storage: 0, other: 0 };
      map[name].total += cost;
      if (cat.includes("TRUCK")) map[name].trucking += cost;
      else if (cat.includes("HANDL")) map[name].handling += cost;
      else if (cat.includes("STOR")) map[name].storage += cost;
      else map[name].other += cost;
    });

    return NextResponse.json({ success: true, customers: map });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
