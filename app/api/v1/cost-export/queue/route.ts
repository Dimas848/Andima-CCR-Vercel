import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { periodMonth, branchCode } = await request.json();

    const { data, error } = await supabase
      .from("c2_cost_export_jobs")
      .insert({
        period_month: periodMonth || "September 2026",
        branch_code: branchCode || "Jakarta Pusat",
        job_status: "COMPLETED",
        progress_percentage: 100,
        download_url: "https://storage.supabase.co/c2-reports/CCR_Report.xlsx",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

    return NextResponse.json({ success: true, job_id: data.job_id, download_url: data.download_url });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
