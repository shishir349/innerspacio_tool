import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUSES } from "@/lib/types";
import type { ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<ProjectStatus, string> = {
  new: "bg-sand text-foreground border-transparent",
  in_progress: "bg-saffron/35 text-foreground border-transparent",
  concept_review: "bg-terracotta/15 text-rust border-transparent",
  estimate_ready: "bg-olive/15 text-olive border-transparent",
  completed: "bg-olive text-primary-foreground border-transparent",
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
