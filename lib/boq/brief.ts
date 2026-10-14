import { z } from "zod";
import { makeLine, modularLines, type BoqLine } from "@/lib/boq/build";
import { BOQ_ITEMS, BOQ_ROOMS, type BoqRoom } from "@/lib/boq/lists";
import { findRate } from "@/lib/rates/catalog";
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
  /** Add whole-home protection + cleaning on the plan's floor area (default true). */
  homeCare?: boolean;
}

export function quantify(
  items: BriefItem[],
  rooms: PlanRoom[],
  opts: QuantifyOptions
): { lines: BoqLine[]; warnings: string[] } {
  const lines: BoqLine[] = [];
  const warnings: string[] = [];
  // Several plan rooms can map to one BOQ room (e.g. extra bedrooms): measure them together.
  const sized = (r: BoqRoom) => rooms.filter((x) => x.boqRoom === r && x.l > 0 && x.b > 0);
  const AREA_BASES: Basis[] = ["floor_area", "ceiling_area", "wall_area", "elevation", "area"];

  for (const it of items) {
    const group = sized(it.room);
    const room = group[0];
    const label = `${it.room}: “${it.requirement.slice(0, 60)}”`;
    const note = it.note ? `${it.requirement} — ${it.note}` : it.requirement;

    if (it.kind === "modular") {
      const w = it.width ?? 0;
      const h = it.height ?? 7;
      if (!(w > 0)) {
        warnings.push(`${label} — modular unit has no width; add a measurement.`);
        continue;
      }
      lines.push(...modularLines(opts.tier, opts.city, it.room, it.item ?? "Wardrobe", w, h, note));
      continue;
    }

    const rate = it.rateId ? findRate(it.rateId) : undefined;
    if (!rate || !it.rateId) {
      warnings.push(`${label} — unknown rate item “${it.rateId ?? "none"}”, skipped.`);
      continue;
    }
    const item = it.item ?? DEFAULT_ITEM[rate.trade] ?? "Civil Work";

    let qty: number | null = null;
    let dims: { l?: number; b?: number; h?: number } = {};

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
        } else {
          qty = group.reduce((n, g) => n + g.l * g.b, 0);
          dims = group.length === 1 ? { l: room.l, b: room.b } : {};
        }
      }
    }

    if (qty === null || !(qty > 0)) {
      warnings.push(`${label} — no dimensions for this room on the plan; enter a width/height or add the room.`);
      continue;
    }
    const line = makeLine(it.rateId, it.room, item, r2(qty), dims, note, opts.city);
    if (line) lines.push(line);
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
      for (const [id, note] of [
        ["sc:SC04", "Floor protection during works (on plan floor area)"],
        ["sc:SC02", "Post-renovation deep cleaning (on plan floor area)"],
      ] as const) {
        const l = makeLine(id, home, "Cleaning / Protection", r2(floor), {}, note, opts.city);
        if (l) lines.push(l);
      }
    }
  }

  const order = new Map<string, number>(BOQ_ROOMS.map((r, i) => [r, i]));
  lines.sort((a, b) => (order.get(a.room) ?? 99) - (order.get(b.room) ?? 99));
  return { lines, warnings };
}
