import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";
import { exportRequestSchema } from "@/lib/boq/schema";
import { buildBoqWorkbook } from "@/lib/boq/xlsx";

export const runtime = "nodejs";

// Staff-only: turns the (edited) BOQ lines into the reference-layout .xlsx.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in.", code: "unauthorized" }, { status: 401 });
  }
  try {
    await enforceRateLimit(`boq-export:${user.id}`, { limit: 60, windowSeconds: 3600 });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json({ error: "Too many exports. Please wait.", code: "rate_limited" }, { status: 429 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "invalid" }, { status: 400 });
  }
  const parsed = exportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "invalid" },
      { status: 400 }
    );
  }

  const buf = await buildBoqWorkbook(parsed.data);
  const name = (parsed.data.client || "InnerSpacio").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "BOQ";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}_BOQ_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
