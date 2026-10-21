import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { StatusBadge } from "@/components/projects/status-badge";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

/**
 * One job: get back into the work. The latest project is the hero; everything else is a quiet list.
 * Zero-value stats are not shown; they only add noise.
 */
export default async function DashboardPage() {
  await requirePageUser();
  const repo = await getRepository();
  const projects = await repo.listProjectSummaries();

  const sorted = [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const [latest, ...others] = sorted;
  const inProgress = projects.filter((p) => p.status === "in_progress").length;
  const awaiting = projects.reduce(
    (sum, p) => sum + p.rooms.filter((r) => r.conceptCount > 0 && !r.hasSelectedConcept).length,
    0
  );
  const summary = [
    `${projects.length} project${projects.length === 1 ? "" : "s"}`,
    inProgress > 0 && `${inProgress} in progress`,
    awaiting > 0 && `${awaiting} concept${awaiting === 1 ? "" : "s"} awaiting a pick`,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl space-y-14">
      <PageHeader
        large
        title={<>Welcome <em>back.</em></>}
        description={projects.length > 0 ? summary.join(" · ") : undefined}
        actions={
          <Button render={<Link href="/projects?new=1" />} size="lg" className="gap-2">
            <Plus className="size-4" /> New project
          </Button>
        }
      />

      {!latest ? (
        <p className="rounded-3xl border border-dashed border-border p-14 text-center text-[1.05rem] text-muted-foreground">
          No projects yet. Create your first project to get started.
        </p>
      ) : (
        <Reveal immediate className="space-y-14">
          <section aria-labelledby="continue">
            <h2 id="continue" className="display text-[2.4rem]">
              Continue where you left off
            </h2>
            <div className="mt-5 rounded-3xl border border-border bg-card p-7 sm:p-9">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="display text-[clamp(2.4rem,4.4vw,3.4rem)] leading-[0.95]">{latest.title}</p>
                  <p className="mt-2 text-[1.05rem] text-muted-foreground">
                    {latest.clientName} · {latest.location}
                  </p>
                </div>
                <StatusBadge status={latest.status} />
              </div>
              <p className="mt-6 text-muted-foreground">
                {latest.rooms.length} room{latest.rooms.length === 1 ? "" : "s"} · updated {formatDate(latest.updatedAt)}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button render={<Link href={`/projects/${latest.id}`} />} className="gap-2">
                  Open project <ArrowRight className="size-4" />
                </Button>
                <Button render={<Link href={`/boq?project=${latest.id}`} />} variant="outline">
                  BOQ
                </Button>
                <Button render={<Link href="/design-studio" />} variant="outline">
                  Design Studio
                </Button>
              </div>
            </div>
          </section>

          {others.length > 0 && (
            <section aria-labelledby="others">
              <div className="flex items-baseline justify-between">
                <h2 id="others" className="display text-[2.4rem]">
                  Other projects
                </h2>
                <Link href="/projects" className="link-draw text-[0.95rem] text-muted-foreground hover:text-foreground">
                  View all
                </Link>
              </div>
              <ul className="mt-3 divide-y divide-border border-y border-border">
                {others.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="group flex items-center justify-between gap-4 py-5">
                      <span>
                        <span className="block text-[1.1rem]">{p.title}</span>
                        <span className="block text-muted-foreground">{p.clientName}</span>
                      </span>
                      <span className="flex items-center gap-4">
                        <StatusBadge status={p.status} />
                        <ArrowRight className="size-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </Reveal>
      )}
    </div>
  );
}
