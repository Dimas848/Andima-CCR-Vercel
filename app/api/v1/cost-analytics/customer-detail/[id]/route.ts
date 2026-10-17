import { customerList } from "@/lib/c2/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  url.searchParams.set("company", (await context.params).id);
  return customerList(new Request(url, request));
}
