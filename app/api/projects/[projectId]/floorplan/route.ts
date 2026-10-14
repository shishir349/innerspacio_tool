import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { deleteFloorPlan, getFloorPlanUrl, saveFloorPlan } from "@/lib/floor-plan";
import { PhotoUploadError } from "@/lib/storage";

type Ctx = { params: Promise<{ projectId: string }> };

async function guard(params: Ctx["params"]) {
  const { projectId } = await params;
  if (!(await getCurrentUser())) {
    return { res: NextResponse.json({ error: "Unauthorized. Please sign in.", code: "unauthorized" }, { status: 401 }) };
  }
  // Ownership: the project must be visible to this user (RLS-backed repository).
  const project = await (await getRepository()).getProject(projectId);
  if (!project) {
    return { res: NextResponse.json({ error: "Project not found.", code: "not_found" }, { status: 404 }) };
  }
  return { projectId };
}

export async function GET(_req: Request, { params }: Ctx) {
  const g = await guard(params);
  if ("res" in g) return g.res;
  return NextResponse.json({ url: await getFloorPlanUrl(g.projectId) });
}

export async function POST(request: Request, { params }: Ctx) {
  const g = await guard(params);
  if ("res" in g) return g.res;

  if (Number(request.headers.get("content-length") ?? 0) > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Floor plan is larger than 8 MB.", code: "invalid" }, { status: 413 });
  }

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    // fallthrough
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a floor plan image.", code: "invalid" }, { status: 400 });
  }
  try {
    await saveFloorPlan(g.projectId, file);
  } catch (error) {
    if (error instanceof PhotoUploadError) {
      return NextResponse.json({ error: error.message, code: "invalid" }, { status: 400 });
    }
    throw error;
  }
  return NextResponse.json({ url: await getFloorPlanUrl(g.projectId) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const g = await guard(params);
  if ("res" in g) return g.res;
  await deleteFloorPlan(g.projectId);
  return NextResponse.json({ url: null });
}
