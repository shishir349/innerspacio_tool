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
import { publishEstimateVersionAction } from "@/lib/actions/presentation-links";
import type { EstimateDisplayStatus } from "@/lib/types";
import { Loader2, UploadCloud } from "lucide-react";

export function PublishEstimateDialog({
  projectId,
  roomId,
  roomName,
  hasLiveEstimate,
  trigger,
}: {
  projectId: string;
  roomId: string;
  roomName: string;
  hasLiveEstimate: boolean;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [displayStatus, setDisplayStatus] = useState<EstimateDisplayStatus>("preliminary");
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await publishEstimateVersionAction(projectId, roomId, {
        title: String(formData.get("title") || "Preliminary Estimate"),
        displayStatus,
        inclusions: String(formData.get("inclusions") || "") || undefined,
        exclusions: String(formData.get("exclusions") || "") || undefined,
        assumptions: String(formData.get("assumptions") || "") || undefined,
        validityDays: formData.get("validityDays") ? Number(formData.get("validityDays")) : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Estimate published for ${roomName}.`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button
              variant="outline"
              size="sm"
              disabled={!hasLiveEstimate}
              className="gap-2"
            />
          )
        }
      >
        {!trigger && (
          <>
            <UploadCloud className="size-3.5" /> Publish estimate
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={onSubmit}>
          <DialogHeader>
            <DialogTitle className="display text-[1.6rem]">
              Publish estimate — {roomName}
            </DialogTitle>
            <DialogDescription>
              Snapshots the room&apos;s current saved estimate into a client-safe, versioned
              estimate. Editing the working estimate afterward never changes what&apos;s already
              published — publish again to update it.
            </DialogDescription>
          </DialogHeader>
          {!hasLiveEstimate ? (
            <p className="py-4 text-[0.95rem] text-muted-foreground">
              Save an estimate for this room in the Design Studio first.
            </p>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue="Preliminary Estimate" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="displayStatus">Status</Label>
                <Select value={displayStatus} onValueChange={(v) => setDisplayStatus(v as EstimateDisplayStatus)}>
                  <SelectTrigger id="displayStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preliminary">Preliminary</SelectItem>
                    <SelectItem value="final">Final</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="validityDays">Validity (days)</Label>
                <Input id="validityDays" name="validityDays" type="number" min={1} defaultValue={30} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inclusions">Inclusions</Label>
                <Textarea id="inclusions" name="inclusions" rows={2} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="exclusions">Exclusions</Label>
                <Textarea id="exclusions" name="exclusions" rows={2} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="assumptions">Assumptions</Label>
                <Textarea id="assumptions" name="assumptions" rows={2} />
              </div>
            </div>
          )}
          {hasLiveEstimate && (
            <DialogFooter>
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Publish
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
