"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, FileText, Loader2, Plus, Ruler, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BOQ_ITEMS,
  BOQ_TRADES,
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
import { sanityChecks, validateBoq } from "@/lib/boq/validate";
import { carpetArea } from "@/lib/boq/standards";
import { BriefNotes, BriefPanel, PlanRoomsEditor, type BriefResult } from "@/components/boq/brief-panel";
import type { BriefItem, PlanRoom } from "@/lib/boq/brief";
import { BoqSummary } from "@/components/boq/boq-summary";
import { BoqBoard } from "@/components/boq/boq-board";
import { RevisionPanel } from "@/components/boq/revision-panel";
import { boqStatus, type BoqStatus, type Snapshot } from "@/lib/boq/revisions";
import { ScopeReview, type UnitOption } from "@/components/boq/scope-review";
import type { ScopeStatus } from "@/lib/boq/build";
import { lineAssessment } from "@/lib/boq/decisions";
import { RATE_SHEETS, RATE_SHEET_LABEL, type RateSheet } from "@/lib/rates/sheets";

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
  /** Every BOQ lives under a project. */
  projectId: string;
  projectTitle?: string;
  /** A previously saved BOQ being reopened. */
  saved?: { id: string; title: string; sheet: string; payload: Record<string, unknown> };
}

type Coverage = { requirement: string; room: string; lines: number; codes: string[]; titles: string[]; status?: ScopeStatus };

export interface Row {
  key: number;
  /** Specific line title (what / where / finish); falls back to the standard item. */
  title?: string;
  area?: string;
  remarks?: string;
  rateSource?: "spazay" | "livspace";
  altRate?: number | null;
  provisional?: boolean;
  /** A rate to review (no verified rate on the chosen sheet). */
  rateNote?: string;
  /** Scope status of the item this line prices (NEW when absent). */
  scopeStatus?: ScopeStatus;
  /** Added by the system, not by a scope item. */
  autoAdded?: boolean;
  /** Where the quantity came from; editing it makes it "entered". */
  qtySource?: "measured" | "entered" | "estimated";
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
  "h-8 w-full rounded-lg border border-transparent bg-transparent px-2 text-[0.8rem] outline-none transition-colors hover:border-input focus-visible:border-primary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-royal/70";

let keySeq = 1;

type LineLike = Omit<Row, "key" | "rateId"> & { rateId?: string };

function toRows(lines: LineLike[]): Row[] {
  return lines.map((l) => ({
    key: keySeq++,
    rateId: l.rateId ?? "",
    room: l.room,
    trade: l.trade,
    item: l.item,
    title: l.title,
    area: l.area,
    remarks: l.remarks,
    rateSource: l.rateSource,
    altRate: l.altRate ?? null,
    provisional: l.provisional,
    rateNote: l.rateNote,
    qtySource: l.qtySource,
    scopeStatus: l.scopeStatus,
    autoAdded: l.autoAdded,
    description: l.description,
    uom: l.uom,
    l: l.l ?? null,
    b: l.b ?? null,
    h: l.h ?? null,
    qty: l.qty,
    rate: l.rate,
  }));
}

export function BoqWorkbench({ initial, catalog, units }: { initial: WorkbenchInitial; catalog: CatalogRate[]; units: UnitOption[] }) {
  const [bhk, setBhk] = useState<Bhk>(initial.bhk);
  const [homeSize, setHomeSize] = useState<HomeSize>(initial.homeSize ?? "small");
  const [city, setCity] = useState(initial.city);
  const [tier, setTier] = useState<PackageTier>(initial.tier);
  const savedPayload = initial.saved?.payload as
    | { lines?: LineLike[]; coverage?: Coverage[]; planRooms?: PlanRoom[]; specification?: string; location?: string; client?: string; scope?: { approved: boolean; items: BriefItem[] }; revision?: number; finalApproved?: { at: string; by: string }; revisions?: Snapshot[]; budget?: number }
    | undefined;
  const [sheet, setSheet] = useState<RateSheet>(
    (RATE_SHEETS as readonly string[]).includes(initial.saved?.sheet ?? "") ? (initial.saved!.sheet as RateSheet) : "spazay"
  );
  const [boqId, setBoqId] = useState<string | undefined>(initial.saved?.id);
  const [title, setTitle] = useState(
    initial.saved?.title ?? `${initial.client || initial.projectTitle || "Project"} — BOQ`
  );
  const [coverage, setCoverage] = useState<Coverage[]>(savedPayload?.coverage ?? []);
  const [rooms, setRooms] = useState<Partial<Record<string, number>>>(initial.rooms);
  const [client, setClient] = useState(savedPayload?.client ?? initial.client);
  const [location, setLocation] = useState(savedPayload?.location ?? "");
  const [rows, setRows] = useState<Row[]>(() => (savedPayload?.lines ? toRows(savedPayload.lines) : []));
  const [spec, setSpec] = useState(savedPayload?.specification ?? "");
  const [busy, setBusy] = useState<"build" | "export" | "save" | null>(null);
  const [pick, setPick] = useState("");
  const [mode, setMode] = useState<"brief" | "spec">("brief");
  // Saves made before ids were stored have none: give each a stable one so quantify's room de-dupe still works.
  const [planRooms, setPlanRooms] = useState<PlanRoom[]>(() => (savedPayload?.planRooms ?? []).map((p, i) => ({ ...p, id: p.id ?? `r${i}` })));
  const [briefItems, setBriefItemsRaw] = useState<BriefItem[]>(savedPayload?.scope?.items ?? []);
  const [budget, setBudget] = useState<number | undefined>(savedPayload?.budget);
  const [revision, setRevision] = useState(savedPayload?.revision ?? 1);
  const [finalApproved, setFinalApproved] = useState<{ at: string; by: string } | null>(savedPayload?.finalApproved ?? null);
  const [revisions, setRevisions] = useState<Snapshot[]>(savedPayload?.revisions ?? []);
  const [scopeApproved, setScopeApproved] = useState(savedPayload?.scope?.approved ?? false);
  // True once the scope is edited after the lines were computed; cleared by "Update BOQ".
  const [scopeDirty, setScopeDirty] = useState(false);
  /** Any scope edit un-approves the BOQ and asks for a re-price. */
  const setBriefItems = (items: BriefItem[]) => {
    setBriefItemsRaw(items);
    setScopeApproved(false);
    setScopeDirty(true);
  };
  const [notes, setNotes] = useState<Pick<BriefResult, "warnings" | "assumptions" | "unpriced" | "questions"> | null>(null);

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

  // Per-line state (confirmed / assumed / awaiting professional approval) with the reasons behind it.
  const assessments = useMemo(() => new Map(rows.map((r) => [r.key, lineAssessment(r, rows)] as const)), [rows]);

  // Live checks on whatever is in the table, so every edit is re-validated. Warnings only: nothing here changes a number.
  const issues = useMemo(() => {
    const area = planRooms.length
      ? planRooms.reduce((n, p) => n + p.l * p.b, 0)
      : carpetArea(bhk, SIZED_BHKS.includes(bhk) ? homeSize : undefined);
    return [...validateBoq(rows, { cardRates: planRooms.length > 0 }), ...sanityChecks({ total: totals.all, area, bhk, tier })];
  }, [rows, totals.all, planRooms, bhk, homeSize, tier]);
  const qtyCounts = useMemo(() => {
    const c = { measured: 0, entered: 0, estimated: 0 };
    for (const r of rows) if (r.qtySource) c[r.qtySource]++;
    return c;
  }, [rows]);

  const status: BoqStatus = boqStatus({
    scope: briefItems.length ? { approved: scopeApproved, items: briefItems } : undefined,
    revision,
    finalApproved: finalApproved ?? undefined,
  });
  const canApprove = rows.length > 0 && (briefItems.length === 0 || (scopeApproved && !scopeDirty)) && !issues.some((i) => i.severity === "error");

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
        body: JSON.stringify({ bhk, homeSize: SIZED_BHKS.includes(bhk) ? homeSize : undefined, city, tier, sheet, rooms: roomList }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not build the BOQ.");
      setSpec(j.specification);
      setRows(toRows(j.lines));
      setPlanRooms([]);
      setBriefItemsRaw([]);
      setScopeApproved(false);
      setNotes({ warnings: j.warnings ?? [], assumptions: j.assumptions ?? [], unpriced: [], questions: [] });
      setCoverage([]);
      toast.success(`${j.lines.length} lines generated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the BOQ.");
    } finally {
      setBusy(null);
    }
  }

  function onBriefResult(r: BriefResult) {
    // An analysis that read no scope must never replace (or fake) a BOQ.
    if (r.items.length === 0 || r.lines.length === 0) {
      toast.error("The AI returned no priceable scope, so nothing was changed. Check the requirements text and try again, or add lines manually.");
      return;
    }
    setRows(toRows(r.lines as unknown as LineLike[]));
    setPlanRooms(r.rooms);
    setBriefItemsRaw(r.items);
    setScopeApproved(false);
    setScopeDirty(false);
    setNotes({ warnings: r.warnings, assumptions: r.assumptions, unpriced: r.unpriced, questions: r.questions });
    setCoverage(r.coverage ?? []);
    setSpec(`${TIER_INFO[tier].label} specification`);
  }

  /** Free (no AI): re-measure the same scope after the designer corrects a room size. */
  async function recalc() {
    if (rows.length > 0 && !window.confirm("Recalculate from the room sizes? Manual edits to lines will be replaced.")) return;
    setBusy("build");
    try {
      const r = await fetch("/api/boq/quantify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier, city, sheet, rooms: planRooms, items: briefItems }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not recalculate.");
      setRows(toRows(j.lines));
      setCoverage(j.coverage ?? []);
      setScopeDirty(false);
      setNotes((n) => (n ? { ...n, warnings: j.warnings } : n));
      toast.success("Quantities recalculated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not recalculate.");
    } finally {
      setBusy(null);
    }
  }

  /** Delete the whole BOQ at once; the toast offers an undo. */
  function deleteAll() {
    if (rows.length === 0) return;
    if (!window.confirm(`Delete this entire BOQ (${rows.length} lines)?`)) return;
    const snap = { rows, planRooms, briefItems, notes, spec };
    setRows([]);
    setPlanRooms([]);
    setBriefItemsRaw([]);
    setScopeApproved(false);
    setNotes(null);
    setSpec("");
    toast("BOQ deleted.", {
      duration: 10000,
      action: {
        label: "Undo",
        onClick: () => {
          setRows(snap.rows);
          setPlanRooms(snap.planRooms);
          setBriefItemsRaw(snap.briefItems);
          setNotes(snap.notes);
          setSpec(snap.spec);
        },
      },
    });
  }

  /** What the workbook export and the project save both send. */
  function exportBody() {
    return {
          client,
          location,
          specification: [spec, `Rev ${revision}`, finalApproved ? "APPROVED" : "DRAFT — not approved"].filter(Boolean).join(" · ") || undefined,
          sheet,
          coverage: coverage.length ? coverage : undefined,
          budget,
          scope: briefItems.length ? { approved: scopeApproved, items: briefItems } : undefined,
          planRooms: planRooms.length
            ? planRooms.map((p) => ({ id: p.id, name: p.name, boqRoom: p.boqRoom, l: p.l, b: p.b, h: p.h, source: p.source }))
            : undefined,
          lines: rows.map((r) => ({
            room: r.room,
            trade: r.trade,
            item: r.item,
            title: r.title || undefined,
            area: r.area || undefined,
            remarks: r.remarks || undefined,
            rateSource: r.rateSource,
            altRate: r.altRate ?? undefined,
            provisional: r.provisional || undefined,
            rateNote: r.rateNote || undefined,
            qtySource: r.qtySource,
            scopeStatus: r.scopeStatus,
            rateId: r.rateId,
            autoAdded: r.autoAdded || undefined,
            description: r.description,
            uom: r.uom,
            l: r.l,
            b: r.b,
            h: r.h,
            qty: r.qty,
            rate: r.rate,
          })),
        };
  }

  function sigOf() {
    return JSON.stringify({ ...exportBody(), specification: undefined, title, tier, city });
  }

  async function save(approve = false) {
    setBusy("save");
    const mySig = sigOf();
    try {
      const r = await fetch("/api/boq/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...exportBody(),
          projectId: initial.projectId,
          boqId,
          leadId: initial.leadId,
          title: title.trim() || "BOQ",
          tier,
          city,
          finalApprove: approve || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not save.");
      setBoqId(j.id);
      setSavedSig(mySig);
      setRevision(j.revision ?? 1);
      setFinalApproved(j.finalApproved ?? null);
      setRevisions(j.revisions ?? []);
      toast.success(approve ? "Estimate approved and saved." : j.revision > 1 && !j.finalApproved ? `Saved as revision ${j.revision} (draft).` : "Saved to the project.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
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
        body: JSON.stringify(exportBody()),
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
        qtySource: "entered",
      },
    ]);
  }

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
        qtySource: "entered",
      },
    ]);
    setPick("");
  }

  const [view, setView] = useState<"scope" | "editor" | "review">(() => (savedPayload?.lines?.length ? "editor" : "scope"));
  // Signature of what was last saved (or loaded), so the total bar can say whether there are unsaved edits.
  const [savedSig, setSavedSig] = useState<string | null>(() => (initial.saved ? sigOf() : null));

  const sig = sigOf();
  const saveLabel = busy === "save" ? "Saving…" : !boqId ? "Not saved yet" : sig === savedSig ? "All changes saved" : "Unsaved changes";
  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.length - errors;
  const empty = (
    <div className="rounded-3xl border border-dashed border-border p-12 text-center">
      <p className="font-heading text-[2rem] leading-none uppercase">No BOQ yet</p>
      <p className="mx-auto mt-3 max-w-sm text-[0.92rem] text-muted-foreground">Read a plan or enter a home spec in Scope, then the lines appear here.</p>
      <Button className="mt-5" onClick={() => setView("scope")}>
        Go to Scope
      </Button>
    </div>
  );
  const tabs = [
    ["scope", "Scope", briefItems.length ? `${briefItems.length} items` : null],
    ["editor", "BOQ Editor", rows.length ? `${rows.length} lines` : null],
    ["review", "Review & Export", errors + warns > 0 ? `${errors + warns} checks` : null],
  ] as const;

  return (
    <div className="space-y-6 pb-28">
      <nav aria-label="BOQ views" className="sticky top-0 z-20 -mx-1 flex justify-center gap-2 overflow-x-auto bg-background/90 px-1 backdrop-blur" role="tablist">
        {tabs.map(([v, label, meta]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={
              "relative shrink-0 px-6 py-4 text-[1.2rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-royal " +
              (view === v ? "text-royal" : "text-muted-foreground hover:text-foreground")
            }
          >
            {label}
            {meta && <span className="ml-2 text-[0.8rem] font-normal text-muted-foreground">{meta}</span>}
            <span className={"absolute inset-x-4 bottom-0 h-[3px] rounded-full bg-royal transition-opacity " + (view === v ? "opacity-100" : "opacity-0")} />
          </button>
        ))}
      </nav>

      {/* All three views stay mounted (just hidden) so typed text, filters and open rooms survive a tab switch. */}
      <div role="tabpanel" hidden={view !== "scope"} className="flex flex-col gap-6">
      {/* Once a BOQ exists the empty builder form is just noise: it drops below the scope review. */}
      <section style={{ order: rows.length > 0 ? 2 : 0 }} className="rounded-3xl border border-border/60 bg-card p-6 sm:p-8">
        <div className="mb-6 inline-flex rounded-full border border-border p-1 text-[0.8rem]">
          {(
            [
              ["brief", "From plan + requirements", FileText],
              ["spec", "From home spec (quick estimate)", Ruler],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors duration-300 " +
                (mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")
              }
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-[0.85rem]">
            <span className="text-muted-foreground">Client</span>
            <Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Client name" />
          </label>
          <label className="space-y-1 text-[0.85rem]">
            <span className="text-muted-foreground">Project location</span>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Site address" />
          </label>
          <label className="space-y-1 text-[0.85rem]">
            <span className="text-muted-foreground">City (rate factor)</span>
            <select className={selectCls + " h-9"} value={city} onChange={(e) => setCity(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[0.85rem]">
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
          <label className="space-y-1 text-[0.85rem]">
            <span className="text-muted-foreground">Rate sheet</span>
            <select
              className={selectCls + " h-9"}
              value={sheet}
              onChange={(e) => setSheet(e.target.value as RateSheet)}
              aria-describedby="sheet-hint"
            >
              {RATE_SHEETS.map((s) => (
                <option key={s} value={s}>
                  {RATE_SHEET_LABEL[s]}
                </option>
              ))}
            </select>
            <span id="sheet-hint" className="block text-[0.82rem] text-muted-foreground">
              {sheet === "spazay" && "Full card; every line priced from Spazay."}
              {sheet === "livspace" && "Livspace where a verified equivalent exists; other lines fall back to Spazay (marked)."}
              {sheet === "both" && "Billed on Spazay; Livspace shown beside each comparable line."}
              {rows.length > 0 && " Recalculate / regenerate to re-price."}
            </span>
          </label>
          {mode === "spec" && (
          <label className="space-y-1 text-[0.85rem]">
            <span className="text-muted-foreground">BHK</span>
            <select className={selectCls + " h-9"} value={bhk} onChange={(e) => setBhk(e.target.value as Bhk)}>
              {BHK_OPTIONS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          )}
          {mode === "spec" && SIZED_BHKS.includes(bhk) && (
            <label className="space-y-1 text-[0.85rem]">
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

        {mode === "brief" && <BriefPanel
            tier={tier}
            city={city}
            sheet={sheet}
            onResult={onBriefResult}
            onBeforeRun={() =>
              rows.length === 0 ||
              window.confirm(
                finalApproved
                  ? "This analysis will replace the working BOQ. The approved revision stays saved; saving the new one creates the next revision. Continue?"
                  : "This analysis will replace the current BOQ lines. Continue?"
              )
            }
          />}

        {mode === "spec" && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {QUOTE_ROOM_TYPES.map((t) => (
            <label key={t.value} className="space-y-1 text-[0.85rem]">
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
        )}
      </section>

      {briefItems.length > 0 && (
        <ScopeReview
          items={briefItems}
          onChange={setBriefItems}
          units={units}
          questions={notes?.questions ?? []}
          approved={scopeApproved}
          dirty={scopeDirty}
          busy={busy !== null}
          onUpdate={recalc}
          onApprove={() => setScopeApproved(true)}
          onReopen={() => setScopeApproved(false)}
        />
      )}
      {planRooms.length > 0 && (
        <PlanRoomsEditor rooms={planRooms} onChange={setPlanRooms} onRecalc={recalc} busy={busy !== null} />
      )}
      {notes && <BriefNotes result={notes} />}

        {rows.length > 0 && (
          <p style={{ order: 1 }} className="text-[0.88rem] text-muted-foreground">
            {rows.length} lines priced.{" "}
            <button type="button" className="text-royal underline-offset-4 hover:underline" onClick={() => setView("editor")}>
              Open the BOQ Editor
            </button>
          </p>
        )}
      </div>

      <div role="tabpanel" hidden={view !== "editor"}>
        {rows.length === 0 ? (
          empty
        ) : (
          <BoqBoard
            rows={rows}
            catalog={catalog}
            assessments={assessments}
            patch={patch}
            patchMeasure={patchMeasure}
            pickRate={pickRate}
            remove={(key) => setRows((rs) => rs.filter((x) => x.key !== key))}
            pick={pick}
            setPick={setPick}
            addFromCatalog={addFromCatalog}
            addBlank={addBlank}
          />
        )}
      </div>

      <div role="tabpanel" hidden={view !== "review"} className="space-y-6">
        {rows.length === 0 ? (
          empty
        ) : (
          <>
            <RevisionPanel status={status} revision={revision} approvedAt={finalApproved?.at} revisions={revisions} current={rows} />
      {issues.length > 0 && (
        <details className="rounded-3xl border border-border/60 bg-card p-5 text-[0.9rem]" open={issues.some((i) => i.severity === "error")}>
          <summary className="cursor-pointer font-medium">
            Checks · {issues.filter((i) => i.severity === "error").length} errors · {issues.filter((i) => i.severity === "warn").length} warnings
          </summary>
          <ul className="mt-3 space-y-1.5 text-muted-foreground">
            {issues.slice(0, 80).map((i, n) => (
              <li key={n} className={i.severity === "error" ? "text-destructive" : undefined}>
                {i.severity === "error" ? "Error: " : ""}
                {i.message}
              </li>
            ))}
            {issues.length > 80 && <li>…and {issues.length - 80} more.</li>}
          </ul>
        </details>
      )}


            <section className="rounded-3xl border border-border/60 bg-card p-6">
              <h3 className="font-heading text-[1.8rem] leading-none uppercase">Quantities</h3>
              <div className="mt-4 flex h-1.5 max-w-md overflow-hidden rounded-full bg-accent">
                {(["measured", "entered", "estimated"] as const).map((k, n) => (
                  <span key={k} className={n === 0 ? "bg-navy" : n === 1 ? "bg-royal" : "bg-signal"} style={{ width: `${(qtyCounts[k] / rows.length) * 100}%` }} />
                ))}
              </div>
              <p className="mt-2 text-[0.85rem] text-muted-foreground">
                {qtyCounts.measured} measured · {qtyCounts.entered} entered · {qtyCounts.estimated} estimated
                {qtyCounts.estimated > 0 ? ". Replace estimates with site measurements before issuing." : ""}
              </p>
            </section>

            <BoqSummary rows={rows} project={client || initial.projectTitle || ""} location={location} tier={TIER_INFO[tier].label} budget={budget} onBudget={setBudget} />

            <section className="rounded-3xl border border-border/60 bg-card p-6">
              <h3 className="font-heading text-[1.8rem] leading-none uppercase">By trade</h3>
              <ul className="mt-5 space-y-3">
                {totals.trade.map(([k, v]) => (
                  <li key={k}>
                    <div className="flex justify-between gap-3 text-[0.88rem]">
                      <span>{k}</span>
                      <span className="num text-muted-foreground">{formatInr(v)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-accent">
                      <div className="h-full rounded-full bg-royal" style={{ width: `${totals.all > 0 ? Math.max(2, (v / totals.all) * 100) : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-wrap items-end gap-3 rounded-3xl border border-border/60 bg-card p-6">
              <label className="space-y-1 text-[0.85rem]">
                <span className="text-muted-foreground">BOQ name</span>
                <Input aria-label="BOQ name" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 w-64" />
              </label>
              {boqId && (
                <Button variant="outline" render={<a href={`/boq-print/${initial.projectId}/${boqId}`} target="_blank" rel="noreferrer" />} className="gap-2">
                  <FileText className="size-4" /> Print / PDF
                </Button>
              )}
              <Button
                variant="outline"
                onClick={download}
                disabled={busy !== null || (briefItems.length > 0 && !scopeApproved)}
                title={briefItems.length > 0 && !scopeApproved ? "Approve the scope before exporting" : undefined}
                className="gap-2"
              >
                {busy === "export" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download .xlsx
              </Button>
              <Button variant="ghost" onClick={deleteAll} disabled={busy !== null} className="ml-auto gap-2 text-navy">
                <Trash2 className="size-4" /> Delete BOQ
              </Button>
            </section>
          </>
        )}
      </div>

      {rows.length > 0 && (
        <div className="fixed inset-x-3 bottom-3 z-30 mx-auto max-w-5xl rounded-2xl bg-navy px-5 py-3 text-cream shadow-[0_18px_40px_-18px_rgba(5,24,54,0.7)]">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <p className="text-[0.72rem] text-cream/70">Subtotal (ex-GST) · {rows.length} lines</p>
              <p className="num text-[1.5rem] leading-none font-semibold">{formatInr(totals.all)}</p>
            </div>
            <button type="button" onClick={() => setView("review")} className="text-left text-[0.82rem] text-cream/80 hover:text-cream">
              {errors + warns === 0 ? "No warnings" : `${errors} errors · ${warns} warnings`}
            </button>
            <span role="status" className="text-[0.82rem] text-cream/80">
              {saveLabel}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => save()} disabled={busy !== null} className="gap-2">
                {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                {boqId ? "Save" : "Save to project"}
              </Button>
              <Button
                size="sm"
                onClick={() => save(true)}
                disabled={busy !== null || !canApprove || status === "approved"}
                title={status === "approved" ? "Already approved" : !canApprove ? "Approve the scope and clear errors first" : "Approve this estimate and save it"}
                className="gap-2 bg-cream text-navy hover:bg-accent"
              >
                <CheckCircle2 className="size-4" /> {status === "approved" ? "Approved" : "Approve"}
              </Button>
              <Button size="sm" onClick={() => (view === "review" ? download() : setView("review"))} disabled={busy !== null} className="gap-2">
                {busy === "export" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Export
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
