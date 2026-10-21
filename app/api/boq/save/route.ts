import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepository } from "@/lib/data";
import { RepositoryError } from "@/lib/data/types";
import { saveRequestSchema } from "@/lib/boq/schema";
import { boqStatus, prepareSave, type StoredPayload } from "@/lib/boq/revisions";

export const runtime = "nodejs";

// Staff-only: save the BOQ workbench under a project (create or update). Total is recomputed here.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in.", code: "unauthorized" }, { status: 401 });
  }
  const parsed = saveRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid BOQ.", code: "invalid" }, { status: 400 });
  }
  const { projectId, boqId, leadId, title, tier, city, sheet, lines, ...rest } = parsed.data;
  const total = Math.round(lines.reduce((n, l) => n + l.qty * l.rate, 0) * 100) / 100;
  try {
    const repo = await getRepository();
    // Revision history + approval are server-owned: an approved BOQ is never silently overwritten.
    const existing = boqId ? await repo.getBoq(projectId, boqId) : null;
    if (boqId && !existing) throw new RepositoryError(`BOQ ${boqId} not found`, "not_found");
    let payload: StoredPayload;
    try {
      payload = prepareSave(existing?.payload as StoredPayload | undefined, { ...rest, lines }, { now: new Date().toISOString(), userId: user.id });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Cannot approve.", code: "not_approvable" }, { status: 409 });
    }
    const saved = await repo.saveBoq(projectId, {
      id: boqId,
      leadId,
      title,
      tier,
      city,
      sheet: sheet ?? "spazay",
      total,
      payload,
    });
    return NextResponse.json({
      id: saved.id,
      total: saved.total,
      updatedAt: saved.updatedAt,
      revision: payload.revision,
      status: boqStatus(payload),
      finalApproved: payload.finalApproved ?? null,
      revisions: payload.revisions ?? [],
    });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "not_found") {
      return NextResponse.json({ error: "Project or BOQ not found.", code: "not_found" }, { status: 404 });
    }
    console.error("[boq/save]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not save the BOQ.", code: "save_failed" }, { status: 500 });
  }
}
