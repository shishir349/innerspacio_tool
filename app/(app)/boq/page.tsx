import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { getRepository } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/config";
import { loadLeadSpec } from "@/lib/boq/lead";
import { RATE_CARD } from "@/lib/rates/catalog";
import { UNIT_CLASSES } from "@/lib/boq/classes";
import { BoqWorkbench, type WorkbenchInitial } from "@/components/boq/workbench";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULTS = {
  bhk: "3" as const,
  homeSize: "small" as const,
  city: "Delhi",
  tier: "premium" as const,
  rooms: { living_room: 1, dining_room: 1, kitchen: 1, bedroom: 3, bathroom: 3 },
  client: "",
};

export default async function BoqPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; project?: string; boq?: string }>;
}) {
  await requirePageUser();
  const { lead, project: projectParam, boq } = await searchParams;
  const repo = await getRepository();

  let leadSpec = null;
  if (lead && UUID.test(lead) && isSupabaseConfigured()) leadSpec = await loadLeadSpec(lead);
  const projectId = projectParam || leadSpec?.projectId || null;

  // A BOQ always belongs to a project: pick (or create) one first.
  if (!projectId) {
    const projects = await repo.listProjectSummaries();
    return (
      <div className="space-y-6">
        <div>
          <p className="eyebrow">Bill of quantities</p>
          <h1 className="display display-md mt-4 text-foreground">BOQ Builder</h1>
          <p className="mt-1 max-w-2xl text-[0.95rem] text-muted-foreground">
            Every BOQ is saved under a project. Choose the project this BOQ is for.
            {lead && leadSpec && !leadSpec.projectId && " This lead has no project yet — open it from Leads first."}
          </p>
        </div>
        {projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-[0.95rem] text-muted-foreground">
            No projects yet.{" "}
            <Link href="/projects" className="font-medium text-primary underline">
              Create a project
            </Link>{" "}
            to start a BOQ.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/boq?project=${p.id}${lead ? `&lead=${lead}` : ""}`}
                  className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-muted/50"
                >
                  <span className="font-medium">{p.title}</span>
                  <span className="text-[0.85rem] text-muted-foreground">
                    {p.clientName} · {p.location}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const project = await repo.getProject(projectId);
  if (!project) notFound();
  const saved = boq ? await repo.getBoq(projectId, boq) : null;

  const rooms: Record<string, number> = {};
  if (leadSpec) for (const r of leadSpec.input.rooms) rooms[r.roomType] = (rooms[r.roomType] ?? 0) + 1;

  const initial: WorkbenchInitial = {
    ...DEFAULTS,
    ...(leadSpec
      ? {
          bhk: leadSpec.input.bhk,
          homeSize: leadSpec.input.homeSize,
          city: leadSpec.input.city,
          tier: leadSpec.input.tier,
          rooms,
          leadId: lead,
        }
      : {}),
    client: leadSpec?.client || project.clientName,
    projectId: project.id,
    projectTitle: project.title,
    ...(saved ? { saved: { id: saved.id, title: saved.title, sheet: saved.sheet, payload: saved.payload } } : {}),
  };
  if (saved) {
    initial.city = saved.city || initial.city;
    if (["essential", "premium", "luxury"].includes(saved.tier)) initial.tier = saved.tier as WorkbenchInitial["tier"];
  }

  const catalog = RATE_CARD.map((r) => ({
    id: r.id,
    code: r.code,
    trade: r.trade,
    item: r.item,
    uom: r.uom,
    rate: r.rate,
    desc: r.desc,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">
          Bill of quantities ·{" "}
          <Link href={`/projects/${project.id}`} className="link-draw text-foreground">
            {project.title}
          </Link>
        </p>
        <h1 className="display display-md mt-4 text-foreground">BOQ <em>builder</em></h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Generates a room-by-room BOQ from the InnerSpacio rate card, lets you edit every line, saves it under this
          project and exports the reference-format workbook.
          {saved ? ` Reopened “${saved.title}”.` : ""}
          {leadSpec ? ` Prefilled from lead “${leadSpec.client}”.` : ""}
        </p>
      </div>
      <BoqWorkbench
        key={saved?.id ?? "new"}
        initial={initial}
        catalog={catalog}
        units={Object.entries(UNIT_CLASSES).map(([id, c]) => ({ id, label: c.label }))}
      />
    </div>
  );
}
