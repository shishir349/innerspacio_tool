import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/projects/status-badge";
import { formatDate, formatInr } from "@/lib/format";
import type { Project } from "@/lib/types";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="h-full border-border/80 transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
          <div>
            <p className="editorial-heading text-lg leading-snug text-foreground">
              {project.title}
            </p>
            <p className="text-sm text-muted-foreground">{project.clientName}</p>
          </div>
          <StatusBadge status={project.status} />
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{project.location}</p>
          <p>
            {project.rooms.length} room{project.rooms.length === 1 ? "" : "s"}
            {project.budgetRangeMax
              ? ` · up to ${formatInr(project.budgetRangeMax)}`
              : ""}
          </p>
          <p className="text-xs">Updated {formatDate(project.updatedAt)}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
