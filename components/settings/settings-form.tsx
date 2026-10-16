"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSettingsAction } from "@/lib/actions/settings";
import type { AppSettings } from "@/lib/types";
import { Loader2 } from "lucide-react";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [targetGrossMarginPercent, setTargetGrossMarginPercent] = useState(
    settings.targetGrossMarginPercent
  );
  const [defaultContingencyPercent, setDefaultContingencyPercent] = useState(
    settings.defaultContingencyPercent
  );
  const [gstPercent, setGstPercent] = useState(settings.gstPercent);
  const [isPending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      const result = await updateSettingsAction({
        targetGrossMarginPercent,
        defaultContingencyPercent,
        gstPercent,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Settings saved.");
    });
  }

  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle className="display text-[1.4rem]">Pricing Defaults</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
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
            <Label>Default contingency %</Label>
            <Input
              type="number"
              min={0}
              max={99.99}
              step="0.1"
              value={defaultContingencyPercent}
              onChange={(e) => setDefaultContingencyPercent(Number(e.target.value))}
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
        </div>
        <p className="text-xs text-muted-foreground">
          These are defaults for new estimates — a 40% gross margin is not a 40% markup, and margin
          is always calculated exclusive of GST. GST treatment must be confirmed by your tax
          adviser for the actual contract and supply structure.
        </p>
        <Button onClick={onSave} disabled={isPending} className="gap-2">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}
