"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BOQ_ITEMS,
  BOQ_ROOMS,
  BOQ_TRADES,
  BOQ_UOMS,
} from "@/lib/boq/lists";
import {
  BHK_OPTIONS,
  CITIES,
  PACKAGE_TIERS,
  QUOTE_ROOM_TYPES,
  SIZED_BHKS,
  TIER_INFO,
  type Bhk,
  type HomeSize,
  type PackageTier,
} from "@/lib/quote/constants";
import { formatInr } from "@/lib/format";
import { autoQty } from "@/lib/boq/measure";

export interface CatalogRate {
  id: string;
  code: string;
  trade: string;
  item: string;
  uom: string;
  rate: number;
  desc: string;
}

export interface WorkbenchInitial {
  bhk: Bhk;
  homeSize?: HomeSize;
  city: string;
  tier: PackageTier;
  rooms: Partial<Record<string, number>>;
  client: string;
  leadId?: string;
}

interface Row {
  key: number;
  /** Rate-card id when the rate came from the sheet; empty = custom rate. */
  rateId: string;
  room: string;
  trade: string;
  item: string;
  description: string;
  uom: string;
  l: number | null;
  b: number | null;
  h: number | null;
  qty: number;
  rate: number;
}

const TRADE_ITEM: Record<string, string> = {
  "Modular Woodwork": "Wardrobe",
  "False Ceiling": "False Ceiling",
  "Paint & Polish": "Paint",
  "Wall Panelling": "Wall Panelling",
  "Electrical & AC Works": "Electrical Point",
  Plumbing: "Plumbing Point",
  "Wall Tiling": "Wall Tiling",
  "Flooring & Skirting": "Floor Tiling",
  "Stone & Countertops": "Countertop",
  "Loose Furniture": "Loose Furniture - Other",
  "Mirrors, Glass & Metal Works": "Mirror / Glass",
  "Doors, Windows & Grills": "Door Work",
  "Furnishings & Décor": "Furnishing",
  "Bathroom Sanitaryware & CP Fittings": "Sanitary Fittings",
  "Site Protection, Deep Cleaning & Handover": "Cleaning / Protection",
};

const selectCls =
  "h-8 w-full rounded-md border border-input bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";
const numCls = "h-8 w-full rounded-md border border-input bg-background px-1.5 text-right text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring";

let keySeq = 1;

export function BoqWorkbench({ initial, catalog }: { initial: WorkbenchInitial; catalog: CatalogRate[] }) {
  const [bhk, setBhk] = useState<Bhk>(initial.bhk);
  const [homeSize, setHomeSize] = useState<HomeSize>(initial.homeSize ?? "small");
  const [city, setCity] = useState(initial.city);
  const [tier, setTier] = useState<PackageTier>(initial.tier);
  const [rooms, setRooms] = useState<Partial<Record<string, number>>>(initial.rooms);
  const [client, setClient] = useState(initial.client);
  const [location, setLocation] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [spec, setSpec] = useState("");
  const [busy, setBusy] = useState<"build" | "export" | null>(null);
  const [pick, setPick] = useState("");

  const roomList = useMemo(
    () =>
      QUOTE_ROOM_TYPES.flatMap((t) =>
        Array.from({ length: Math.min(rooms[t.value] ?? 0, t.max) }, () => ({ roomType: t.value }))
      ),
    [rooms]
  );

  const totals = useMemo(() => {
    const trade = new Map<string, number>();
    const room = new Map<string, number>();
    let all = 0;
    for (const r of rows) {
      const a = r.qty * r.rate;
      all += a;
      trade.set(r.trade, (trade.get(r.trade) ?? 0) + a);
      room.set(r.room, (room.get(r.room) ?? 0) + a);
    }
    const rank = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { all, trade: rank(trade), room: rank(room) };
  }, [rows]);

  async function generate() {
    if (roomList.length === 0) {
      toast.error("Pick at least one room.");
      return;
    }
    if (rows.length > 0 && !window.confirm("Replace the current BOQ lines with a fresh one?")) return;
    setBusy("build");
    try {
      const r = await fetch("/api/boq/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bhk, homeSize: SIZED_BHKS.includes(bhk) ? homeSize : undefined, city, tier, rooms: roomList }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not build the BOQ.");
      setSpec(j.specification);
      setRows(
        j.lines.map((l: Omit<Row, "key">) => ({
          key: keySeq++,
          rateId: l.rateId ?? "",
          room: l.room,
          trade: l.trade,
          item: l.item,
          description: l.description,
          uom: l.uom,
          l: l.l ?? null,
          b: l.b ?? null,
          h: l.h ?? null,
          qty: l.qty,
          rate: l.rate,
        }))
      );
      toast.success(`${j.lines.length} lines generated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the BOQ.");
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy("export");
    try {
      const r = await fetch("/api/boq/export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client,
          location,
          specification: spec || undefined,
          lines: rows.map((r) => ({
            room: r.room,
            trade: r.trade,
            item: r.item,
            description: r.description,
            uom: r.uom,
            l: r.l,
            b: r.b,
            h: r.h,
            qty: r.qty,
            rate: r.rate,
          })),
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Export failed.");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(client || "InnerSpacio").replace(/[^a-z0-9]+/gi, "_")}_BOQ.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  const patch = (key: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  /** Edit L/B/H (or UOM) and keep Quantity in step when it can be derived. */
  function patchMeasure(key: number, p: Partial<Row>) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const n = { ...r, ...p };
        const q = autoQty(n.uom, n.l, n.b, n.h);
        return q === null ? n : { ...n, qty: q };
      })
    );
  }

  /** Pick a rate-card item: rate, unit, description and standard item follow the sheet. */
  function pickRate(key: number, id: string) {
    const c = catalog.find((x) => x.id === id);
    if (!c) {
      patch(key, { rateId: "" });
      return;
    }
    patchMeasure(key, {
      rateId: id,
      trade: c.trade,
      item: TRADE_ITEM[c.trade] ?? "Civil Work",
      description: c.desc || c.item,
      uom: c.uom,
      rate: c.rate,
    });
  }

  function addBlank() {
    setRows((rs) => [
      ...rs,
      {
        key: keySeq++,
        rateId: "",
        room: rs.at(-1)?.room ?? "Living",
        trade: rs.at(-1)?.trade ?? BOQ_TRADES[0],
        item: BOQ_ITEMS[0],
        description: "",
        uom: "Sq.Ft.",
        l: null,
        b: null,
        h: null,
        qty: 0,
        rate: 0,
      },
    ]);
  }
  const numOrNull = (v: string) => (v === "" ? null : Math.max(0, Number(v) || 0));

  function addFromCatalog() {
    const c = catalog.find((x) => x.id === pick);
    if (!c) return;
    setRows((rs) => [
      ...rs,
      {
        key: keySeq++,
        rateId: c.id,
        room: rs.at(-1)?.room ?? "Living",
        trade: c.trade,
        item: TRADE_ITEM[c.trade] ?? "Civil Work",
        description: c.desc || c.item,
        uom: c.uom,
        l: null,
        b: null,
        h: null,
        qty: 1,
        rate: c.rate,
      },
    ]);
    setPick("");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Client</span>
            <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Project location</span>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Site address" />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">City (rate factor)</span>
            <select className={selectCls + " h-9"} value={city} onChange={(e) => setCity(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Specification</span>
            <select
              className={selectCls + " h-9"}
              value={tier}
              onChange={(e) => setTier(e.target.value as PackageTier)}
            >
              {PACKAGE_TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_INFO[t].label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">BHK</span>
            <select className={selectCls + " h-9"} value={bhk} onChange={(e) => setBhk(e.target.value as Bhk)}>
              {BHK_OPTIONS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          {SIZED_BHKS.includes(bhk) && (
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Home size</span>
              <select
                className={selectCls + " h-9"}
                value={homeSize}
                onChange={(e) => setHomeSize(e.target.value as HomeSize)}
              >
                <option value="small">Small</option>
                <option value="large">Large</option>
              </select>
            </label>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          {QUOTE_ROOM_TYPES.map((t) => (
            <label key={t.value} className="space-y-1 text-xs">
              <span className="text-muted-foreground">{t.label.replace(/ \(.*/, "")}</span>
              <Input
                type="number"
                min={0}
                max={t.max}
                className="w-20"
                value={rooms[t.value] ?? 0}
                onChange={(e) =>
                  setRooms((r) => ({ ...r, [t.value]: Math.min(t.max, Math.max(0, Number(e.target.value) || 0)) }))
                }
              />
            </label>
          ))}
          <Button onClick={generate} disabled={busy !== null} className="gap-2">
            {busy === "build" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {rows.length ? "Regenerate BOQ" : "Generate BOQ"}
          </Button>
          {rows.length === 0 && (
            <Button variant="outline" onClick={addBlank} className="gap-2">
              <Plus className="size-4" /> Start blank (calculator)
            </Button>
          )}
        </div>
      </section>

      {rows.length > 0 && (
        <>
          <section className="rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <h2 className="text-sm font-medium">Master BOQ · {rows.length} lines</h2>
                <p className="text-xs text-muted-foreground">
                  Quantities use standard room sizes — replace with site measurements before issuing.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="editorial-heading text-2xl tabular-nums">{formatInr(totals.all)}</p>
                <Button onClick={download} disabled={busy !== null} className="gap-2">
                  {busy === "export" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Download .xlsx
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1420px] text-xs">
                <thead>
                  <tr className="bg-muted/60 text-left text-muted-foreground">
                    {["Room", "Trade", "Line / BOQ item", "Rate card item", "Description", "UOM", "L", "B", "H", "Qty", "Rate ₹", "Amount ₹", ""].map(
                      (h) => (
                        <th key={h} className="px-1.5 py-2 font-medium">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-t border-border/70 align-top">
                      <td className="w-36 p-1">
                        <select className={selectCls} value={r.room} onChange={(e) => patch(r.key, { room: e.target.value })}>
                          {BOQ_ROOMS.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </td>
                      <td className="w-40 p-1">
                        <select className={selectCls} value={r.trade} onChange={(e) => patch(r.key, { trade: e.target.value, rateId: "" })}>
                          {BOQ_TRADES.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </td>
                      <td className="w-40 p-1">
                        <select className={selectCls} value={r.item} onChange={(e) => patch(r.key, { item: e.target.value })}>
                          {BOQ_ITEMS.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </td>
                      <td className="w-56 p-1">
                        <select className={selectCls} value={r.rateId} onChange={(e) => pickRate(r.key, e.target.value)}>
                          <option value="">Custom rate</option>
                          {catalog
                            .filter((c) => c.trade === r.trade)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.code} · {c.item.slice(0, 46)}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="min-w-64 p-1">
                        <textarea
                          rows={2}
                          className="w-full resize-y rounded-md border border-input bg-background px-1.5 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={r.description}
                          onChange={(e) => patch(r.key, { description: e.target.value })}
                        />
                      </td>
                      <td className="w-20 p-1">
                        <select className={selectCls} value={r.uom} onChange={(e) => patchMeasure(r.key, { uom: e.target.value })}>
                          {BOQ_UOMS.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </td>
                      {(["l", "b", "h"] as const).map((k) => (
                        <td key={k} className="w-14 p-1">
                          <input
                            className={numCls}
                            inputMode="decimal"
                            value={r[k] ?? ""}
                            onChange={(e) => patchMeasure(r.key, { [k]: numOrNull(e.target.value) })}
                          />
                        </td>
                      ))}
                      <td className="w-20 p-1">
                        <input
                          className={numCls}
                          inputMode="decimal"
                          value={r.qty}
                          onChange={(e) => patch(r.key, { qty: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td className="w-24 p-1">
                        <input
                          className={numCls}
                          inputMode="decimal"
                          value={r.rate}
                          onChange={(e) => patch(r.key, { rate: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td className="w-28 px-1.5 py-2 text-right tabular-nums">{formatInr(r.qty * r.rate)}</td>
                      <td className="w-8 p-1">
                        <button
                          type="button"
                          aria-label="Delete line"
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                          onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
              <select className={selectCls + " h-9 max-w-md"} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Add a line from the rate card…</option>
                {BOQ_TRADES.filter((t) => catalog.some((c) => c.trade === t)).map((t) => (
                  <optgroup key={t} label={t}>
                    {catalog
                      .filter((c) => c.trade === t)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} · {c.item.slice(0, 70)} · ₹{c.rate.toLocaleString("en-IN")}/{c.uom}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={addFromCatalog} disabled={!pick} className="gap-1.5">
                <Plus className="size-4" /> Add line
              </Button>
              <Button variant="ghost" size="sm" onClick={addBlank} className="gap-1.5">
                <Plus className="size-4" /> Blank line
              </Button>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["Trade-wise", totals.trade],
                ["Room-wise", totals.room],
              ] as const
            ).map(([title, list]) => (
              <section key={title} className="rounded-xl border border-border bg-card p-4">
                <h3 className="text-sm font-medium">{title} costing</h3>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {list.map(([k, v]) => (
                    <li key={k} className="flex justify-between gap-3">
                      <span>{k}</span>
                      <span className="tabular-nums text-muted-foreground">{formatInr(v)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
