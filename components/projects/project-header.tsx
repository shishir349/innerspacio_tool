"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatInr } from "@/lib/format";
import { PROJECT_STATUSES } from "@/lib/types";
import type { Project } from "@/lib/types";
import { deleteProjectAction, updateProjectAction } from "@/lib/actions/projects";
import { Trash2, MapPin, Phone, Mail, Presentation } from "lucide-react";
import Link from "next/link";

export function ProjectHeader({ project }: { project: Project }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function updateStatus(status: Project["status"]) {
    startTransition(async () => {
      const result = await updateProjectAction(project.id, { status });
      if (!result.ok) toast.error(result.error);
      else toast.success("Status updated.");
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteProjectAction(project.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Project deleted.");
      router.push("/projects");
    });
  }

  return (
    <Card className="border-border/80">
      <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1.5">
          <h1 className="display display-md text-foreground">{project.title}</h1>
          <p className="text-muted-foreground">{project.clientName}</p>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" /> {project.location}
            </span>
            {project.clientPhone && (
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5" /> {project.clientPhone}
              </span>
            )}
            {project.clientEmail && (
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" /> {project.clientEmail}
              </span>
            )}
          </div>
          {(project.budgetRangeMin || project.budgetRangeMax) && (
            <p className="pt-1 text-sm text-muted-foreground">
              Budget range: {formatInr(project.budgetRangeMin)} – {formatInr(project.budgetRangeMax)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {project.rooms.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/presentation/${project.id}/${project.rooms[0].id}`} target="_blank" />}
              className="gap-2"
            >
              <Presentation className="size-4" /> Present
            </Button>
          )}
          <Select value={project.status} onValueChange={(v) => updateStatus(v as Project["status"])}>
            <SelectTrigger className="w-44" disabled={isPending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" />
              }
            >
              <Trash2 className="size-4" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes &quot;{project.title}&quot; and all of its rooms, photos, concepts
                  and estimates. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-white hover:bg-destructive/90">
                  Delete project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
