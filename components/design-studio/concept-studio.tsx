"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { selectConceptAction, deleteConceptAction } from "@/lib/actions/projects";
import { getPresentationLinkStatusAction, toggleConceptVisibilityAction } from "@/lib/actions/presentation-links";
import { DESIGN_STYLES } from "@/lib/types";
import { MAX_VARIANTS_PER_REQUEST } from "@/lib/image-gen/types";
import type { Room } from "@/lib/types";
import { CheckCircle2, Eye, EyeOff, FileImage, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const CUSTOM_STYLE = "__custom__";

export function ConceptStudio({
  projectId,
  room,
  providerName,
  providerIsDemo,
}: {
  projectId: string;
  room: Room;
  providerName: string;
  providerIsDemo: boolean;
}) {
  const [room_, setRoom] = useState(room);
  const knownStyle = room.preferredStyle && (DESIGN_STYLES as readonly string[]).includes(room.preferredStyle);
  const [styleChoice, setStyleChoice] = useState(knownStyle ? room.preferredStyle! : DESIGN_STYLES[0]);
  const [customStyle, setCustomStyle] = useState(knownStyle ? "" : room.preferredStyle ?? "");
  const [palette, setPalette] = useState(room.preferredColorPalette ?? "");
  const [brief, setBrief] = useState("");
  const [variantCount, setVariantCount] = useState(2);
  const [isGenerating, startGenerating] = useTransition();
  const [isSelecting, startSelecting] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();
  const [hiddenConceptIds, setHiddenConceptIds] = useState<Set<string>>(new Set());
  const [hasActiveLink, setHasActiveLink] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isToggling, startToggling] = useTransition();

  const hasPhoto = room_.photos.length > 0;

  // Project-level floor plan / blueprint, sent to the model as a layout reference.
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const [useFloorPlan, setUseFloorPlan] = useState(true);
  const [planBusy, setPlanBusy] = useState(false);
  const extraPhotoCount = Math.min(Math.max(room_.photos.length - 1, 0), 2);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/floorplan`)
      .then((r) => (r.ok ? r.json() : { url: null }))
      .then((j) => setFloorPlanUrl(j.url ?? null))
      .catch(() => setFloorPlanUrl(null));
  }, [projectId]);

  async function uploadPlan(file: File | undefined) {
    if (!file) return;
    setPlanBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`/api/projects/${projectId}/floorplan`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Upload failed.");
      setFloorPlanUrl(j.url);
      toast.success("Floor plan saved for this project.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setPlanBusy(false);
    }
  }

  async function removePlan() {
    setPlanBusy(true);
    await fetch(`/api/projects/${projectId}/floorplan`, { method: "DELETE" }).catch(() => null);
    setFloorPlanUrl(null);
    setPlanBusy(false);
  }

  useEffect(() => {
    getPresentationLinkStatusAction(projectId).then((result) => {
      if (result.ok && result.data) {
        setHasActiveLink(true);
        setHiddenConceptIds(new Set(result.data.hiddenConceptIds ?? []));
      }
    });
  }, [projectId]);

  function generate() {
    const resolvedStyle = styleChoice === CUSTOM_STYLE ? customStyle.trim() : styleChoice;
    if (!resolvedStyle) {
      toast.error("Choose or describe a style first.");
      return;
    }
    if (!brief.trim()) {
      toast.error("Describe a short styling brief first.");
      return;
    }
    startGenerating(async () => {
      const response = await fetch(`/api/projects/${projectId}/rooms/${room.id}/concepts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: resolvedStyle,
          brief,
          palette: palette || undefined,
          variantCount,
          useFloorPlan: useFloorPlan && !!floorPlanUrl,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        toast.error(body.error || "Concept generation failed.");
        return;
      }
      setRoom(body.room);
      if (body.partialErrors?.length) {
        toast.warning(`${body.savedCount} of ${body.generatedCount} variants saved — some failed to persist.`);
      } else {
        toast.success(
          body.isDemo
            ? `${body.savedCount} demo concept(s) generated.`
            : `${body.savedCount} concept(s) generated.`
        );
      }
      // Newly generated concepts default to hidden from the client — reflect that locally.
      if (hasActiveLink) {
        getPresentationLinkStatusAction(projectId).then((result) => {
          if (result.ok && result.data) setHiddenConceptIds(new Set(result.data.hiddenConceptIds ?? []));
        });
      }
    });
  }

  function select(conceptId: string) {
    startSelecting(async () => {
      const result = await selectConceptAction(projectId, room.id, conceptId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRoom(result.data);
      toast.success("Concept selected.");
    });
  }

  function remove(conceptId: string) {
    setDeletingId(conceptId);
    startDeleting(async () => {
      const result = await deleteConceptAction(projectId, room.id, conceptId);
      setDeletingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setRoom(result.data);
      toast.success("Concept deleted.");
    });
  }

  function toggleVisible(conceptId: string, currentlyVisible: boolean) {
    setTogglingId(conceptId);
    startToggling(async () => {
      const result = await toggleConceptVisibilityAction(projectId, conceptId, !currentlyVisible);
      setTogglingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        setHiddenConceptIds(new Set(result.data.hiddenConceptIds ?? []));
        toast.success(currentlyVisible ? "Hidden from client." : "Visible to client.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <Card className="border-border/80">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <h3 className="display text-[1.8rem] text-foreground">Generate Concepts</h3>
            <Badge variant="outline" className="text-[0.85rem]">
              Provider: {providerName}
              {providerIsDemo ? " (demo)" : ""}
            </Badge>
          </div>
          {providerIsDemo && (
            <p className="text-[0.85rem] text-muted-foreground">
              No image-generation provider is configured — concepts below are clearly labeled
              illustrative placeholders, not renderings of the client&rsquo;s room. Configure
              <code className="mx-1 text-[0.85rem]">IMAGE_GENERATION_PROVIDER</code> and its API key to
              generate real visuals from the uploaded photo.
            </p>
          )}
          {!hasPhoto && (
            <p className="text-[0.95rem] text-muted-foreground">
              Upload a room photo first — it&rsquo;s used as the reference for concept generation.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_140px]">
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
                <Input placeholder="Describe the style" value={customStyle} onChange={(e) => setCustomStyle(e.target.value)} />
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="palette">Palette (optional)</Label>
              <Input id="palette" value={palette} onChange={(e) => setPalette(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="variantCount">Variants</Label>
              <Select value={String(variantCount)} onValueChange={(v) => v && setVariantCount(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: MAX_VARIANTS_PER_REQUEST }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-[0.95rem]">
            <p className="font-medium">What the AI will use</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[0.85rem] text-muted-foreground">
              <li>
                {room_.photos.length === 0
                  ? "No room photos yet"
                  : `${1 + extraPhotoCount} room photo${extraPhotoCount ? "s" : ""} (main + ${extraPhotoCount} other angle${extraPhotoCount === 1 ? "" : "s"})`}
              </li>
              <li>Client notes, preferences and room size saved on the project and room</li>
              <li>The design brief and the styling brief below</li>
              <li>{floorPlanUrl && useFloorPlan ? "The project floor plan" : "No floor plan attached"}</li>
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-[0.85rem] hover:bg-accent">
                {planBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                {floorPlanUrl ? "Replace floor plan" : "Upload floor plan / blueprint"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={planBusy}
                  onChange={(e) => {
                    void uploadPlan(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {floorPlanUrl && (
                <>
                  <a
                    href={floorPlanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[0.85rem] text-primary hover:underline"
                  >
                    <FileImage className="size-3.5" /> View plan
                  </a>
                  <label className="inline-flex items-center gap-1.5 text-[0.85rem]">
                    <input
                      type="checkbox"
                      checked={useFloorPlan}
                      onChange={(e) => setUseFloorPlan(e.target.checked)}
                    />
                    Use for this generation
                  </label>
                  <button type="button" onClick={removePlan} className="text-[0.85rem] text-muted-foreground hover:text-destructive">
                    Remove
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="brief">Styling brief</Label>
            <Textarea
              id="brief"
              rows={2}
              placeholder="e.g. Pastel blues, playful but tidy, lots of concealed storage"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>
          <Button onClick={generate} disabled={isGenerating || !hasPhoto} className="gap-2">
            {isGenerating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {isGenerating ? "Generating…" : "Generate Concepts"}
          </Button>
        </CardContent>
      </Card>

      {room_.concepts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {room_.concepts.map((concept) => {
            const isVisible = !hiddenConceptIds.has(concept.id);
            return (
              <Card
                key={concept.id}
                className={cn(
                  "overflow-hidden border-border/80",
                  concept.isSelected && "ring-2 ring-primary"
                )}
              >
                <div className="relative aspect-[4/3] bg-muted">
                  <Image
                    src={concept.imageUrl}
                    alt={concept.title}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  <Badge
                    className={cn(
                      "absolute left-2 top-2 text-[0.82rem]",
                      concept.status === "demo"
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground"
                    )}
                  >
                    {concept.status === "demo" ? "Demo concept" : "AI-generated — illustrative"}
                  </Badge>
                  {hasActiveLink && (
                    <Badge
                      className={cn(
                        "absolute right-2 top-2 text-[0.82rem]",
                        isVisible ? "bg-emerald-600 text-white" : "bg-background/90 text-foreground"
                      )}
                    >
                      {isVisible ? "Visible to client" : "Hidden from client"}
                    </Badge>
                  )}
                </div>
                <CardContent className="space-y-2 pt-4">
                  <p className="font-medium text-foreground">{concept.title}</p>
                  <p className="text-[0.85rem] text-muted-foreground">{concept.style}</p>
                  <p className="text-[0.95rem] text-muted-foreground line-clamp-3">{concept.description}</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-[0.85rem] text-foreground/80">
                    {concept.keyChanges.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant={concept.isSelected ? "secondary" : "outline"}
                      disabled={isSelecting}
                      onClick={() => select(concept.id)}
                      className="flex-1 gap-2"
                    >
                      {concept.isSelected ? (
                        <>
                          <CheckCircle2 className="size-3.5" /> Selected
                        </>
                      ) : (
                        "Select"
                      )}
                    </Button>
                    {hasActiveLink && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isToggling && togglingId === concept.id}
                        onClick={() => toggleVisible(concept.id, isVisible)}
                        title={isVisible ? "Hide from client" : "Show to client"}
                      >
                        {isVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isDeleting && deletingId === concept.id}
                      onClick={() => remove(concept.id)}
                      title="Delete concept"
                    >
                      {isDeleting && deletingId === concept.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
