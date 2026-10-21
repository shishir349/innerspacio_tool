import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/projects/status-badge";
import { formatDate, formatInr } from "@/lib/format";
import type { ProjectSummary } from "@/lib/types";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="h-full transition-[transform,box-shadow] duration-500 ease-(--ease-out-expo) hover:-translate-y-1 hover:shadow-[0_28px_48px_-28px_rgba(5,24,54,0.35)]">
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div>
            <p className="display text-[2.1rem] leading-[0.95] text-foreground">
              {project.title}
            </p>
            <p className="text-[0.95rem] text-muted-foreground">{project.clientName}</p>
          </div>
          <StatusBadge status={project.status} />
        </CardHeader>
        <CardContent className="space-y-2 text-[0.95rem] text-muted-foreground">
          <p>{project.location}</p>
          <p>
            {project.rooms.length} room{project.rooms.length === 1 ? "" : "s"}
            {project.budgetRangeMax
              ? ` · up to ${formatInr(project.budgetRangeMax)}`
              : ""}
          </p>
          <p className="text-[0.85rem]">Updated {formatDate(project.updatedAt)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
