import { z } from "zod";
import { BATH_TILE_H, WALL_NET } from "@/lib/boq/standards";
import { cityNote, makeLine, modularLines, SCOPE_STATUSES, type BoqLine, type QtySource, type ScopeStatus } from "@/lib/boq/build";
import { BOQ_ITEMS, BOQ_ROOMS, type BoqRoom } from "@/lib/boq/lists";
import { findRate } from "@/lib/rates/catalog";
import { normalizeUnit, ordinalOf, resolveUnit, UNIT_CLASSES } from "@/lib/boq/classes";
import { guardFurniture } from "@/lib/boq/tier-guard";
import { RATE_SHEETS, type RateSheet } from "@/lib/rates/sheets";
import { PACKAGE_TIERS, type PackageTier } from "@/lib/quote/constants";

/**
 * Plan + requirements → BOQ.
 *
 * The AI step (lib/ai/boq-brief.ts) only *reads*: rooms with dimensions from the
 * layout plan, and which rate-card items the designer's requirements call for and how
 * they are measured. Every quantity and rupee below is computed here, from the rate
 * card — the model never supplies a price or a quantity it didn't read off the plan.
 */

export const BASES = [
  "floor_area",
  "ceiling_area",
  "wall_area",
  "perimeter",
  "length",
  "elevation",
  "area",
  "count",
] as const;
export type Basis = (typeof BASES)[number];

export const planRoomSchema = z.object({
  id: z.string().max(40),
  name: z.string().max(80),
  boqRoom: z.enum(BOQ_ROOMS),
  /** feet */
  l: z.number().min(0).max(300),
  b: z.number().min(0).max(300),
  h: z.number().min(6).max(40),
  /** labelled = dimensions written on the plan; scaled = measured from a scale; assumed = typical size; entered = typed by the designer. */
  source: z.enum(["labelled", "scaled", "assumed", "entered"]),
});
export type PlanRoom = z.infer<typeof planRoomSchema>;

export const briefItemSchema = z.object({
  room: z.enum(BOQ_ROOMS),
  /** The designer's own words this line answers (traceability). */
  requirement: z.string().max(300),
  /** Specific line title for the "Line / BOQ Item" column, e.g. "Entrance feature wall — fluted HDHMR panelling". */
  title: z.string().max(140).optional(),
  /** The client plan's own label for the space, e.g. "Kids Bedroom-2", "Boot Room" (Area column). */
  area: z.string().max(60).optional(),
  /** Faces to finish for an area item (a door painted on both faces = 2). */
  sides: z.number().min(1).max(2).optional(),
  /** Anything but "modular" is a plain rate item (a unit class sets its own). */
  kind: z.preprocess((v) => (v === "modular" ? "modular" : "rate"), z.enum(["rate", "modular"])),
  /** Unit class (lib/boq/classes.ts): fixes the rate item and a default size from the plan. */
  unit: z.string().max(40).optional(),
  rateId: z.string().max(40).optional(),
  item: z.enum(BOQ_ITEMS).optional(),
  /** An unknown / missing measure falls back to "area" (a unit class carries its own). */
  basis: z.preprocess((v) => (BASES.includes(v as Basis) ? v : "area"), z.enum(BASES)),
  /** Feet — or, for a whole-home area item (basis area, height 1), the sq ft itself. */
  width: z.number().min(0).max(50000).optional(),
  /** Feet; an implausible height (the model put an area here) is ignored, not fatal. */
  height: z.preprocess((v) => (typeof v === "number" && v > 40 ? undefined : v), z.number().min(0).max(40).optional()),
  count: z.number().min(0).max(1000).optional(),
  note: z.string().max(300).optional(),
  /** NEW / REPLACE / REFURBISH are priced; RETAIN / EXCLUDED are recorded, not priced; UNCONFIRMED waits for the designer. */
  status: z.preprocess((v) => (SCOPE_STATUSES.includes(v as ScopeStatus) ? v : "NEW"), z.enum(SCOPE_STATUSES)).optional(),
  /** Set when the designer typed the size in the scope review: it is honoured like a size written in the brief. */
  sizeBy: z.enum(["designer"]).optional(),
  /** A provisional assumption the designer should confirm (shown on the line and in review). */
  assumption: z.string().max(300).optional(),
});
export type BriefItem = z.infer<typeof briefItemSchema>;

export const quantifyRequestSchema = z.object({
  tier: z.enum(PACKAGE_TIERS),
  city: z.string().trim().max(60),
  sheet: z.enum(RATE_SHEETS).default("spazay"),
  rooms: z.array(planRoomSchema).max(40),
  items: z.array(briefItemSchema).max(200),
});

const COUNT_UOMS = ["Nos", "Point", "Set", "L.S."];
const r2 = (n: number) => Math.round(n * 100) / 100;

const DEFAULT_ITEM: Record<string, string> = {
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

export interface QuantifyOptions {
  tier: PackageTier;
  city: string;
  /** Rate sheet that prices the lines (default Spazay). */
  sheet?: RateSheet;
  /** Add whole-home floor protection on the plan's floor area (default true). Deep cleaning is NEVER added by default. */
  homeCare?: boolean;
}

/** What each designer requirement turned into — drives the Scope Coverage sheet and gap warnings. */
export interface CoverageRow {
  requirement: string;
  room: BoqRoom;
  lines: number;
  codes: string[];
  /** Titles of the lines that price it. */
  titles: string[];
  /** Scope status of the requirement (default NEW). */
  status?: ScopeStatus;
}

const WALLPAPER = "wp:WP53";
const PRIMER = "ps:W01"; // wallpaper base preparation (2 putty + oil primer)
/** The old card primer row still counts as "already listed" in a saved or hand-written scope. */
const PRIMER_IDS = [PRIMER, "pt:PT12"];

/** Statuses that are recorded in the scope but never priced (RETAIN / EXCLUDED) or wait on the designer (UNCONFIRMED). */
export const HELD_STATUSES: readonly ScopeStatus[] = ["RETAIN", "EXCLUDED", "UNCONFIRMED"];

export function quantify(
  rawItems: BriefItem[],
  rooms: PlanRoom[],
  opts: QuantifyOptions
): { lines: BoqLine[]; warnings: string[]; coverage: CoverageRow[] } {
  const lines: BoqLine[] = [];
  const warnings: string[] = [];
  const cn = cityNote(opts.city);
  if (cn) warnings.push(cn);
  const coverage = new Map<string, CoverageRow>();
  // Tier grade, client-scope fixtures and opt-in services are enforced before anything is priced or recorded.
  const guarded = guardFurniture(rawItems, opts.tier);
  warnings.push(...guarded.warnings);
  const allItems = guarded.items;
  // Scope status gate: held items are recorded in coverage and never priced; a REFURBISH needs its own
  // refurbishment rate (naming a unit class would price a brand-new unit, so it is held until a rate is given).
  const status = (i: BriefItem): ScopeStatus => i.status ?? "NEW";
  const isHeld = (i: BriefItem) => HELD_STATUSES.includes(status(i)) || (status(i) === "REFURBISH" && !i.rateId);
  for (const i of allItems.filter(isHeld)) {
    coverage.set(`${i.room}|${i.requirement}`, { requirement: i.requirement, room: i.room, lines: 0, codes: [], titles: [], status: status(i) });
    if (status(i) === "UNCONFIRMED") warnings.push(`${i.room}: UNCONFIRMED — “${i.requirement.slice(0, 70)}” is not priced until the designer confirms the scope.`);
    if (status(i) === "REFURBISH") warnings.push(`${i.room}: REFURBISH — “${i.requirement.slice(0, 70)}” has no refurbishment rate on the card; add a manual line.`);
  }
  const items = allItems.filter((i) => !isHeld(i));
  const sheet = opts.sheet ?? "spazay";
  // Several plan rooms can map to one BOQ room (e.g. extra bedrooms): measure them together.
  const sized = (r: BoqRoom) => rooms.filter((x) => x.boqRoom === r && x.l > 0 && x.b > 0);
  const AREA_BASES: Basis[] = ["floor_area", "ceiling_area", "wall_area", "elevation", "area"];

  // Wall paint is measured net of the panelled / wallpapered features, so it goes last.
  const isWallPaint = (it: BriefItem) => {
    const rate = it.rateId ? findRate(it.rateId) : undefined;
    return it.kind === "rate" && it.basis === "wall_area" && rate?.trade === "Paint & Polish";
  };
  // "One per room / level" classes: a second copy is the model double-counting, not a second unit.
  const seenUnit = new Set<string>();
  const unique = items.map(normalizeUnit).filter((i) => {
    const c = i.unit ? UNIT_CLASSES[i.unit] : undefined;
    if (!c?.once) return true;
    // Kids Bedroom-1 vs -2 are two units; "Bedroom" + "Dress" of one master are one.
    const nth = ordinalOf(`${i.area ?? ""} ${i.title ?? ""} ${i.requirement}`);
    const key = c.once === "level" ? i.unit! : `${i.unit}|${i.room}|${nth}`;
    if (seenUnit.has(key)) {
      warnings.push(`${i.room}: duplicate “${i.unit}” ignored (one per ${c.once}).`);
      return false;
    }
    seenUnit.add(key);
    return true;
  });
  // The plan-area label is the model's most reliable pointer: an item whose area is exactly a plan
  // room belongs to that room's BOQ section (it filed a utility counter under Kitchen).
  // Only when the label names ONE section: "BEDROOM" appears on every floor of a plan.
  const bySpace = new Map<string, BoqRoom | null>();
  for (const r of rooms) {
    const k = r.name.replace(/\s*\(.*$/, "").trim().toLowerCase();
    bySpace.set(k, bySpace.has(k) && bySpace.get(k) !== r.boqRoom ? null : r.boqRoom);
  }
  const homed = unique.map((i) => {
    const to = i.area ? bySpace.get(i.area.trim().toLowerCase()) : undefined;
    return to && to !== i.room ? { ...i, room: to } : i;
  });
  const resolved = homed.map((i) => resolveUnit(i, rooms, opts.tier));
  const scaleOf = new Map<BriefItem, number>(resolved.map((r) => [r.item, r.scale]));
  const list = resolved.map((r) => r.item);
  const ordered = [...list.filter((i) => !isWallPaint(i)), ...list.filter(isWallPaint)];
  const primerRooms = new Set(items.filter((i) => PRIMER_IDS.includes(i.rateId ?? "")).map((i) => i.room));

  for (const it of ordered) {
    const before = lines.length;
    const group = sized(it.room);
    const room = group[0];
    const label = `${it.room}: “${it.requirement.slice(0, 60)}”`;
    const title = it.title?.trim() || undefined;
    // Provenance: a size taken off a labelled / scaled plan room is measured; one the designer wrote is entered;
    // a class default, an assumed plan room or a guessed count is an estimate.
    const assumedSize = /Assumed size/.test(it.note ?? "");
    const planSrc: QtySource =
      group.length > 0 && group.every((g) => g.source !== "assumed") ? (group.every((g) => g.source === "entered") ? "entered" : "measured") : "estimated";
    let src: QtySource = planSrc;

    const track = () => {
      const key = `${it.room}|${it.requirement}`;
      const row = coverage.get(key) ?? { requirement: it.requirement, room: it.room, lines: 0, codes: [], titles: [], status: status(it) };
      for (const l of lines.slice(before)) {
        l.scopeStatus = status(it);
        if (it.assumption) l.remarks = [l.remarks, `Assumption: ${it.assumption}`].filter(Boolean).join(" ");
        if (!l.area) l.area = it.area?.trim() || (group.length === 1 ? group[0].name : it.room);
        row.lines++;
        if (!row.codes.includes(l.code)) row.codes.push(l.code);
        if (l.title && !row.titles.includes(l.title)) row.titles.push(l.title);
      }
      coverage.set(key, row);
    };

    if (it.kind === "modular") {
      const w = it.width ?? 0;
      const h = it.height ?? 7;
      if (!(w > 0)) {
        warnings.push(`${label} — modular unit has no width; add a measurement.`);
        track();
        continue;
      }
      const made = modularLines(opts.tier, opts.city, it.room, it.item ?? "Wardrobe", w, h, it.note ?? "", sheet);
      for (const l of made) {
        l.title = title ?? it.requirement.slice(0, 90);
        l.qtySource = assumedSize ? "estimated" : "entered";
      }
      lines.push(...made);
      track();
      continue;
    }

    const rate = it.rateId ? findRate(it.rateId) : undefined;
    if (!rate || !it.rateId) {
      warnings.push(`${label} — unknown rate item “${it.rateId ?? "none"}”, skipped.`);
      track();
      continue;
    }
    // A balcony PVC ceiling with no balcony size is flagged, never measured off the room it was filed under.
    if (it.unit === "pvc_ceiling" && !(it.width && it.width > 0)) {
      warnings.push(`${label} — no dimensions for this balcony ceiling on the plan; enter a width/height or file it under the balcony.`);
      track();
      continue;
    }
    const item = it.item ?? DEFAULT_ITEM[rate.trade] ?? "Civil Work";

    let qty: number | null = null;
    let dims: { l?: number; b?: number; h?: number } = {};
    let note = it.note ?? "";

    if (COUNT_UOMS.includes(rate.uom)) {
      qty = it.count && it.count > 0 ? it.count : 1;
      src = it.count && it.count > 0 && !assumedSize ? "entered" : "estimated";
    } else if (rate.uom === "Rft" || rate.uom === "Rmt") {
      const perimeter = group.reduce((n, g) => n + 2 * (g.l + g.b), 0);
      if (it.basis === "perimeter" && room) {
        qty = perimeter;
        dims = { l: qty };
      } else if (it.width && it.width > 0) {
        qty = it.width;
        dims = { l: it.width };
        src = assumedSize ? "estimated" : "entered";
      } else if (room) {
        warnings.push(`${label} — running-feet item had no length; used the room perimeter. Check it.`);
        qty = perimeter;
        dims = { l: qty };
      }
    } else {
      // area units
      if ((it.basis === "elevation" || it.basis === "area") && it.width && it.width > 0) {
        const h = it.height && it.height > 0 ? it.height : room?.h;
        if (h) {
          qty = it.width * h;
          dims = { l: it.width, h };
          src = assumedSize ? "estimated" : "entered";
        }
      } else if (room) {
        if (!AREA_BASES.includes(it.basis)) {
          warnings.push(
            `${label} — “${it.basis}” doesn't fit a ${rate.uom} item; measured the floor area instead. Check it.`
          );
        }
        if (it.basis === "wall_area") {
          // Bathroom wall finishes run to the standard tile height (8 ft) until measured; paint keeps the room height.
          const wallH = (r: PlanRoom) => (/Bathroom/.test(it.room) && rate.trade !== "Paint & Polish" ? Math.min(r.h, BATH_TILE_H) : r.h);
          qty = group.reduce((n, g) => n + 2 * (g.l + g.b) * wallH(g) * WALL_NET, 0);
          dims = { l: 2 * (room.l + room.b), h: wallH(room) };
          if (rate.trade === "Paint & Polish") {
            const feature = lines
              .filter((l) => l.room === it.room && l.trade === "Wall Panelling" && l.uom === "Sq.Ft.")
              .reduce((n, l) => n + l.qty, 0);
            if (feature > 0) {
              if (feature >= qty) {
                warnings.push(`${label} — the panelled / wallpapered features cover all the wall area; no repaint line added. Check the sizes.`);
                track();
                continue;
              }
              qty -= feature;
              dims = {};
              note = `${note ? `${note} ` : ""}Net of the ${r2(feature)} sq ft panelled / wallpapered feature.`.trim();
            }
          }
        } else {
          qty = group.reduce((n, g) => n + g.l * g.b, 0);
          dims = group.length === 1 ? { l: room.l, b: room.b } : {};
        }
      }
      if (qty !== null && it.sides && it.sides > 1) qty *= it.sides;
    }

    if ((qty === null || !(qty > 0)) && it.room === "Others / Whole Home Civil" && rate.trade === "Paint & Polish" && rate.uom === "Sq.Ft.") {
      // Whole-home paint with no size: walls + ceilings ≈ 2.45 x the floor area of the plan.
      const seen = new Set<string>();
      const floor = rooms.reduce((n, r) => (r.l > 0 && r.b > 0 && !seen.has(r.id) && seen.add(r.id) ? n + r.l * r.b : n), 0);
      if (floor > 0) {
        qty = floor * 2.45;
        src = "estimated";
        dims = {};
        note = `${note ? `${note} ` : ""}Assumed size (2.45 x plan floor area) — confirm on site.`.trim();
      }
    }
    if (qty === null || !(qty > 0)) {
      warnings.push(`${label} — no dimensions for this room on the plan; enter a width/height or add the room.`);
      track();
      continue;
    }
    const lineTitle = title ?? `${it.requirement.slice(0, 90)} — ${rate.item}`;
    const line = makeLine(it.rateId, it.room, item, r2(qty), dims, note || undefined, opts.city, sheet, lineTitle);
    if (line) {
      const scale = scaleOf.get(it) ?? 1;
      if (scale !== 1) {
        line.rate = Math.round(line.rate * scale);
        line.amount = r2(line.qty * line.rate);
      }
      line.qtySource = src;
      lines.push(line);
      // Wallpaper needs its oil-primer base coat; the designer rarely writes it out.
      if (it.rateId === WALLPAPER && !primerRooms.has(it.room)) {
        primerRooms.add(it.room);
        const pr = makeLine(
          PRIMER, it.room, "Paint", r2(qty), dims, "Prior to wallpaper installation.", opts.city, sheet,
          "Oil-primer base coat for wallpaper"
        );
        if (pr) lines.push({ ...pr, qtySource: src, autoAdded: true });
      }
    }
    track();
  }

  // Floor protection is a default charge; the scope may already carry its own, so do not add a second one.
  const hasProtection = lines.some((l) => l.rateId === "sc:SC04" || l.rateId === "sc:SC05");
  if (opts.homeCare !== false && !hasProtection) {
    const seen = new Set<string>();
    let floor = 0;
    for (const r of rooms) {
      if (r.l > 0 && r.b > 0 && !seen.has(r.id)) {
        seen.add(r.id);
        floor += r.l * r.b;
      }
    }
    if (floor > 0) {
      const home: BoqRoom = "Others / Whole Home Civil";
      const extras: [string, string, string][] = [
        ["sc:SC04", "Floor protection during works (on plan floor area).", "Floor protection during works"],
      ];
      for (const [id, note, title] of extras) {
        const l = makeLine(id, home, "Cleaning / Protection", r2(floor), {}, note, opts.city, sheet, title);
        if (l) lines.push({ ...l, area: "Whole Home", autoAdded: true, qtySource: rooms.every((r) => r.source !== "assumed") ? "measured" : "estimated" });
      }
    }
  }

  // An all-in unit already carries carcass + shutter + hardware: flag a room that also bills them separately.
  const allIn = (l: BoqLine) => /^PR\d/.test(l.code) && l.trade === "Modular Woodwork";
  const component = (l: BoqLine) => /^(C|S|H|HG|V|A)\d/.test(l.code) && l.trade === "Modular Woodwork";
  for (const room of new Set(lines.filter(allIn).map((l) => l.room))) {
    if (lines.some((l) => l.room === room && component(l))) {
      warnings.push(`${room}: carcass / shutter / hardware lines sit beside an all-in modular unit — check nothing is charged twice.`);
    }
  }

  const order = new Map<string, number>(BOQ_ROOMS.map((r, i) => [r, i]));
  lines.sort((a, b) => (order.get(a.room) ?? 99) - (order.get(b.room) ?? 99));
  return { lines, warnings, coverage: [...coverage.values()] };
}
