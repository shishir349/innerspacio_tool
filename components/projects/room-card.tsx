"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { RoomFormDialog } from "@/components/projects/room-form-dialog";
import { deleteRoomAction } from "@/lib/actions/projects";
import { formatInr } from "@/lib/format";
import { ROOM_TYPES } from "@/lib/types";
import type { Room } from "@/lib/types";
import { Camera, Pencil, Sparkles, Trash2 } from "lucide-react";

export function RoomCard({ projectId, room }: { projectId: string; room: Room }) {
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const roomTypeLabel = ROOM_TYPES.find((t) => t.value === room.type)?.label ?? room.type;

  function onDelete() {
    startTransition(async () => {
      const result = await deleteRoomAction(projectId, room.id);
      if (!result.ok) toast.error(result.error);
    });
  }

  const dims = room.dimensions;
  const dimensionText =
    dims.length && dims.width ? `${dims.length} × ${dims.width} ${dims.unit}` : null;

  return (
    <Card className="border-border/80">
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground">{room.name}</p>
            <p className="text-[0.95rem] text-muted-foreground">{roomTypeLabel}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
            </Button>
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
                  <AlertDialogTitle>Remove &quot;{room.name}&quot;?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the room, its photos, analysis, concepts and estimate.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    disabled={isPending}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-[0.85rem] text-muted-foreground">
          {dimensionText && <Badge variant="outline">{dimensionText}</Badge>}
          {room.budget && <Badge variant="outline">{formatInr(room.budget)}</Badge>}
          <Badge variant="outline" className="flex items-center gap-1">
            <Camera className="size-3" /> {room.photos.length}
          </Badge>
          {room.concepts.length > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Sparkles className="size-3" /> {room.concepts.length} concept
              {room.concepts.length === 1 ? "" : "s"}
            </Badge>
          )}
          {room.estimate && <Badge className="bg-primary/15 text-primary border-primary/20">Estimate ready</Badge>}
        </div>

        {room.preferredStyle && (
          <p className="text-[0.95rem] text-muted-foreground">Style: {room.preferredStyle}</p>
        )}

        <Button
          render={<Link href={`/design-studio/${projectId}/${room.id}`} />}
          size="sm"
          className="mt-1 gap-2"
        >
          <Sparkles className="size-3.5" /> Open in Design Studio
        </Button>
      </CardContent>

      <RoomFormDialog projectId={projectId} room={room} open={editOpen} onOpenChange={setEditOpen} />
    </Card>
  );
}
