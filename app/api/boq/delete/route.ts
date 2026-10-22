import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getRepository } from "@/lib/data";

export const runtime = "nodejs";

const bodySchema = z.object({ projectId: z.string().min(1).max(64), boqId: z.string().min(1).max(64) });

// Staff-only: permanently delete one saved BOQ (its revisions go with it). The client asks the designer to confirm first.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in.", code: "unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request.", code: "invalid" }, { status: 400 });
  const { projectId, boqId } = parsed.data;
  try {
    const repo = await getRepository();
    if (!(await repo.getBoq(projectId, boqId))) {
      return NextResponse.json({ error: "BOQ not found.", code: "not_found" }, { status: 404 });
    }
    await repo.deleteBoq(projectId, boqId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[boq/delete]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not delete the BOQ.", code: "delete_failed" }, { status: 500 });
  }
}
