import Link from "next/link";
import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROOM_TYPES } from "@/lib/types";
import { Sparkles, Camera, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

export default async function DesignStudioIndexPage() {
  await requirePageUser();
  const repo = await getRepository();
  const projects = await repo.listProjectSummaries();
  const roomCount = projects.reduce((n, p) => n + p.rooms.length, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Design Studio"
        description="AI-assisted redesign: pick a project, open a room, read the space, generate concepts."
        actions={
          <Button variant="outline" render={<Link href="/projects" />} className="gap-2">
            <Plus className="size-4" /> Projects
          </Button>
        }
      />

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-[0.95rem] text-muted-foreground">Create a project, add its rooms and photos, then design them here.</p>
          <Link href="/projects" className="mt-3 inline-block text-[0.95rem] font-medium text-primary underline">
            Go to Projects
          </Link>
        </div>
      ) : (
        projects.map((project) => (
          <section key={project.id} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-heading text-[2.4rem] leading-none uppercase">{project.title}</h2>
                <p className="mt-1 text-[0.85rem] text-muted-foreground">
                  {project.clientName}
                  {project.location ? ` · ${project.location}` : ""} · {project.rooms.length} room{project.rooms.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button variant="outline" size="sm" render={<Link href={`/projects/${project.id}`} />} className="gap-1.5">
                <Plus className="size-4" /> Add room
              </Button>
            </div>
            {project.rooms.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-[0.9rem] text-muted-foreground">
                No rooms yet. Add one from the project to start analysing photos.
              </p>
            ) : (
              <ul className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                {project.rooms.map((room) => {
                  const roomTypeLabel = ROOM_TYPES.find((t) => t.value === room.type)?.label ?? room.type;
                  return (
                    <li key={room.id} className="border-b border-border/60 last:border-b-0">
                      <Link
                        href={`/design-studio/${project.id}/${room.id}`}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-accent/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{room.name}</span>
                          <span className="block text-[0.78rem] text-muted-foreground">{roomTypeLabel}</span>
                        </span>
                        <Badge variant="outline" className="flex items-center gap-1 text-[0.8rem]">
                          <Camera className="size-3" /> {room.photoCount} photo{room.photoCount === 1 ? "" : "s"}
                        </Badge>
                        {room.conceptCount > 0 && (
                          <Badge variant="outline" className="flex items-center gap-1 text-[0.8rem]">
                            <Sparkles className="size-3" /> {room.conceptCount} concept{room.conceptCount === 1 ? "" : "s"}
                          </Badge>
                        )}
                        {room.analyzed && <Badge className="border-primary/20 bg-primary/15 text-[0.8rem] text-primary">Analyzed</Badge>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))
      )}
      {roomCount > 0 && <p className="text-[0.82rem] text-muted-foreground">{roomCount} rooms across {projects.length} projects.</p>}
    </div>
  );
}
