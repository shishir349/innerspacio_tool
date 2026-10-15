import { z } from "zod";
import { makeLine, modularLines, type BoqLine } from "@/lib/boq/build";
import { BOQ_ITEMS, BOQ_ROOMS, type BoqRoom } from "@/lib/boq/lists";
import { findRate } from "@/lib/rates/catalog";
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
  /** labelled = dimensions written on the plan; scaled = measured from a scale; assumed = typical size. */
  source: z.enum(["labelled", "scaled", "assumed"]),
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
  kind: z.enum(["rate", "modular"]),
  rateId: z.string().max(40).optional(),
  item: z.enum(BOQ_ITEMS).optional(),
  basis: z.enum(BASES),
  width: z.number().min(0).max(300).optional(),
  height: z.number().min(0).max(40).optional(),
  count: z.number().min(0).max(1000).optional(),
  note: z.string().max(300).optional(),
});
export type BriefItem = z.infer<typeof briefItemSchema>;

export const quantifyRequestSchema = z.object({
  tier: z.enum(PACKAGE_TIERS),
  city: z.string().trim().max(60),
  sheet: z.enum(RATE_SHEETS).default("spazay"),
  rooms: z.array(planRoomSchema).max(40),
  items: z.array(briefItemSchema).max(200),
});

const WALL_NET = 0.85;
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
  /** Add whole-home post-renovation deep cleaning on the plan's floor area (default true). */
  homeCare?: boolean;
  /** Also add floor protection for the whole plan (default false — only when asked for). */
  floorProtection?: boolean;
}

/** What each designer requirement turned into — drives the Scope Coverage sheet and gap warnings. */
export interface CoverageRow {
  requirement: string;
  room: BoqRoom;
  lines: number;
  codes: string[];
  /** Titles of the lines that price it. */
  titles: string[];
}

const WALLPAPER = "wp:WP53";
const PRIMER = "pt:PT12";

export function quantify(
  items: BriefItem[],
  rooms: PlanRoom[],
  opts: QuantifyOptions
): { lines: BoqLine[]; warnings: string[]; coverage: CoverageRow[] } {
  const lines: BoqLine[] = [];
  const warnings: string[] = [];
  const coverage = new Map<string, CoverageRow>();
  const sheet = opts.sheet ?? "spazay";
  // Several plan rooms can map to one BOQ room (e.g. extra bedrooms): measure them together.
  const sized = (r: BoqRoom) => rooms.filter((x) => x.boqRoom === r && x.l > 0 && x.b > 0);
  const AREA_BASES: Basis[] = ["floor_area", "ceiling_area", "wall_area", "elevation", "area"];

  // Wall paint is measured net of the panelled / wallpapered features, so it goes last.
  const isWallPaint = (it: BriefItem) => {
    const rate = it.rateId ? findRate(it.rateId) : undefined;
    return it.kind === "rate" && it.basis === "wall_area" && rate?.trade === "Paint & Polish";
  };
  const ordered = [...items.filter((i) => !isWallPaint(i)), ...items.filter(isWallPaint)];
  const primerRooms = new Set(items.filter((i) => i.rateId === PRIMER).map((i) => i.room));

  for (const it of ordered) {
    const before = lines.length;
    const group = sized(it.room);
    const room = group[0];
    const label = `${it.room}: “${it.requirement.slice(0, 60)}”`;
    const title = it.title?.trim() || undefined;

    const track = () => {
      const key = `${it.room}|${it.requirement}`;
      const row = coverage.get(key) ?? { requirement: it.requirement, room: it.room, lines: 0, codes: [], titles: [] };
      for (const l of lines.slice(before)) {
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
    const item = it.item ?? DEFAULT_ITEM[rate.trade] ?? "Civil Work";

    let qty: number | null = null;
    let dims: { l?: number; b?: number; h?: number } = {};
    let note = it.note ?? "";

    if (COUNT_UOMS.includes(rate.uom)) {
      qty = it.count && it.count > 0 ? it.count : 1;
    } else if (rate.uom === "Rft" || rate.uom === "Rmt") {
      const perimeter = group.reduce((n, g) => n + 2 * (g.l + g.b), 0);
      if (it.basis === "perimeter" && room) {
        qty = perimeter;
        dims = { l: qty };
      } else if (it.width && it.width > 0) {
        qty = it.width;
        dims = { l: it.width };
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
        }
      } else if (room) {
        if (!AREA_BASES.includes(it.basis)) {
          warnings.push(
            `${label} — “${it.basis}” doesn't fit a ${rate.uom} item; measured the floor area instead. Check it.`
          );
        }
        if (it.basis === "wall_area") {
          qty = group.reduce((n, g) => n + 2 * (g.l + g.b) * g.h * WALL_NET, 0);
          dims = { l: 2 * (room.l + room.b), h: room.h };
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

    if (qty === null || !(qty > 0)) {
      warnings.push(`${label} — no dimensions for this room on the plan; enter a width/height or add the room.`);
      track();
      continue;
    }
    const lineTitle = title ?? `${it.requirement.slice(0, 90)} — ${rate.item}`;
    const line = makeLine(it.rateId, it.room, item, r2(qty), dims, note || undefined, opts.city, sheet, lineTitle);
    if (line) {
      lines.push(line);
      // Wallpaper needs its oil-primer base coat; the designer rarely writes it out.
      if (it.rateId === WALLPAPER && !primerRooms.has(it.room)) {
        primerRooms.add(it.room);
        const pr = makeLine(
          PRIMER, it.room, "Paint", r2(qty), dims, "Prior to wallpaper installation.", opts.city, sheet,
          "Oil-primer base coat for wallpaper"
        );
        if (pr) lines.push(pr);
      }
    }
    track();
  }

  if (opts.homeCare !== false) {
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
        ["sc:SC02", "Post-renovation deep cleaning (on plan floor area).", "Post-renovation deep cleaning"],
      ];
      if (opts.floorProtection) {
        extras.unshift(["sc:SC04", "Floor protection during works (on plan floor area).", "Floor protection during works"]);
      }
      for (const [id, note, title] of extras) {
        const l = makeLine(id, home, "Cleaning / Protection", r2(floor), {}, note, opts.city, sheet, title);
        if (l) lines.push({ ...l, area: "Whole Home" });
      }
    }
  }

  const order = new Map<string, number>(BOQ_ROOMS.map((r, i) => [r, i]));
  lines.sort((a, b) => (order.get(a.room) ?? 99) - (order.get(b.room) ?? 99));
  return { lines, warnings, coverage: [...coverage.values()] };
}
