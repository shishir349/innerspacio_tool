"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Map as MapIcon, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BOQ_ROOMS } from "@/lib/boq/lists";
import { shrinkImage } from "@/lib/client-image";
import { roomIssues } from "@/lib/boq/rooms";
import type { BriefItem, PlanRoom } from "@/lib/boq/brief";
import type { PackageTier } from "@/lib/quote/constants";
import type { RateSheet } from "@/lib/rates/sheets";

export interface BriefResult {
  rooms: PlanRoom[];
  items: BriefItem[];
  lines: Record<string, unknown>[];
  warnings: string[];
  assumptions: string[];
  unpriced: { requirement: string; reason: string }[];
  questions: string[];
  coverage?: { requirement: string; room: string; lines: number; codes: string[]; titles: string[] }[];
}

const MAX_PHOTOS = 6;
const POLL_MS = 4000;
const POLL_DEADLINE_MS = 12 * 60 * 1000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const selectCls =
  "h-8 w-full rounded-md border border-input bg-background px-1.5 text-[0.85rem] outline-none focus-visible:ring-2 focus-visible:ring-ring";
const numCls =
  "h-8 w-20 rounded-md border border-input bg-background px-1.5 text-right text-[0.85rem] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
  sheet,
  onResult,
  onBeforeRun,
}: {
  tier: PackageTier;
  city: string;
  sheet: RateSheet;
  onResult: (r: BriefResult) => void;
  /** Return false to stop before the paid analysis starts (e.g. the designer declined to replace the current BOQ). */
  onBeforeRun?: () => boolean;
}) {
  const [plan, setPlan] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [requirements, setRequirements] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const planUrl = useMemo(() => (plan ? URL.createObjectURL(plan) : null), [plan]);
  const photoInput = useRef<HTMLInputElement>(null);

  async function run() {
    if (!plan) return toast.error("Upload the layout plan first.");
    if (requirements.trim().length < 10) return toast.error("Paste the designer's requirements.");
    if (onBeforeRun && !onBeforeRun()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      // Plan keeps more resolution so dimension text stays legible.
      fd.append("plan", await shrinkImage(plan, 2400));
      for (const p of photos) fd.append("photos", await shrinkImage(p, 1400));
      fd.append("requirements", requirements);
      fd.append("tier", tier);
      fd.append("city", city);
      fd.append("sheet", sheet);
      const r = await fetch("/api/boq/from-brief", { method: "POST", body: fd });
      let j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not analyse the plan.");

      // The AI agent can take a few minutes: the server returns a task id and we poll it.
      if (j.async) {
        const started = Date.now();
        let failures = 0;
        for (;;) {
          if (Date.now() - started > POLL_DEADLINE_MS) {
            throw new Error("The analysis is taking too long. Try again, or use a smaller plan image.");
          }
          await wait(POLL_MS);
          setElapsed(Math.round((Date.now() - started) / 1000));
          let p: { status?: string; error?: string } & Record<string, unknown>;
          try {
            const pr = await fetch(
              `/api/boq/from-brief/${encodeURIComponent(j.taskId)}?tier=${tier}&city=${encodeURIComponent(city)}&sheet=${sheet}`
            );
            p = await pr.json();
          } catch {
            if (++failures > 5) throw new Error("Lost connection while waiting for the analysis.");
            continue;
          }
          failures = 0;
          if (p.status === "running") continue;
          if (p.status === "failed") throw new Error(p.error ?? "The analysis failed.");
          if (p.status === "done") {
            j = p;
            break;
          }
          throw new Error((p.error as string) ?? "Unexpected response while waiting for the analysis.");
        }
      }
      onResult(j as BriefResult);
      toast.success(`${j.lines.length} BOQ lines from ${j.rooms.length} rooms on the plan.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not analyse the plan.");
    } finally {
      setBusy(false);
      setElapsed(0);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[0.85rem] font-medium">
            Layout plan / blueprint <span className="text-destructive">*</span>
          </p>
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center text-[0.85rem] text-muted-foreground hover:bg-muted/60">
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
          <p className="text-[0.82rem] text-muted-foreground">
            Room sizes are read from the plan&apos;s written dimensions or scale. Anything it can&apos;t read is marked
            “assumed” — check those.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[0.85rem] font-medium">Photos of the space (optional)</p>
          <div className="flex flex-wrap gap-2">
            {photos.map((f, i) => (
              <Thumb key={`${f.name}-${i}`} file={f} onRemove={() => setPhotos((p) => p.filter((_, j) => j !== i))} />
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => photoInput.current?.click()}
                className="flex size-16 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-[0.82rem] text-muted-foreground hover:bg-muted/60"
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
          <p className="text-[0.82rem] text-muted-foreground">
            Up to {MAX_PHOTOS}. They show what exists today — what must be removed, kept or repaired.
          </p>
        </div>
      </div>

      <label className="block space-y-1 text-[0.85rem]">
        <span className="font-medium">
          Designer requirements <span className="text-destructive">*</span>
        </span>
        <textarea
          rows={10}
          value={requirements}
          onChange={(e) => setRequirements(e.target.value)}
          placeholder={"1. Entrance\n- Main door to be painted.\n\n2. Master Bedroom — complete renovation\n- Dresser area with full-length mirror\n- Remove the existing study unit\n\n3. Painting work…\n4. Electrical modifications…"}
          className="w-full resize-y rounded-md border border-input bg-background p-2 text-[0.95rem] outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      <Button onClick={run} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {busy ? "Reading the plan…" : "Generate BOQ from plan + requirements"}
      </Button>
      {busy && (
        <p role="status" className="text-[0.85rem] text-muted-foreground">
          The AI agent is reading the plan and requirements — this usually takes a few minutes
          {elapsed > 0 ? ` (${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")})` : ""}. Keep this tab open.
        </p>
      )}
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
  // By position, not id: the model can hand out duplicate ids and a patch-by-id would edit every twin.
  const patch = (idx: number, p: Partial<PlanRoom>) => onChange(rooms.map((r, i) => (i === idx ? { ...r, ...p } : r)));
  // A size the designer types is theirs, not the plan's: record it so quantities show "entered".
  const patchSize = (idx: number, p: Partial<PlanRoom>) => patch(idx, { ...p, source: "entered" });
  const issues = roomIssues(rooms);
  const addRoom = () =>
    onChange([...rooms, { id: `m${Date.now()}`, name: "New room", boqRoom: BOQ_ROOMS[0], l: 0, b: 0, h: 10, source: "entered" }]);
  const num = (v: string) => Math.max(0, Number(v) || 0);
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[0.95rem] font-medium">Rooms read from the plan</h3>
          <p className="text-[0.85rem] text-muted-foreground">Feet. Correct a size, then recalculate — quantities follow.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addRoom} disabled={busy}>
            Add room
          </Button>
          <Button size="sm" variant="outline" onClick={onRecalc} disabled={busy}>
            Recalculate quantities
          </Button>
        </div>
      </div>
      {issues.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[0.85rem] text-royal-deep">
          {issues.map((i, n) => (
            <li key={n}>{i.message}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-[0.85rem]">
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
            {rooms.map((r, idx) => (
              <tr key={idx} className="border-t border-border/60">
                <td className="py-1 pr-2">
                  <input className={selectCls} aria-label="Room name" value={r.name} onChange={(e) => patch(idx, { name: e.target.value })} />
                </td>
                <td className="w-48 py-1 pr-2">
                  <select
                    className={selectCls}
                    value={r.boqRoom}
                    aria-label="BOQ room"
                    onChange={(e) => patch(idx, { boqRoom: e.target.value as PlanRoom["boqRoom"] })}
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
                      aria-label={k.toUpperCase()}
                      onChange={(e) => patchSize(idx, { [k]: num(e.target.value) })}
                    />
                  </td>
                ))}
                <td className="py-1">
                  <span
                    className={
                      "rounded px-1.5 py-0.5 " +
                      (r.source === "assumed" ? "bg-royal text-cream" : "bg-muted text-muted-foreground")
                    }
                  >
                    {r.source}
                  </span>
                  <button type="button" className="ml-2 text-[0.8rem] underline" onClick={() => onChange(rooms.filter((_, n) => n !== idx))}>
                    Remove
                  </button>
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
          <h3 className="text-[0.95rem] font-medium">{title}</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.85rem] text-muted-foreground">
            {list.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
