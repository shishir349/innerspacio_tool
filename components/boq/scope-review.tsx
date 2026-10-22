"use client";

import { useMemo } from "react";
import { CheckCircle2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BOQ_ROOMS } from "@/lib/boq/lists";
import type { BriefItem } from "@/lib/boq/brief";
import { SCOPE_STATUSES, type ScopeStatus } from "@/lib/boq/build";

export interface UnitOption {
  id: string;
  label: string;
}

const selectCls =
  "h-8 w-full rounded-md border border-input bg-background px-1.5 text-[0.85rem] outline-none focus-visible:ring-2 focus-visible:ring-ring";
const numCls =
  "h-8 w-16 rounded-md border border-input bg-background px-1.5 text-right text-[0.85rem] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STATUS_TONE: Record<ScopeStatus, string> = {
  NEW: "bg-muted text-foreground",
  REPLACE: "bg-muted text-foreground",
  RETAIN: "bg-accent text-royal-deep",
  REFURBISH: "bg-accent text-royal-deep",
  EXCLUDED: "bg-muted text-ink-soft",
  UNCONFIRMED: "bg-royal text-cream",
};
const STATUS_HELP: Record<ScopeStatus, string> = {
  NEW: "priced",
  REPLACE: "priced",
  RETAIN: "kept, not priced",
  REFURBISH: "priced only with a refurbishment rate",
  EXCLUDED: "not priced",
  UNCONFIRMED: "not priced until confirmed",
};

const CONFIRMED = " (confirmed)";
export const isConfirmed = (a?: string) => !!a && a.endsWith(CONFIRMED);

/** Where the item's size comes from, in the designer's terms. */
function sizeSource(it: BriefItem): string {
  if (it.sizeBy === "designer") return "Entered by designer";
  if (it.count || it.width) return /\d\s*(?:ft|feet|sq|rft|x|×)/i.test(it.requirement) ? "Designer-stated" : "AI-extracted";
  if (it.unit) return "Defaulted by code";
  return "No size";
}

/**
 * The designer's checkpoint between "AI read the brief" and "this becomes a BOQ": every scope item by room,
 * its status, its size and where that size came from. Nothing here prices anything — "Update BOQ" re-runs the
 * deterministic quantifier on the edited scope.
 */
export function ScopeReview({
  items,
  onChange,
  units,
  questions,
  approved,
  dirty,
  busy,
  onUpdate,
  onApprove,
  onReopen,
}: {
  items: BriefItem[];
  onChange: (items: BriefItem[]) => void;
  units: UnitOption[];
  questions: string[];
  approved: boolean;
  /** The scope was edited since the BOQ lines were last computed. */
  dirty: boolean;
  busy: boolean;
  onUpdate: () => void;
  onApprove: () => void;
  onReopen: () => void;
}) {
  const patch = (idx: number, p: Partial<BriefItem>) => onChange(items.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  const groups = useMemo(() => {
    const g = new Map<string, number[]>();
    items.forEach((it, i) => g.set(it.room, [...(g.get(it.room) ?? []), i]));    return [...g.entries()];
  }, [items]);
  const unconfirmed = items.filter((i) => (i.status ?? "NEW") === "UNCONFIRMED").length;
  const unrated = items.filter((i) => i.status === "REFURBISH" && !i.rateId).length;
  const open = items.filter((i) => i.assumption && !isConfirmed(i.assumption)).length;
  const num = (v: string) => Math.max(0, Number(v) || 0) || undefined;
  const blocker =
    unconfirmed > 0
      ? `${unconfirmed} UNCONFIRMED item(s) must be resolved`
      : dirty
        ? "Update the BOQ first — the scope changed"
        : open > 0
          ? `${open} assumption(s) still to confirm`
          : null;

  function add() {
    onChange([
      ...items,
      { room: "Others / Whole Home Civil", requirement: "New scope item", kind: "rate", basis: "area", status: "UNCONFIRMED" } as BriefItem,
    ]);
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-[1.8rem] leading-none uppercase">Scope review {approved && <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[0.78rem] text-royal">Approved</span>}</h3>
          <p className="text-[0.85rem] text-muted-foreground">
            What the AI read from the brief. Set what is new, replaced, retained, refurbished or excluded, fix any size, then update the BOQ and approve. Retained and excluded items are never priced.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={add} className="gap-1.5" disabled={busy}>
            <Plus className="size-4" /> Add item
          </Button>
          <Button size="sm" variant="outline" onClick={onUpdate} disabled={busy || !dirty} className="gap-1.5">
            <RotateCcw className="size-4" /> Update BOQ
          </Button>
          {approved ? (
            <Button size="sm" variant="outline" onClick={onReopen} disabled={busy}>
              Reopen scope
            </Button>
          ) : (
            <Button size="sm" onClick={onApprove} disabled={busy || blocker !== null} title={blocker ?? undefined} className="gap-1.5">
              <CheckCircle2 className="size-4" /> Approve scope
            </Button>
          )}
        </div>
      </div>

      {!approved && blocker && <p className="mt-2 text-[0.85rem] text-royal-deep">Cannot approve yet: {blocker}.</p>}
      {unrated > 0 && (
        <p className="mt-1 text-[0.85rem] text-muted-foreground">
          {unrated} REFURBISH item(s) have no refurbishment rate on the card and are not priced — add a manual line below the BOQ.
        </p>
      )}
      {questions.length > 0 && (
        <div className="mt-3 rounded-lg border border-royal/30 bg-accent p-3 text-[0.85rem] text-royal-deep">
          <p className="font-medium">Questions to settle</p>
          <ul className="mt-1 list-disc pl-5">
            {questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-4">
        {groups.map(([room, idxs]) => (
          <div key={room}>
            <h4 className="text-[0.85rem] font-medium text-muted-foreground">{room}</h4>
            <div className="mt-1 overflow-x-auto">
              <table className="w-full min-w-[860px] text-[0.85rem]">
                <tbody>
                  {idxs.map((i) => {
                    const it = items[i];
                    const st = it.status ?? "NEW";
                    return (
                      <tr key={i} className="border-t border-border/60 align-top">
                        <td className="w-[28%] py-1.5 pr-2">
                          <input
                            className={selectCls}
                            aria-label="Scope item"
                            value={it.title ?? it.requirement}
                            onChange={(e) => patch(i, it.title ? { title: e.target.value } : { requirement: e.target.value })}
                          />
                          <select className={selectCls} aria-label="Room" value={it.room} onChange={(e) => patch(i, { room: e.target.value as BriefItem["room"] })}>
                            {BOQ_ROOMS.map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                          <span className="mt-0.5 block text-[0.78rem] text-muted-foreground">{sizeSource(it)}</span>
                        </td>
                        <td className="w-36 py-1.5 pr-2">
                          <select className={selectCls} aria-label="Scope status" value={st} onChange={(e) => patch(i, { status: e.target.value as ScopeStatus })}>
                            {SCOPE_STATUSES.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                          <span className={"mt-0.5 inline-block rounded px-1.5 py-0.5 text-[0.75rem] " + STATUS_TONE[st]}>{STATUS_HELP[st]}</span>
                        </td>
                        <td className="w-44 py-1.5 pr-2">
                          <select className={selectCls} aria-label="Unit class" value={it.unit ?? ""} onChange={(e) => patch(i, { unit: e.target.value || undefined })}>
                            <option value="">{it.rateId ? it.rateId : "Rate item"}</option>
                            {units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.label.slice(0, 34)}
                              </option>
                            ))}
                          </select>
                        </td>
                        {(["width", "height", "count"] as const).map((k) => (
                          <td key={k} className="py-1.5 pr-2">
                            <input
                              className={numCls}
                              inputMode="decimal"
                              aria-label={k}
                              placeholder={k === "width" ? "W ft" : k === "height" ? "H ft" : "Nos"}
                              value={it[k] ?? ""}
                              onChange={(e) => patch(i, { [k]: num(e.target.value), sizeBy: "designer" })}
                            />
                          </td>
                        ))}
                        <td className="min-w-56 py-1.5 pr-2">
                          {it.assumption ? (
                            <div className="flex items-start gap-2 text-[0.8rem]">
                              <span className={isConfirmed(it.assumption) ? "text-muted-foreground" : "text-royal-deep"}>{it.assumption}</span>
                              {!isConfirmed(it.assumption) && (
                                <>
                                  <button type="button" className="underline" onClick={() => patch(i, { assumption: it.assumption + CONFIRMED })}>
                                    Confirm
                                  </button>
                                  <button type="button" className="underline" onClick={() => patch(i, { status: "UNCONFIRMED" })}>
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-1.5">
                          <button type="button" aria-label="Remove scope item" className="rounded p-1 text-destructive hover:bg-muted" onClick={() => onChange(items.filter((_, n) => n !== i))}>
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[0.78rem] text-muted-foreground">Sizes are in feet. Leave a size blank to use the code default (shown as “Defaulted by code”).</p>
    </section>
  );
}
