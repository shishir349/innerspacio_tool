"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveDesignBriefAction } from "@/lib/actions/projects";
import { DESIGN_STYLES, ROOM_TYPE_BRIEF_FIELDS } from "@/lib/types";
import type { Room } from "@/lib/types";
import { ArrowRight, Loader2 } from "lucide-react";

const CUSTOM_STYLE = "__custom__";

export function DesignBriefForm({
  projectId,
  room,
  onSaved,
  onContinue,
}: {
  projectId: string;
  room: Room;
  onSaved?: (room: Room) => void;
  onContinue?: () => void;
}) {
  const brief = room.designBrief;
  const knownStyle = room.preferredStyle && (DESIGN_STYLES as readonly string[]).includes(room.preferredStyle);

  const [styleChoice, setStyleChoice] = useState(knownStyle ? room.preferredStyle! : room.preferredStyle ? CUSTOM_STYLE : DESIGN_STYLES[0]);
  const [customStyle, setCustomStyle] = useState(knownStyle ? "" : room.preferredStyle ?? "");
  const [palette, setPalette] = useState(room.preferredColorPalette ?? "");
  const [mood, setMood] = useState(brief?.mood ?? "");
  const [mustKeepFeatures, setMustKeepFeatures] = useState(brief?.mustKeepFeatures ?? "");
  const [itemsToRemain, setItemsToRemain] = useState(brief?.itemsToRemain ?? "");
  const [itemsToReplace, setItemsToReplace] = useState(brief?.itemsToReplace ?? "");
  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>(room.budget ? String(room.budget) : "");
  const [clientSpecificPreferences, setClientSpecificPreferences] = useState(brief?.clientSpecificPreferences ?? "");
  const [freeTextInstructions, setFreeTextInstructions] = useState(brief?.freeTextInstructions ?? "");
  const [roomTypeDetails, setRoomTypeDetails] = useState<Record<string, string>>(brief?.roomTypeDetails ?? {});
  const [isSaving, startSaving] = useTransition();

  const roomSpecificFields = ROOM_TYPE_BRIEF_FIELDS[room.type] ?? [];

  function save(andContinue: boolean) {
    const resolvedStyle = styleChoice === CUSTOM_STYLE ? customStyle.trim() : styleChoice;
    if (!resolvedStyle) {
      toast.error("Choose or describe a style first.");
      return;
    }
    startSaving(async () => {
      const result = await saveDesignBriefAction(projectId, room.id, {
        style: resolvedStyle,
        palette: palette || undefined,
        mood: mood || undefined,
        mustKeepFeatures: mustKeepFeatures || undefined,
        itemsToRemain: itemsToRemain || undefined,
        itemsToReplace: itemsToReplace || undefined,
        budgetRangeMin: budgetMin ? Number(budgetMin) : undefined,
        budgetRangeMax: budgetMax ? Number(budgetMax) : undefined,
        clientSpecificPreferences: clientSpecificPreferences || undefined,
        freeTextInstructions: freeTextInstructions || undefined,
        roomTypeDetails: Object.keys(roomTypeDetails).length > 0 ? roomTypeDetails : undefined,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Design brief saved.");
      onSaved?.(result.data);
      if (andContinue) onContinue?.();
    });
  }

  return (
    <Card className="border-border/80">
      <CardContent className="space-y-5 pt-6">
        <div>
          <h3 className="display text-[1.4rem] text-foreground">Design Brief</h3>
          <p className="text-sm text-muted-foreground">
            Capture what the client wants before generating concepts — style, palette, must-keeps
            and budget all shape the AI prompt.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Style</Label>
            <Select value={styleChoice} onValueChange={(v) => v && setStyleChoice(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DESIGN_STYLES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_STYLE}>Custom&hellip;</SelectItem>
              </SelectContent>
            </Select>
            {styleChoice === CUSTOM_STYLE && (
              <Input
                placeholder="Describe the style"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
              />
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="palette">Colour palette</Label>
            <Input
              id="palette"
              placeholder="e.g. Warm neutrals with sage green accents"
              value={palette}
              onChange={(e) => setPalette(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="mood">Mood</Label>
          <Input
            id="mood"
            placeholder="e.g. Calm and uncluttered, hotel-like"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="mustKeep">Must-keep features</Label>
            <Textarea
              id="mustKeep"
              rows={2}
              placeholder="e.g. The bay window, the existing wardrobe"
              value={mustKeepFeatures}
              onChange={(e) => setMustKeepFeatures(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="remain">Items to remain as-is</Label>
            <Textarea
              id="remain"
              rows={2}
              value={itemsToRemain}
              onChange={(e) => setItemsToRemain(e.target.value)}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="replace">Items the client wants replaced</Label>
            <Textarea
              id="replace"
              rows={2}
              value={itemsToReplace}
              onChange={(e) => setItemsToReplace(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="budgetMin">Budget range — min (&#8377;)</Label>
            <Input id="budgetMin" type="number" min={0} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="budgetMax">Budget range — max (&#8377;)</Label>
            <Input id="budgetMax" type="number" min={0} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
          </div>
        </div>

        {roomSpecificFields.length > 0 && (
          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Specific to this room type
            </p>
            {roomSpecificFields.map((field) => (
              <div key={field.key} className="grid gap-2">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  placeholder={field.placeholder}
                  value={roomTypeDetails[field.key] ?? ""}
                  onChange={(e) =>
                    setRoomTypeDetails((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-2">
          <Label htmlFor="clientPrefs">Other client preferences</Label>
          <Textarea
            id="clientPrefs"
            rows={2}
            value={clientSpecificPreferences}
            onChange={(e) => setClientSpecificPreferences(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="freeText">Anything else for the AI / design team</Label>
          <Textarea
            id="freeText"
            rows={3}
            value={freeTextInstructions}
            onChange={(e) => setFreeTextInstructions(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => save(false)} disabled={isSaving} className="gap-2">
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            Save brief
          </Button>
          {onContinue && (
            <Button onClick={() => save(true)} disabled={isSaving} className="gap-2">
              Save &amp; continue to concepts <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
