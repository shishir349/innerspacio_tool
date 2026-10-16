import Link from "next/link";
import { getRepository } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROOM_TYPES } from "@/lib/types";
import { Sparkles, Camera, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DesignStudioIndexPage() {
  await requirePageUser();
  const repo = await getRepository();
  const projects = await repo.listProjectSummaries();
  const rooms = projects.flatMap((project) =>
    project.rooms.map((room) => ({ project, room }))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">AI-assisted redesign workflow</p>
          <h1 className="display display-md mt-4 text-foreground">Design Studio</h1>
        </div>
        {rooms.length > 0 && (
          <Button variant="outline" render={<Link href="/projects" />} className="gap-2">
            <Plus className="size-4" /> Add a room
          </Button>
        )}
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-[0.95rem] text-muted-foreground">
            Add a room to a project to start analyzing photos and generating concepts.
          </p>
          <Link href="/projects" className="mt-3 inline-block text-[0.95rem] font-medium text-primary underline">
            Go to Projects
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(({ project, room }) => {
            const roomTypeLabel = ROOM_TYPES.find((t) => t.value === room.type)?.label ?? room.type;
            return (
              <Link key={room.id} href={`/design-studio/${project.id}/${room.id}`}>
                <Card className="h-full border-border/80 transition-shadow hover:shadow-md">
                  <CardContent className="space-y-2 pt-6">
                    <p className="text-[0.85rem] text-muted-foreground">{project.title}</p>
                    <p className="font-medium text-foreground">{room.name}</p>
                    <p className="text-[0.95rem] text-muted-foreground">{roomTypeLabel}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="outline" className="flex items-center gap-1 text-[0.85rem]">
                        <Camera className="size-3" /> {room.photoCount} photo
                        {room.photoCount === 1 ? "" : "s"}
                      </Badge>
                      {room.conceptCount > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1 text-[0.85rem]">
                          <Sparkles className="size-3" /> {room.conceptCount} concept
                          {room.conceptCount === 1 ? "" : "s"}
                        </Badge>
                      )}
                      {room.analyzed && (
                        <Badge className="bg-primary/15 text-primary border-primary/20 text-[0.85rem]">
                          Analyzed
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
