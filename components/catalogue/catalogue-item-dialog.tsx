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
import { CATALOGUE_CATEGORIES } from "@/lib/types";
import type { CatalogueCategory, CatalogueItem } from "@/lib/types";
import { createCatalogueItemAction, updateCatalogueItemAction } from "@/lib/actions/catalogue";

export function CatalogueItemDialog({
  item,
  trigger,
}: {
  item?: CatalogueItem;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CatalogueCategory>(item?.category ?? "miscellaneous");
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(item);

  function onSubmit(formData: FormData) {
    const payload = {
      name: String(formData.get("name") || ""),
      category,
      unit: String(formData.get("unit") || ""),
      baseCostPerUnit: Number(formData.get("baseCostPerUnit") || 0),
      defaultQuantity: formData.get("defaultQuantity") ? Number(formData.get("defaultQuantity")) : undefined,
      sellingDescription: String(formData.get("sellingDescription") || "") || undefined,
      isActive: item?.isActive ?? true,
    };
    startTransition(async () => {
      const result = isEdit
        ? await updateCatalogueItemAction(item!.id, payload)
        : await createCatalogueItemAction(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Item updated." : "Item added.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <form action={onSubmit}>
          <DialogHeader>
            <DialogTitle className="display text-[1.6rem]">
              {isEdit ? "Edit Catalogue Item" : "Add Catalogue Item"}
            </DialogTitle>
            <DialogDescription>
              Illustrative starting rate, in INR — edit freely before relying on it in an estimate.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Item name *</Label>
              <Input id="name" name="name" defaultValue={item?.name} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as CatalogueCategory)}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATALOGUE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit *</Label>
                <Input id="unit" name="unit" placeholder="sqft, nos, day…" defaultValue={item?.unit} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="baseCostPerUnit">Base cost / unit (₹) *</Label>
                <Input
                  id="baseCostPerUnit"
                  name="baseCostPerUnit"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={item?.baseCostPerUnit}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="defaultQuantity">Default quantity</Label>
                <Input
                  id="defaultQuantity"
                  name="defaultQuantity"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={item?.defaultQuantity}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sellingDescription">Suggested selling description</Label>
              <Textarea id="sellingDescription" name="sellingDescription" rows={2} defaultValue={item?.sellingDescription} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
