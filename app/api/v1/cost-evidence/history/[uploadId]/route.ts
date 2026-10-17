import { evidenceDetail, deleteEvidence } from "@/lib/c2/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ uploadId: string }> };
export async function GET(request: Request, context: Context) {
  return evidenceDetail(request, (await context.params).uploadId);
}
export async function DELETE(request: Request, context: Context) {
  return deleteEvidence(request, (await context.params).uploadId);
}
