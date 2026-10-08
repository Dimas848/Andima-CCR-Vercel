import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: "File wajib dilampirkan" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "File diterima untuk divalidasi",
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
