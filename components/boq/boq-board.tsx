"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BOQ_ROOMS, BOQ_TRADES, BOQ_UOMS } from "@/lib/boq/lists";
import { formatInr } from "@/lib/format";
import type { LineState, lineAssessment } from "@/lib/boq/decisions";
type LineAssessment = ReturnType<typeof lineAssessment>;
import type { CatalogRate, Row } from "@/components/boq/workbench";

const STATE_LABEL: Record<LineState, string> = { confirmed: "Confirmed", assumed: "Assumed", awaiting: "Review" };
// Only royal / navy / cream tints: the state reads from fill weight, not hue.
const STATE_PILL: Record<LineState, string> = {
  confirmed: "bg-accent text-royal-deep",
  assumed: "border border-royal text-royal",
  awaiting: "bg-navy text-cream",
};

const fieldCls =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-[0.85rem] outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-royal/60";
const areaCls = fieldCls.replace("h-9", "min-h-16 py-1.5");

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={"block space-y-1 " + (className ?? "")}>
      <span className="text-[0.78rem] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export interface BoardProps {
  rows: Row[];
  catalog: CatalogRate[];
  assessments: Map<number, LineAssessment>;
  patch: (key: number, p: Partial<Row>) => void;
  patchMeasure: (key: number, p: Partial<Row>) => void;
  pickRate: (key: number, id: string) => void;
  remove: (key: number) => void;
  pick: string;
  setPick: (id: string) => void;
  addFromCatalog: () => void;
  addBlank: () => void;
}

/** Rooms that belong together sit together: all bedrooms, then all bathrooms, and so on. */
const FAMILIES: [string, RegExp][] = [
  ["Entry & passages", /Entrance|Foyer|Passage|Lobby/],
  ["Living & dining", /Living|Dining|TV Lounge/],
  ["Kitchen & utility", /Kitchen|Utility/],
  ["Bedrooms", /Bedroom|Kids Room/],
  ["Bathrooms", /Bathroom/],
  ["Study & office", /Study|Office/],
  ["Balconies", /Balcony/],
];
const familyOf = (room: string) => {
  const i = FAMILIES.findIndex(([, re]) => re.test(room));
  return i < 0 ? FAMILIES.length : i;
};
const familyName = (i: number) => FAMILIES[i]?.[0] ?? "Other";

const numOrNull = (v: string) => (v === "" ? null : Math.max(0, Number(v) || 0));

/**
 * The built BOQ, one room at a time: each room is a collapsed card with its subtotal; a line is one quiet
 * row (what · how much · amount) that opens into a small editor. Nothing is hidden, it is just not all open at once.
 */
export function BoqBoard(p: BoardProps) {
  const { rows, assessments } = p;
  const [openRooms, setOpenRooms] = useState<Set<string>>(new Set());
  const [openLine, setOpenLine] = useState<number | null>(null);
  const [onlyReview, setOnlyReview] = useState(false);
  const [query, setQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");
  const filtering = onlyReview || query.trim() !== "" || roomFilter !== "" || tradeFilter !== "";
  const q = query.trim().toLowerCase();
  const matches = (r: Row) =>
    (!roomFilter || r.room === roomFilter) &&
    (!tradeFilter || r.trade === tradeFilter) &&
    (!q || `${r.title ?? ""} ${r.item} ${r.description} ${r.trade} ${r.room}`.toLowerCase().includes(q)) &&
    (!onlyReview || (assessments.get(r.key)?.state ?? "confirmed") !== "confirmed");

  const roomNames = useMemo(() => [...new Set(rows.map((r) => r.room))], [rows]);
  const tradeNames = useMemo(() => [...new Set(rows.map((r) => r.trade))], [rows]);
  const total = useMemo(() => rows.reduce((n, r) => n + r.qty * r.rate, 0), [rows]);
  const reviewCount = rows.filter((r) => (assessments.get(r.key)?.state ?? "confirmed") !== "confirmed").length;

  const rooms = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) m.set(r.room, [...(m.get(r.room) ?? []), r]);
    const order = (n: string) => {
      const i = (BOQ_ROOMS as readonly string[]).indexOf(n);
      return i < 0 ? 999 : i;
    };
    return [...m.entries()].sort((a, b) => familyOf(a[0]) - familyOf(b[0]) || order(a[0]) - order(b[0]));
  }, [rows]);

  const toggleRoom = (room: string) =>
    setOpenRooms((s) => {
      const n = new Set(s);
      if (n.has(room)) n.delete(room);
      else n.add(room);
      return n;
    });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            aria-label="Search lines"
            placeholder="Search lines, trades, rooms…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={fieldCls + " pl-9"}
          />
        </label>
        <select aria-label="Filter by room" className={fieldCls + " w-auto max-w-44"} value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
          <option value="">All rooms</option>
          {roomNames.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select aria-label="Filter by trade" className={fieldCls + " w-auto max-w-44"} value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)}>
          <option value="">All trades</option>
          {tradeNames.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={onlyReview}
          onClick={() => setOnlyReview((v) => !v)}
          className={"h-9 rounded-lg border px-3 text-[0.82rem] transition-colors " + (onlyReview ? "border-royal bg-royal text-cream" : "border-input text-royal hover:bg-accent")}
        >
          Needs review · {reviewCount}
        </button>
        <button
          type="button"
          className="h-9 px-2 text-[0.82rem] text-royal underline-offset-4 hover:underline"
          onClick={() => setOpenRooms((s) => (s.size === rooms.length ? new Set() : new Set(rooms.map(([r]) => r))))}
        >
          {openRooms.size === rooms.length ? "Collapse all" : "Expand all"}
        </button>
      </div>
      {filtering && rooms.every(([, l]) => !l.some(matches)) && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-[0.9rem] text-muted-foreground">
          No lines match these filters.{" "}
          <button type="button" className="text-royal underline" onClick={() => { setQuery(""); setRoomFilter(""); setTradeFilter(""); setOnlyReview(false); }}>
            Clear filters
          </button>
        </p>
      )}

      {rooms.map(([room, list], ri) => {
        const fam = familyOf(room);
        const firstOfFamily = ri === 0 || familyOf(rooms[ri - 1][0]) !== fam;
        const famRooms = rooms.filter(([r]) => familyOf(r) === fam);
        const famTotal = famRooms.reduce((n, [, l]) => n + l.reduce((m, r) => m + r.qty * r.rate, 0), 0);
        const sub = list.reduce((n, r) => n + r.qty * r.rate, 0);
        const shown = list.filter(matches);
        if (filtering && shown.length === 0) return null;
        const open = openRooms.has(room) || (filtering && shown.length > 0);
        const flagged = list.filter((r) => (assessments.get(r.key)?.state ?? "confirmed") !== "confirmed").length;
        return (
          <Fragment key={room}>
          {firstOfFamily && (
            <div className="flex items-baseline justify-between gap-3 pt-6 first:pt-0">
              <h3 className="font-heading text-[2.4rem] leading-none uppercase text-royal">{familyName(fam)}</h3>
              <span className="num text-[0.85rem] text-muted-foreground">
                {famRooms.length} room{famRooms.length === 1 ? "" : "s"} · {formatInr(famTotal)}
              </span>
            </div>
          )}
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_0_rgba(1,75,170,0.04)]">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggleRoom(room)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60"
            >
              <ChevronDown className={"size-4 shrink-0 text-royal transition-transform duration-300 " + (open ? "" : "-rotate-90")} />
              <span className="min-w-0 flex-1">
                <span className="font-heading block truncate text-[1.8rem] leading-[1.05] uppercase">{room}</span>
                <span className="block text-[0.78rem] text-muted-foreground">
                  {list.length} item{list.length === 1 ? "" : "s"}
                </span>
              </span>
              {flagged > 0 && <span className="rounded-full border border-royal px-2 py-0.5 text-[0.72rem] text-royal">{flagged} to review</span>}
              <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-accent sm:block" aria-hidden>
                <span className="block h-full rounded-full bg-royal" style={{ width: `${total > 0 ? Math.max(3, (sub / total) * 100) : 0}%` }} />
              </span>
              <span className="num w-28 text-right text-[1rem] font-semibold">{formatInr(sub)}</span>
            </button>

            {open && (
              <ul className="border-t border-border/60">
                {shown.map((r) => {
                  const a = assessments.get(r.key);
                  const state = a?.state ?? "confirmed";
                  const isOpen = openLine === r.key;
                  return (
                    <li key={r.key} className="border-b border-border/60 last:border-b-0">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenLine(isOpen ? null : r.key)}
                        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 px-4 py-2.5 text-left transition-colors hover:bg-accent/40 sm:grid-cols-[1fr_9rem_7rem_6.5rem]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-[0.88rem]">{r.title || r.item}</span>
                          <span className="block truncate text-[0.76rem] text-muted-foreground">{r.trade}</span>
                        </span>
                        <span className="num hidden text-right text-[0.82rem] text-muted-foreground sm:block">
                          {r.qty} {r.uom} × {r.rate.toLocaleString("en-IN")}
                        </span>
                        <span className="hidden sm:block">
                          {state !== "confirmed" && (
                            <span className={"inline-block rounded-full px-2 py-0.5 text-[0.72rem] " + STATE_PILL[state]}>{STATE_LABEL[state]}</span>
                          )}
                        </span>
                        <span className="num text-right text-[0.9rem] font-medium">{formatInr(r.qty * r.rate)}</span>
                      </button>

                      {isOpen && (
                        <div className="space-y-3 border-t border-border/60 bg-muted/50 px-4 py-4">
                          {a && a.reasons.length > 0 && (
                            <ul className="space-y-0.5 rounded-lg bg-accent px-3 py-2 text-[0.8rem] text-royal-deep">
                              {a.reasons.map((x, n) => (
                                <li key={n}>{x.text}</li>
                              ))}
                            </ul>
                          )}
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <Field label="Room">
                              <select className={fieldCls} value={r.room} onChange={(e) => p.patch(r.key, { room: e.target.value })}>
                                {BOQ_ROOMS.map((x) => (
                                  <option key={x}>{x}</option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Trade">
                              <select className={fieldCls} value={r.trade} onChange={(e) => p.patch(r.key, { trade: e.target.value, rateId: "" })}>
                                {BOQ_TRADES.map((x) => (
                                  <option key={x}>{x}</option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Rate card item" className="sm:col-span-2">
                              <select className={fieldCls} value={r.rateId} onChange={(e) => p.pickRate(r.key, e.target.value)}>
                                <option value="">Custom rate</option>
                                {p.catalog
                                  .filter((c) => c.trade === r.trade)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.code} · {c.item.slice(0, 70)}
                                    </option>
                                  ))}
                              </select>
                            </Field>
                            <Field label="Line title" className="sm:col-span-2">
                              <input className={fieldCls} value={r.title ?? r.item} onChange={(e) => p.patch(r.key, { title: e.target.value })} />
                            </Field>
                            <Field label="Description" className="sm:col-span-2">
                              <textarea className={areaCls} rows={2} value={r.description} onChange={(e) => p.patch(r.key, { description: e.target.value })} />
                            </Field>
                          </div>
                          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                            <Field label="Unit">
                              <select className={fieldCls} value={r.uom} onChange={(e) => p.patchMeasure(r.key, { uom: e.target.value })}>
                                {BOQ_UOMS.map((x) => (
                                  <option key={x}>{x}</option>
                                ))}
                              </select>
                            </Field>
                            {(["l", "b", "h"] as const).map((k) => (
                              <Field key={k} label={k === "l" ? "Length" : k === "b" ? "Breadth" : "Height"}>
                                <input
                                  className={fieldCls + " num text-right"}
                                  inputMode="decimal"
                                  value={r[k] ?? ""}
                                  onChange={(e) => p.patchMeasure(r.key, { [k]: numOrNull(e.target.value), qtySource: "entered" })}
                                />
                              </Field>
                            ))}
                            <Field label={`Qty${r.qtySource ? ` · ${r.qtySource}` : ""}`}>
                              <input
                                className={fieldCls + " num text-right"}
                                inputMode="decimal"
                                value={r.qty}
                                onChange={(e) => p.patch(r.key, { qty: Math.max(0, Number(e.target.value) || 0), qtySource: "entered" })}
                              />
                            </Field>
                            <Field label={`Rate ₹${r.provisional ? " · provisional" : r.rateNote ? " · review" : r.rateSource ? ` · ${r.rateSource}` : ""}`}>
                              <input
                                className={fieldCls + " num text-right"}
                                inputMode="decimal"
                                value={r.rate}
                                title={r.rateNote}
                                onChange={(e) => p.patch(r.key, { rate: Math.max(0, Number(e.target.value) || 0) })}
                              />
                            </Field>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[0.8rem] text-muted-foreground">
                              {r.altRate ? `Livspace ref ₹${r.altRate.toLocaleString("en-IN")}` : ""}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5 text-navy"
                              onClick={() => {
                                setOpenLine(null);
                                p.remove(r.key);
                              }}
                            >
                              <Trash2 className="size-3.5" /> Remove line
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          </Fragment>
        );
      })}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border p-3">
        <select className={fieldCls + " max-w-md"} value={p.pick} onChange={(e) => p.setPick(e.target.value)}>
          <option value="">Add a line from the rate card…</option>
          {BOQ_TRADES.filter((t) => p.catalog.some((c) => c.trade === t)).map((t) => (
            <optgroup key={t} label={t}>
              {p.catalog
                .filter((c) => c.trade === t)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.item.slice(0, 70)} · ₹{c.rate.toLocaleString("en-IN")}/{c.uom}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={p.addFromCatalog} disabled={!p.pick} className="gap-1.5">
          <Plus className="size-4" /> Add line
        </Button>
        <Button variant="ghost" size="sm" onClick={p.addBlank} className="gap-1.5">
          <Plus className="size-4" /> Blank line
        </Button>
      </div>
    </section>
  );
}
