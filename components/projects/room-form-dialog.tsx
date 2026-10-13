"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROOM_TYPES } from "@/lib/types";
import type { Room } from "@/lib/types";
import { addRoomAction, updateRoomAction } from "@/lib/actions/projects";
import { RoomPhotosManager } from "@/components/projects/room-photos-manager";

export function RoomFormDialog({
  projectId,
  room,
  trigger,
  open,
  onOpenChange,
}: {
  projectId: string;
  room?: Room;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? onOpenChange! : setInternalOpen;

  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<Room["type"]>(room?.type ?? "other");
  const [unit, setUnit] = useState<"ft" | "m">(room?.dimensions.unit ?? "ft");
  const isEdit = Boolean(room);

  function onSubmit(formData: FormData) {
    const payload = {
      name: String(formData.get("name") || ""),
      type,
      length: formData.get("length") ? Number(formData.get("length")) : undefined,
      width: formData.get("width") ? Number(formData.get("width")) : undefined,
      ceilingHeight: formData.get("ceilingHeight") ? Number(formData.get("ceilingHeight")) : undefined,
      unit,
      existingConditionNotes: String(formData.get("existingConditionNotes") || ""),
      preferredStyle: String(formData.get("preferredStyle") || ""),
      preferredColorPalette: String(formData.get("preferredColorPalette") || ""),
      storageRequirements: String(formData.get("storageRequirements") || ""),
      materialPreferences: String(formData.get("materialPreferences") || ""),
      budget: formData.get("budget") ? Number(formData.get("budget")) : undefined,
      constraints: String(formData.get("constraints") || ""),
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateRoomAction(projectId, room!.id, payload)
        : await addRoomAction(projectId, payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Room updated." : "Room added.");
      if (!isEdit) setDialogOpen(false);
    });
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger && <DialogTrigger render={trigger as React.ReactElement} />}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="editorial-heading text-xl">
            {isEdit ? `Edit ${room!.name}` : "Add a Room"}
          </DialogTitle>
          <DialogDescription>
            Not every field is required to save — fill in what you know and refine later.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="photos" disabled={!isEdit}>
              Photos {isEdit ? `(${room!.photos.length})` : ""}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details">
            <form action={onSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Room name *</Label>
                  <Input id="name" name="name" defaultValue={room?.name} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Room type *</Label>
                  <Select value={type} onValueChange={(v) => setType(v as Room["type"])}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROOM_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="length">Length</Label>
                  <Input id="length" name="length" type="number" min={0} step="0.1" defaultValue={room?.dimensions.length} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="width">Width</Label>
                  <Input id="width" name="width" type="number" min={0} step="0.1" defaultValue={room?.dimensions.width} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ceilingHeight">Ceiling ht.</Label>
                  <Input id="ceilingHeight" name="ceilingHeight" type="number" min={0} step="0.1" defaultValue={room?.dimensions.ceilingHeight} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select value={unit} onValueChange={(v) => setUnit(v as "ft" | "m")}>
                    <SelectTrigger id="unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ft">feet</SelectItem>
                      <SelectItem value="m">metres</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="preferredStyle">Preferred style</Label>
                  <Input id="preferredStyle" name="preferredStyle" defaultValue={room?.preferredStyle} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="preferredColorPalette">Preferred colour palette</Label>
                  <Input id="preferredColorPalette" name="preferredColorPalette" defaultValue={room?.preferredColorPalette} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="storageRequirements">Storage requirements</Label>
                  <Input id="storageRequirements" name="storageRequirements" defaultValue={room?.storageRequirements} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="materialPreferences">Material preferences</Label>
                  <Input id="materialPreferences" name="materialPreferences" defaultValue={room?.materialPreferences} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="budget">Budget for this room (₹)</Label>
                  <Input id="budget" name="budget" type="number" min={0} defaultValue={room?.budget} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="constraints">Constraints</Label>
                  <Input id="constraints" name="constraints" placeholder="Plumbing, electrical, structural…" defaultValue={room?.constraints} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="existingConditionNotes">Existing-condition notes</Label>
                <Textarea id="existingConditionNotes" name="existingConditionNotes" rows={2} defaultValue={room?.existingConditionNotes} />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Room"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
          <TabsContent value="photos" className="pt-2">
            {isEdit && (
              <RoomPhotosManager projectId={projectId} roomId={room!.id} photos={room!.photos} />
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
