"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInr, formatPercent } from "@/lib/format";
import { CATALOGUE_CATEGORIES } from "@/lib/types";
import type { AppSettings, CatalogueItem, EstimateCalculationResult, Room } from "@/lib/types";
import { Loader2, Plus, Trash2, Calculator } from "lucide-react";

interface LineItemDraft {
  catalogueItemId: string;
  name: string;
  unit: string;
  baseCostPerUnit: number;
  quantity: number;
}

interface AdditionalCostDraft {
  id: string;
  label: string;
  amount: number;
}

export function EstimateBuilder({
  projectId,
  room,
  catalogue,
  settings,
}: {
  projectId: string;
  room: Room;
  catalogue: CatalogueItem[];
  settings: AppSettings;
}) {
  const activeCatalogue = useMemo(() => catalogue.filter((c) => c.isActive), [catalogue]);

  const [lineItems, setLineItems] = useState<LineItemDraft[]>(
    room.estimate?.calculation.lineItems.map((li) => ({
      catalogueItemId: li.catalogueItemId,
      name: li.name,
      unit: li.unit,
      baseCostPerUnit: li.baseCostPerUnit,
      quantity: li.quantity,
    })) ?? []
  );
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCostDraft[]>(
    room.estimate?.calculation.additionalCosts ?? []
  );
  const [contingencyPercent, setContingencyPercent] = useState(
    room.estimate?.calculation.contingencyPercent ?? settings.defaultContingencyPercent
  );
  const [targetGrossMarginPercent, setTargetGrossMarginPercent] = useState(
    room.estimate?.calculation.targetGrossMarginPercent ?? settings.targetGrossMarginPercent
  );
  const [gstPercent, setGstPercent] = useState(
    room.estimate?.calculation.gstPercent ?? settings.gstPercent
  );
  const [result, setResult] = useState<EstimateCalculationResult | undefined>(
    room.estimate?.calculation
  );
  const [selectedCatalogueId, setSelectedCatalogueId] = useState<string>("");
  const [isSaving, startSaving] = useTransition();

  function addLineItem() {
    const item = activeCatalogue.find((c) => c.id === selectedCatalogueId);
    if (!item) return;
    if (lineItems.some((li) => li.catalogueItemId === item.id)) {
      toast.info("That item is already on this estimate.");
      return;
    }
    setLineItems((prev) => [
      ...prev,
      {
        catalogueItemId: item.id,
        name: item.name,
        unit: item.unit,
        baseCostPerUnit: item.baseCostPerUnit,
        quantity: item.defaultQuantity ?? 1,
      },
    ]);
    setSelectedCatalogueId("");
  }

  function updateQuantity(catalogueItemId: string, quantity: number) {
    setLineItems((prev) =>
      prev.map((li) => (li.catalogueItemId === catalogueItemId ? { ...li, quantity } : li))
    );
  }

  function removeLineItem(catalogueItemId: string) {
    setLineItems((prev) => prev.filter((li) => li.catalogueItemId !== catalogueItemId));
  }

  function addAdditionalCost() {
    setAdditionalCosts((prev) => [
      ...prev,
      { id: `extra-${Date.now()}`, label: "", amount: 0 },
    ]);
  }

  function updateAdditionalCost(id: string, patch: Partial<AdditionalCostDraft>) {
    setAdditionalCosts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeAdditionalCost(id: string) {
    setAdditionalCosts((prev) => prev.filter((c) => c.id !== id));
  }

  function calculateAndSave() {
    startSaving(async () => {
      const response = await fetch(`/api/projects/${projectId}/rooms/${room.id}/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItems,
          additionalCosts,
          contingencyPercent,
          targetGrossMarginPercent,
          gstPercent,
          conceptId: room.selectedConceptId,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error || "Could not calculate the estimate.");
        return;
      }
      setResult(body.estimate.calculation);
      toast.success("Estimate saved.");
    });
  }

  return (
    <div className="space-y-5">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="display text-[1.4rem]">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select
              value={selectedCatalogueId}
              onValueChange={(value) => setSelectedCatalogueId(value ?? "")}
            >
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Add a catalogue item…" />
              </SelectTrigger>
              <SelectContent>
                {CATALOGUE_CATEGORIES.map((cat) => {
                  const items = activeCatalogue.filter((c) => c.category === cat.value);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat.value}>
                      <p className="px-2 py-1 text-[0.85rem] font-medium text-muted-foreground">{cat.label}</p>
                      {items.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} — {formatInr(item.baseCostPerUnit)}/{item.unit}
                        </SelectItem>
                      ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={addLineItem} disabled={!selectedCatalogueId} className="gap-2">
              <Plus className="size-4" /> Add Item
            </Button>
          </div>

          {lineItems.length === 0 ? (
            <p className="text-[0.95rem] text-muted-foreground">
              No items yet. Add catalogue items to build this room&apos;s estimate.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Base cost / unit</TableHead>
                  <TableHead className="w-28">Quantity</TableHead>
                  <TableHead className="text-right">Line direct cost</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((li) => (
                  <TableRow key={li.catalogueItemId}>
                    <TableCell>{li.name}</TableCell>
                    <TableCell className="text-muted-foreground">{li.unit}</TableCell>
                    <TableCell className="text-muted-foreground">{formatInr(li.baseCostPerUnit)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={li.quantity}
                        onChange={(e) => updateQuantity(li.catalogueItemId, Number(e.target.value))}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatInr(li.quantity * li.baseCostPerUnit)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(li.catalogueItemId)}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="display text-[1.4rem]">Additional Direct Costs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {additionalCosts.map((cost) => (
            <div key={cost.id} className="flex items-center gap-2">
              <Input
                placeholder="Label (e.g. Site transport)"
                value={cost.label}
                onChange={(e) => updateAdditionalCost(cost.id, { label: e.target.value })}
              />
              <Input
                type="number"
                min={0}
                className="w-40"
                placeholder="Amount (₹)"
                value={cost.amount}
                onChange={(e) => updateAdditionalCost(cost.id, { amount: Number(e.target.value) })}
              />
              <Button variant="ghost" size="icon" onClick={() => removeAdditionalCost(cost.id)}>
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addAdditionalCost} className="gap-2">
            <Plus className="size-4" /> Add Cost
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="display text-[1.4rem]">Margin, Contingency & GST</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label>Contingency %</Label>
            <Input
              type="number"
              min={0}
              max={99.99}
              step="0.1"
              value={contingencyPercent}
              onChange={(e) => setContingencyPercent(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label>Target gross margin %</Label>
            <Input
              type="number"
              min={0}
              max={99.99}
              step="0.1"
              value={targetGrossMarginPercent}
              onChange={(e) => setTargetGrossMarginPercent(Number(e.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label>GST %</Label>
            <Input
              type="number"
              min={0}
              step="0.1"
              value={gstPercent}
              onChange={(e) => setGstPercent(Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={calculateAndSave} disabled={isSaving || lineItems.length === 0} className="gap-2">
        {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
        Calculate & Save Estimate
      </Button>

      {result && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="display text-[1.4rem]">Internal Estimate Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-[0.95rem]">
            <Row label="Direct cost" value={formatInr(result.directCost)} />
            <Row
              label={`Contingency (${formatPercent(result.contingencyPercent)})`}
              value={formatInr(result.contingencyAmount)}
            />
            <Row label="Cost basis" value={formatInr(result.costBasis)} emphasis />
            <Row
              label={`Target selling subtotal (pre-GST, margin ${formatPercent(result.targetGrossMarginPercent)})`}
              value={formatInr(result.targetSellingSubtotal)}
            />
            <Row label="Gross profit" value={formatInr(result.grossProfit)} />
            <Row label="Actual gross margin" value={formatPercent(result.actualGrossMarginPercent)} />
            <Row label={`GST (${formatPercent(result.gstPercent)})`} value={formatInr(result.gstAmount)} />
            <Separator className="my-2" />
            <Row label="Total client estimate" value={formatInr(result.totalClientEstimate)} emphasis large />
            <p className="pt-2 text-[0.85rem] text-muted-foreground">
              Gross profit excludes overheads not included in the cost basis, and is distinct from
              net profit. GST treatment shown here must be confirmed by your tax adviser for the
              actual contract and supply structure before issuing a final invoice.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
  large,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  large?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={emphasis ? "font-medium text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={
          large
            ? "text-lg font-semibold text-primary"
            : emphasis
              ? "font-medium text-foreground"
              : "text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
