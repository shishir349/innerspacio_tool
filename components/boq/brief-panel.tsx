"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Map as MapIcon, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BOQ_ROOMS } from "@/lib/boq/lists";
import { shrinkImage } from "@/lib/client-image";
import type { BriefItem, PlanRoom } from "@/lib/boq/brief";
import type { PackageTier } from "@/lib/quote/constants";

export interface BriefResult {
  rooms: PlanRoom[];
  items: BriefItem[];
  lines: Record<string, unknown>[];
  warnings: string[];
  assumptions: string[];
  unpriced: { requirement: string; reason: string }[];
  questions: string[];
}

const MAX_PHOTOS = 6;
const selectCls =
  "h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";
const numCls =
  "h-8 w-20 rounded-md border border-input bg-background px-1.5 text-right text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Thumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  return (
    <div className="relative size-16 overflow-hidden rounded-md border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={file.name} className="size-full object-cover" />
      <button
        type="button"
        aria-label="Remove photo"
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 rounded-full bg-background/90 p-0.5"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

/** Inputs for the plan-driven BOQ: layout plan (required), requirements (required), photos (optional). */
export function BriefPanel({
  tier,
  city,
  onResult,
}: {
  tier: PackageTier;
  city: string;
  onResult: (r: BriefResult) => void;
}) {
  const [plan, setPlan] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [requirements, setRequirements] = useState("");
  const [busy, setBusy] = useState(false);
  const planUrl = useMemo(() => (plan ? URL.createObjectURL(plan) : null), [plan]);
  const photoInput = useRef<HTMLInputElement>(null);

  async function run() {
    if (!plan) return toast.error("Upload the layout plan first.");
    if (requirements.trim().length < 10) return toast.error("Paste the designer's requirements.");
    setBusy(true);
    try {
      const fd = new FormData();
      // Plan keeps more resolution so dimension text stays legible.
      fd.append("plan", await shrinkImage(plan, 2400));
      for (const p of photos) fd.append("photos", await shrinkImage(p, 1400));
      fd.append("requirements", requirements);
      fd.append("tier", tier);
      fd.append("city", city);
      const r = await fetch("/api/boq/from-brief", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not analyse the plan.");
      onResult(j as BriefResult);
      toast.success(`${j.lines.length} BOQ lines from ${j.rooms.length} rooms on the plan.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not analyse the plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-medium">
            Layout plan / blueprint <span className="text-destructive">*</span>
          </p>
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground hover:bg-muted/60">
            {planUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={planUrl} alt="Layout plan" className="max-h-52 rounded object-contain" />
            ) : (
              <>
                <MapIcon className="size-6" />
                Drop or choose the plan image (JPEG / PNG / WEBP)
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => setPlan(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Room sizes are read from the plan&apos;s written dimensions or scale. Anything it can&apos;t read is marked
            “assumed” — check those.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium">Photos of the space (optional)</p>
          <div className="flex flex-wrap gap-2">
            {photos.map((f, i) => (
              <Thumb key={`${f.name}-${i}`} file={f} onRemove={() => setPhotos((p) => p.filter((_, j) => j !== i))} />
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                className="flex size-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-[10px] text-muted-foreground hover:bg-muted/60"
              >
                <ImagePlus className="size-4" /> Add
              </button>
            )}
            <input
              ref={photoInput}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const add = Array.from(e.target.files ?? []);
                setPhotos((p) => [...p, ...add].slice(0, MAX_PHOTOS));
                e.target.value = "";
              }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Up to {MAX_PHOTOS}. They show what exists today — what must be removed, kept or repaired.
          </p>
        </div>
      </div>

      <label className="block space-y-1 text-xs">
        <span className="font-medium">
          Designer requirements <span className="text-destructive">*</span>
        </span>
        <textarea
          rows={10}
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          placeholder={"1. Entrance\n- Main door to be painted.\n\n2. Master Bedroom — complete renovation\n- Dresser area with full-length mirror\n- Remove the existing study unit\n\n3. Painting work…\n4. Electrical modifications…"}
          className="w-full resize-y rounded-md border border-input bg-background p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <Button onClick={run} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {busy ? "Reading the plan…" : "Generate BOQ from plan + requirements"}
      </Button>
      {busy && <p className="text-xs text-muted-foreground">This can take up to a minute or two.</p>}
    </div>
  );
}

/** Detected rooms — fix any wrong size, then recalculate quantities (no AI call). */
export function PlanRoomsEditor({
  rooms,
  onChange,
  onRecalc,
  busy,
}: {
  rooms: PlanRoom[];
  onChange: (r: PlanRoom[]) => void;
  onRecalc: () => void;
  busy: boolean;
}) {
  const patch = (id: string, p: Partial<PlanRoom>) => onChange(rooms.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const num = (v: string) => Math.max(0, Number(v) || 0);
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Rooms read from the plan</h3>
          <p className="text-xs text-muted-foreground">Feet. Correct a size, then recalculate — quantities follow.</p>
        </div>
        <Button size="sm" variant="outline" onClick={onRecalc} disabled={busy}>
          Recalculate quantities
        </Button>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-2 font-medium">On the plan</th>
              <th className="py-1 pr-2 font-medium">BOQ room</th>
              <th className="py-1 pr-2 font-medium">L</th>
              <th className="py-1 pr-2 font-medium">B</th>
              <th className="py-1 pr-2 font-medium">H</th>
              <th className="py-1 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="py-1 pr-2">{r.name}</td>
                <td className="w-48 py-1 pr-2">
                  <select
                    className={selectCls}
                    value={r.boqRoom}
                    onChange={(e) => patch(r.id, { boqRoom: e.target.value as PlanRoom["boqRoom"] })}
                  >
                    {BOQ_ROOMS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </td>
                {(["l", "b", "h"] as const).map((k) => (
                  <td key={k} className="py-1 pr-2">
                    <input
                      className={numCls}
                      inputMode="decimal"
                      value={r[k]}
                      onChange={(e) => patch(r.id, { [k]: num(e.target.value) })}
                    />
                  </td>
                ))}
                <td className="py-1">
                  <span
                    className={
                      "rounded px-1.5 py-0.5 " +
                      (r.source === "assumed" ? "bg-amber-100 text-amber-900" : "bg-muted text-muted-foreground")
                    }
                  >
                    {r.source}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function BriefNotes({ result }: { result: Pick<BriefResult, "warnings" | "assumptions" | "unpriced" | "questions"> }) {
  const blocks: [string, string[]][] = [
    ["Needs a manual line (not on the rate card)", result.unpriced.map((u) => `${u.requirement}${u.reason ? ` — ${u.reason}` : ""}`)],
    ["Check these", result.warnings],
    ["Assumptions made", result.assumptions],
    ["Questions to settle", result.questions],
  ];
  const shown = blocks.filter(([, l]) => l.length > 0);
  if (shown.length === 0) return null;
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {shown.map(([title, list]) => (
        <div key={title} className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-medium">{title}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {list.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
