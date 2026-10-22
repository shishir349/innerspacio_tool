import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { getRepository } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/config";
import { loadLeadSpec } from "@/lib/boq/lead";
import { RATE_CARD } from "@/lib/rates/catalog";
import { UNIT_CLASSES } from "@/lib/boq/classes";
import { pricingVersion } from "@/lib/boq/provenance";
import { BoqWorkbench, type WorkbenchInitial } from "@/components/boq/workbench";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DeleteBoqButton } from "@/components/boq/delete-boq-button";
import { formatInr } from "@/lib/format";
import { Plus } from "lucide-react";

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

  // A BOQ always belongs to a project: list every project with the BOQs saved inside it, newest first.
  if (!projectId) {
    const projects = await repo.listProjectSummaries();
    const boqs = await Promise.all(projects.map((p) => repo.listBoqs(p.id)));
    const withBoqs = projects.map((p, i) => ({ project: p, boqs: boqs[i] }));
    const total = boqs.reduce((n, l) => n + l.length, 0);
    return (
      <div className="space-y-8">
        <PageHeader
          title="BOQs"
          description={
            <>
              Every BOQ belongs to a project. {total} BOQ{total === 1 ? "" : "s"} across {projects.length} project
              {projects.length === 1 ? "" : "s"}.
              {lead && leadSpec && !leadSpec.projectId && " This lead has no project yet — open it from Leads first."}
            </>
          }
        />
        {projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-[0.95rem] text-muted-foreground">
            No projects yet.{" "}
            <Link href="/projects" className="font-medium text-primary underline">
              Create a project
            </Link>{" "}
            to start a BOQ.
          </p>
        ) : (
          withBoqs.map(({ project: p, boqs: list }) => (
            <section key={p.id} className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-heading text-[2.4rem] leading-none uppercase">{p.title}</h2>
                  <p className="mt-1 text-[0.85rem] text-muted-foreground">
                    {p.clientName}
                    {p.location ? ` · ${p.location}` : ""}
                  </p>
                </div>
                <Button variant="outline" size="sm" render={<Link href={`/boq?project=${p.id}${lead ? `&lead=${lead}` : ""}`} />} className="gap-1.5">
                  <Plus className="size-4" /> New BOQ
                </Button>
              </div>
              {list.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-[0.9rem] text-muted-foreground">No BOQ in this project yet.</p>
              ) : (
                <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                  {list.map((b) => {
                    const approved = !!(b.payload as { finalApproved?: unknown }).finalApproved;
                    return (
                      <li key={b.id} className="flex items-center border-b border-border/60 last:border-b-0">
                        <Link href={`/boq?project=${p.id}&boq=${b.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-accent/50">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{b.title}</span>
                            <span className="block text-[0.78rem] text-muted-foreground">
                              {b.tier} · {b.city} · updated {new Date(b.updatedAt).toLocaleDateString("en-IN")}
                            </span>
                          </span>
                          <span className={"rounded-full px-2 py-0.5 text-[0.72rem] " + (approved ? "bg-accent text-royal-deep" : "border border-royal text-royal")}>
                            {approved ? "Approved" : "Draft"}
                          </span>
                          <span className="num w-28 text-right font-semibold">{formatInr(b.total)}</span>
                        </Link>
                        <DeleteBoqButton projectId={p.id} boqId={b.id} title={b.title} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))
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
      <PageHeader
        meta={
          <>
            Bill of quantities ·{" "}
            <Link href={`/projects/${project.id}`} className="link-draw text-foreground">
              {project.title}
            </Link>
          </>
        }
        title={<>BOQ <em>builder</em></>}
        description={
          <>
            Generates a room-by-room BOQ from the InnerSpacio rate card, lets you edit every line, saves it under this
            project and exports the reference-format workbook.
            {saved ? ` Reopened “${saved.title}”.` : ""}
            {leadSpec ? ` Prefilled from lead “${leadSpec.client}”.` : ""}
          </>
        }
      />
      <BoqWorkbench
        key={saved?.id ?? "new"}
        initial={initial}
        catalog={catalog}
        currentPricingVersion={pricingVersion()}
        units={Object.entries(UNIT_CLASSES).map(([id, c]) => ({ id, label: c.label }))}
      />
    </div>
  );
}
