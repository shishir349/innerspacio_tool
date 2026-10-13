"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Room } from "@/lib/types";
import { AlertTriangle, ArrowRight, Loader2, Sparkles } from "lucide-react";

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">None noted.</p>;
  return (
    <ul className="list-disc space-y-1 pl-4 text-sm text-foreground/90">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function AnalysisPanel({
  projectId,
  room,
  anthropicConfigured,
  onContinue,
}: {
  projectId: string;
  room: Room;
  anthropicConfigured: boolean;
  onContinue?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [room_, setRoom] = useState(room);
  const analysis = room_.analysis?.analysis;

  function runAnalysis() {
    startTransition(async () => {
      const response = await fetch(`/api/projects/${projectId}/rooms/${room.id}/analyze`, {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error || "AI analysis failed.");
        return;
      }
      setRoom(body.room);
      toast.success("AI analysis complete — review before relying on it.");
    });
  }

  if (room_.photos.length === 0) {
    return (
      <Card className="border-dashed border-border/80">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Upload at least one room photograph first — go back to the Photos step.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="editorial-heading text-lg text-foreground">AI Room Analysis</h3>
          <p className="text-sm text-muted-foreground">
            Claude reviews the uploaded photo(s) and drafts observations — always verify on site.
          </p>
        </div>
        <Button onClick={runAnalysis} disabled={isPending || !anthropicConfigured} className="gap-2">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {analysis ? "Re-analyze" : "Analyze Room with AI"}
        </Button>
      </div>

      {!anthropicConfigured && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/50 p-3 text-sm text-secondary-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            AI analysis is unavailable because <code className="text-xs">ANTHROPIC_API_KEY</code> is
            not configured on the server. You can continue to the design brief manually.
          </p>
        </div>
      )}

      {analysis && (
        <Card className="border-border/80">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Analysis — {new Date(analysis.generatedAt).toLocaleString("en-IN")}
              {room_.photos.length > 1 && (
                <span className="ml-2 font-normal text-muted-foreground">
                  ({room_.photos.length} photos reviewed)
                </span>
              )}
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              Model: {analysis.model}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start gap-2 rounded-lg border border-accent/60 bg-accent/30 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-foreground" />
              <p className="text-accent-foreground">
                <span className="font-medium">AI suggestions — verify on site.</span> Dimensions,
                quantities and concealed plumbing/electrical/structural conditions are never
                verified facts — confirm everything in person before finalizing scope.
              </p>
            </div>

            <Field label="Observed room type">
              <p className="text-sm text-foreground">{analysis.observedRoomType}</p>
            </Field>

            {/* ─────────────────────── Observed facts ─────────────────────── */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Observed — directly visible in the photos
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Architectural features">
                  <Bullets items={analysis.visibleArchitecturalFeatures} />
                </Field>
                <Field label="Doors, windows & fixed fixtures">
                  <Bullets items={analysis.visibleDoorsWindowsFixtures} />
                </Field>
                <Field label="Existing furniture & storage">
                  <Bullets items={analysis.existingFurnitureAndStorage} />
                </Field>
                <Field label="Colour palette">
                  <Bullets items={analysis.colorPalette} />
                </Field>
                <Field label="Materials & finishes">
                  <Bullets items={analysis.visibleMaterialsAndFinishes} />
                </Field>
                <Field label="Lighting conditions">
                  <p className="text-sm text-foreground">{analysis.lightingConditions}</p>
                </Field>
              </div>
              <Field label="Existing layout">
                <p className="mt-1 text-sm text-foreground">{analysis.existingLayoutDescription}</p>
              </Field>
            </div>

            <Separator />

            {/* ─────────────────────── Inference ─────────────────────── */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Design judgement — built on the above, not a fact
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Approximate visual style">
                  <p className="text-sm text-foreground">{analysis.approximateVisualStyle}</p>
                </Field>
                <Field label="Recommended design direction">
                  <p className="text-sm text-foreground">{analysis.recommendedDesignDirection}</p>
                </Field>
                <Field label="Design opportunities">
                  <Bullets items={analysis.designOpportunities} />
                </Field>
                <Field label="Suggested furniture, storage, finish & lighting changes">
                  <Bullets items={analysis.suggestedChanges} />
                </Field>
              </div>
            </div>

            <Separator />

            {/* ─────────────────────── Uncertainty ─────────────────────── */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-destructive">
                Needs verification — never treat as fact
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Potential constraints (visible in photo)">
                  <Bullets items={analysis.potentialConstraints} />
                </Field>
                <Field label="Cannot be determined — needs a site visit">
                  <Bullets items={analysis.uncertaintiesRequiringSiteVisit} />
                </Field>
              </div>
              <Field label="Questions to ask the client">
                <Bullets items={analysis.questionsForClient} />
              </Field>
            </div>

            <Separator />

            <Field label="Design brief">
              <p className="text-sm text-foreground">{analysis.designBrief}</p>
            </Field>

            <Field label="Draft renovation work items">
              <Bullets items={analysis.draftRenovationWorkItems} />
              <p className="mt-1 text-xs text-muted-foreground">
                Draft only — the designer must confirm scope, quantities and specifications before
                any item is priced in the Estimate tab.
              </p>
            </Field>

            {onContinue && (
              <Button onClick={onContinue} className="gap-2">
                Continue to design brief <ArrowRight className="size-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!analysis && onContinue && (
        <Button variant="outline" onClick={onContinue} className="gap-2">
          Skip AI analysis, write the brief manually <ArrowRight className="size-4" />
        </Button>
      )}
    </div>
  );
}
