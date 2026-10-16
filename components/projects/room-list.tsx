"use client";

import { RoomCard } from "@/components/projects/room-card";
import { RoomFormDialog } from "@/components/projects/room-form-dialog";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/types";
import { Plus } from "lucide-react";

export function RoomList({ project }: { project: Project }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="display text-[1.6rem] text-foreground">Rooms</h2>
        <RoomFormDialog
          projectId={project.id}
          trigger={
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="size-4" /> Add Room
            </Button>
          }
        />
      </div>

      {project.rooms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center">
          <p className="text-[0.95rem] text-muted-foreground">
            No rooms yet. Add the first room for this project.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {project.rooms.map((room) => (
            <RoomCard key={room.id} projectId={project.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}
