import Link from "next/link";
import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { formatDate, formatInr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/projects/status-badge";
import { Plus, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requirePageUser();
  const repo = await getRepository();
  const projects = await repo.listProjects();

  const totalProjects = projects.length;
  const inProgress = projects.filter((p) => p.status === "in_progress").length;
  const conceptsAwaitingSelection = projects.reduce(
    (sum, p) => sum + p.rooms.filter((r) => r.concepts.length > 0 && !r.selectedConceptId).length,
    0
  );
  const estimatesPrepared = projects.reduce(
    (sum, p) => sum + p.rooms.filter((r) => r.estimate).length,
    0
  );
  const recentProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const stats = [
    { label: "Total Projects", value: totalProjects },
    { label: "Projects In Progress", value: inProgress },
    { label: "Concepts Awaiting Selection", value: conceptsAwaitingSelection },
    { label: "Estimates Prepared", value: estimatesPrepared },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="editorial-heading text-3xl text-foreground">Studio Dashboard</h1>
        </div>
        <Button render={<Link href="/projects?new=1" />} className="gap-2">
          <Plus className="size-4" /> New Project
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/80">
            <CardContent className="pt-6">
              <p className="text-3xl font-medium text-foreground">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/80">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="editorial-heading text-xl">Recent Projects</CardTitle>
          <Button
            variant="ghost"
            render={<Link href="/projects" />}
            size="sm"
            className="gap-1 text-muted-foreground"
          >
            View all <ArrowRight className="size-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No projects yet. Create your first project to get started.
              </p>
              <Button render={<Link href="/projects?new=1" />} className="mt-4 gap-2">
                <Plus className="size-4" /> New Project
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 transition-colors hover:bg-accent/40 -mx-2 px-2 rounded-md"
                >
                  <div>
                    <p className="font-medium text-foreground">{project.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {project.clientName} · {project.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {project.rooms.length} room{project.rooms.length === 1 ? "" : "s"}
                    </Badge>
                    <StatusBadge status={project.status} />
                    <span className="text-xs text-muted-foreground">
                      Updated {formatDate(project.updatedAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalProjects > 0 && (
        <p className="text-xs text-muted-foreground">
          Combined client budgets across all projects:{" "}
          {formatInr(projects.reduce((sum, p) => sum + (p.budgetRangeMax ?? 0), 0))} (upper range).
        </p>
      )}
    </div>
  );
}
