import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUSES } from "@/lib/types";
import type { ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<ProjectStatus, string> = {
  new: "bg-secondary text-secondary-foreground border-transparent",
  in_progress: "bg-accent text-accent-foreground border-transparent",
  concept_review: "bg-primary/15 text-primary border-primary/20",
  estimate_ready: "bg-primary/25 text-primary border-primary/30",
  completed: "bg-primary text-primary-foreground border-transparent",
  on_hold: "bg-muted text-muted-foreground border-transparent",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const label = PROJECT_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <Badge variant="outline" className={cn("text-xs font-normal", STYLES[status])}>
      {label}
    </Badge>
  );
}
