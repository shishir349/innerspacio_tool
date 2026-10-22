import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUSES } from "@/lib/types";
import type { ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<ProjectStatus, string> = {
  new: "bg-mist text-foreground border-transparent",
  in_progress: "bg-royal/35 text-foreground border-transparent",
  concept_review: "bg-royal-deep/15 text-royal-deep border-transparent",
  estimate_ready: "bg-royal/15 text-royal border-transparent",
  completed: "bg-royal text-primary-foreground border-transparent",
  on_hold: "bg-muted text-muted-foreground border-transparent",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const label = PROJECT_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <Badge variant="outline" className={cn(STYLES[status])}>
      {label}
    </Badge>
  );
}
