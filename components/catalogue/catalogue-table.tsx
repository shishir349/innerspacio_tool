"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CatalogueItemDialog } from "@/components/catalogue/catalogue-item-dialog";
import { deleteCatalogueItemAction, updateCatalogueItemAction } from "@/lib/actions/catalogue";
import { CATALOGUE_CATEGORIES } from "@/lib/types";
import type { CatalogueItem } from "@/lib/types";
import { formatInr } from "@/lib/format";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

export function CatalogueTable({ items }: { items: CatalogueItem[] }) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  const grouped = useMemo(() => {
    return CATALOGUE_CATEGORIES.map((cat) => ({
      ...cat,
      items: filtered.filter((i) => i.category === cat.value),
    })).filter((group) => group.items.length > 0);
  }, [filtered]);

  function toggleActive(item: CatalogueItem) {
    startTransition(async () => {
      const result = await updateCatalogueItemAction(item.id, { isActive: !item.isActive });
      if (!result.ok) toast.error(result.error);
    });
  }

  function onDelete(item: CatalogueItem) {
    startTransition(async () => {
      const result = await deleteCatalogueItemAction(item.id);
      if (!result.ok) toast.error(result.error);
      else toast.success(`Removed "${item.name}".`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search items…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <CatalogueItemDialog
          trigger={
            <Button className="gap-2">
              <Plus className="size-4" /> Add Item
            </Button>
          }
        />
      </div>

      {grouped.length === 0 ? (
        <p className="text-[0.95rem] text-muted-foreground">No catalogue items match your search.</p>
      ) : (
        grouped.map((group) => (
          <div key={group.value} className="space-y-2">
            <h3 className="text-[0.95rem] font-medium text-foreground">{group.label}</h3>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Base cost / unit</TableHead>
                    <TableHead>Default qty.</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((item) => (
                    <TableRow key={item.id} className={!item.isActive ? "opacity-50" : undefined}>
                      <TableCell>
                        <p className="font-medium text-foreground">{item.name}</p>
                        {item.sellingDescription && (
                          <p className="text-[0.85rem] text-muted-foreground">{item.sellingDescription}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.unit}</TableCell>
                      <TableCell>{formatInr(item.baseCostPerUnit)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.defaultQuantity ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={item.isActive}
                          disabled={isPending}
                          onCheckedChange={() => toggleActive(item)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <CatalogueItemDialog
                          item={item}
                          trigger={
                            <Button variant="ghost" size="icon">
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isPending}
                          onClick={() => onDelete(item)}
                        >
                          <Trash2 className="size-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
