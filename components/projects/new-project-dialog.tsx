"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Plus } from "lucide-react";
import { createProjectAction } from "@/lib/actions/projects";

export function NewProjectDialog({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createProjectAction({
        title: String(formData.get("title") || ""),
        clientName: String(formData.get("clientName") || ""),
        clientPhone: String(formData.get("clientPhone") || ""),
        clientEmail: String(formData.get("clientEmail") || ""),
        location: String(formData.get("location") || ""),
        budgetRangeMin: formData.get("budgetRangeMin") ? Number(formData.get("budgetRangeMin")) : undefined,
        budgetRangeMax: formData.get("budgetRangeMax") ? Number(formData.get("budgetRangeMax")) : undefined,
        designPreferences: String(formData.get("designPreferences") || ""),
        notes: String(formData.get("notes") || ""),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Project created.");
      setOpen(false);
      router.push(`/projects/${result.data.id}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) router.replace("/projects");
      }}
    >
      <DialogTrigger render={<Button className="gap-2" />}>
        <Plus className="size-4" /> New Project
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={onSubmit}>
          <DialogHeader>
            <DialogTitle className="display text-[1.6rem]">New Project</DialogTitle>
            <DialogDescription>
              You can save with just a few details and add rooms, photos and preferences later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Project title *</Label>
              <Input id="title" name="title" placeholder="e.g. Sharma Residence — Full Home" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="clientName">Client name *</Label>
                <Input id="clientName" name="clientName" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Location *</Label>
                <Input id="location" name="location" placeholder="e.g. Sector 50, Noida" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="clientPhone">Client phone</Label>
                <Input id="clientPhone" name="clientPhone" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="clientEmail">Client email</Label>
                <Input id="clientEmail" name="clientEmail" type="email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="budgetRangeMin">Budget range — min (₹)</Label>
                <Input id="budgetRangeMin" name="budgetRangeMin" type="number" min={0} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="budgetRangeMax">Budget range — max (₹)</Label>
                <Input id="budgetRangeMax" name="budgetRangeMax" type="number" min={0} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="designPreferences">Design preferences</Label>
              <Textarea id="designPreferences" name="designPreferences" rows={2} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
