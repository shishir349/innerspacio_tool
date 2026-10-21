import type { BriefItem, PlanRoom } from "@/lib/boq/brief";
import { findRate, getRate } from "@/lib/rates/catalog";
import { SPEC_MODULAR_PARTS } from "@/lib/boq/build";
import type { PackageTier } from "@/lib/quote/constants";

/**
 * Unit classes: the closed vocabulary the plan-analysis step picks from instead of choosing among
 * ~400 rate ids. A class fixes the rate item, how it is measured and — when the designer states no
 * size — a default size computed from the room's plan dimensions. That makes the output a function
 * of (plan, requirements) rather than of the model's mood. Rates are the professional's
 * (expected_BOQ, boq_sample2); sizes are fitted to the same two jobs and are flagged as assumed.
 */

interface SizeCtx {
  /** Σ floor area (sq ft) of the plan rooms that map to this BOQ room. */
  area: number;
  /** Largest plan room mapped to this BOQ room. */
  l: number;
  b: number;
  /** Σ floor area of every plan room supplied (whole level). */
  total: number;
}
interface Size {
  width?: number;
  height?: number;
  count?: number;
  why: string;
}
export interface UnitClass {
  /** Shown to the AI. */
  label: string;
  rateId: string;
  item: string;
  basis: "elevation" | "area" | "length" | "count";
  /** Modular classes scale with the tier's carcass+shutter+hardware spec. */
  modular?: boolean;
  /** "room": at most one per room + plan area; "level": one per plan. Extra copies are dropped. */
  once?: "room" | "level";
  /** Measured off the plan by the model (no server default is better than its read): its size is honoured. */
  aiSized?: boolean;
  size: (c: SizeCtx, room: string) => Size;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
/** U-shaped kitchen run; a misread plan dimension cannot make a 70 ft kitchen. */
const run = (c: { l: number; b: number }) => Math.min(42, Math.max(18, c.l + 2 * c.b));
/** Below the villa kitchen the 9.5 ft U-run was fitted to (148 sq ft), a kitchen is an apartment L-run. */
const FLAT_KITCHEN = 140;
/** A plan-derived size with no plan room behind it: width 0, so quantify() flags the line instead of pricing a guess. */
const NO_ROOM: Size = { width: 0, why: "no plan room to size it from" };
/** A default wall / unit width never exceeds the longest wall of the room it sits in (when the room is known). */
const fit = (w: number, c: { l: number; b: number }) => (c.l > 0 ? Math.min(w, Math.max(c.l, c.b)) : w);
const flatRun = (c: { l: number; b: number }) => Math.min(30, Math.max(12, c.l + c.b));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const wall = (sqft: number, h: number, why: string): Size => ({ width: r1(sqft / h), height: h, why });

export const UNIT_CLASSES: Record<string, UnitClass> = {
  wardrobe: {
    label: "full-height wardrobe incl. a walk-in dress (ONE per bedroom)", rateId: "pr:WARDROBE", item: "Wardrobe", basis: "elevation", modular: true, once: "room",
    size: (c) => (c.area > 0 ? wall(clamp(0.31 * c.area, 60, 220), 9, "0.31 x room floor area, 9 ft high") : NO_ROOM),
  },
  lobby_wardrobe: {
    label: "storage wardrobe in a lobby / passage", rateId: "pr:LOBBYWARD", item: "Wardrobe", basis: "elevation", modular: true,
    size: () => ({ width: 10, height: 10, why: "10 ft x 10 ft storage wall" }),
  },
  tv_unit: {
    label: "TV unit", rateId: "pr:TVUNIT", item: "TV Unit", basis: "elevation", modular: true,
    size: (c, room) => (room === "Dining" || room === "Living" ? { width: fit(9, c), height: 8, why: "9 x 8 ft TV wall in a living / dining space (within the room's longest wall)" } : { width: fit(6, c), height: 7, why: "6 x 7 ft (within the room's longest wall)" }),
  },
  study_unit: {
    label: "study / home-office storage unit or work desk", rateId: "pr:STUDY", item: "Study Table/Desk", basis: "elevation", modular: true,
    size: (c, room) => (room === "Study / Office" ? { width: r1(Math.min(12, Math.max(c.l, c.b))), height: 9, why: "one 9 ft high wall of the study" } : { width: 4, height: 9, why: "4 x 9 ft work unit" }),
  },
  kids_study: {
    label: "kids study unit for two, with storage", rateId: "pr:KIDSSTUDY", item: "Study Table/Desk", basis: "elevation", modular: true,
    size: (c) => ({ width: fit(6, c), height: 8, why: "6 x 8 ft (within the room's longest wall)" }),
  },
  dresser: {
    label: "dresser / dressing unit (mirror is separate)", rateId: "pr:KIDSSTUDY", item: "Console/Chest Of Drawers", basis: "elevation", modular: true,
    size: (c) => (c.area > 280 ? { width: 5, height: 4, why: "5 x 4 ft in a large bedroom" } : { width: 4, height: 3, why: "4 x 3 ft" }),
  },
  reading_nook: {
    label: "reading nook / window seat with built-in seating and shelves", rateId: "pr:NOOK", item: "Study Table/Desk", basis: "elevation", modular: true,
    size: () => ({ width: 5, height: 10, why: "5 x 10 ft nook" }),
  },
  kitchen_cabinetry: {
    label: "whole modular kitchen (base + wall + tall + island) — ONE line", rateId: "pr:KITCHEN", item: "Kitchen Base Unit", basis: "elevation", modular: true, once: "room",
    size: (c) =>
      !(c.area > 0)
        ? NO_ROOM
        : c.area < FLAT_KITCHEN
        ? { width: r1(flatRun(c)), height: 8, why: "apartment L-run (L + B, 12-30 ft) x 8 ft of base, wall and tall units, no island" }
        : { width: r1(run(c)), height: 9.5, why: "U-run (L + 2B, within 18-42 ft) x 9.5 ft of base, wall and tall units" },
  },
  crockery_unit: {
    label: "crockery unit", rateId: "pr:CROCKERY", item: "Crockery Unit", basis: "elevation", modular: true,
    size: (c) => ({ width: fit(5, c), height: 8, why: "5 x 8 ft (within the room's longest wall)" }),
  },
  utility_counter: {
    label: "utility / laundry counter with storage below", rateId: "pr:UTILITY", item: "Study Table/Desk", basis: "elevation", modular: true,
    size: (c) => ({ width: fit(8, c), height: 6, why: "8 x 6 ft counter run with storage (within the room's longest wall)" }),
  },
  book_shelf: {
    label: "metal-rod floating bookshelf (running ft)", rateId: "pr:BOOKSHELF", item: "Study Table/Desk", basis: "length",
    size: () => ({ width: 80, why: "80 rft of floating shelves on the opposite wall" }),
  },
  floating_shelf: {
    label: "laminate floating shelves, 12 in deep (running ft): boot room, utility, study", rateId: "mod:FS02", item: "Study Table/Desk", basis: "length",
    size: (_c, room) => (room === "Foyer / Entryway" ? { width: 200, why: "200 rft boot-room storage shelving" } : room === "Utility" ? { width: 100, why: "100 rft above the counter" } : { width: 40, why: "40 rft of shelving" }),
  },
  quartz_counter: {
    label: "quartz countertop incl. backsplash (kitchen or utility)", rateId: "pr:QUARTZ", item: "Countertop", basis: "area", once: "room",
    size: (c, room) =>
      room === "Utility"
        ? { width: 25, height: 1, why: "25 sq ft utility counter" }
        : !(c.area > 0)
          ? NO_ROOM
          : c.area < FLAT_KITCHEN
          ? { width: r1(flatRun(c) * 4), height: 1, why: "apartment L-run x 4 ft (top + backsplash), no island" }
          : { width: r1(run(c) * 4.5 + 24), height: 1, why: "U-run x 4.5 ft (top + backsplash) + 24 sq ft island" },
  },
  vanity: {
    label: "bathroom vanity unit with counter (1 per bathroom)", rateId: "pr:VANITY", item: "Bathroom Vanity", basis: "count", once: "room",
    size: () => ({ count: 1, why: "one vanity" }),
  },
  vanity_mirror: {
    label: "bathroom vanity mirror", rateId: "pr:VMIRROR", item: "Mirror / Glass", basis: "elevation",
    size: (_c, room) => (room === "Master Bathroom" ? { width: 6, height: 4, why: "6 x 4 ft master vanity mirror" } : { width: 4, height: 3, why: "4 x 3 ft" }),
  },
  shower_partition: {
    label: "glass shower partition", rateId: "pr:SHOWER", item: "Mirror / Glass", basis: "elevation",
    size: (_c, room) => (room === "Master Bathroom" ? { width: 5, height: 10, why: "5 x 10 ft master shower" } : { width: 4, height: 8, why: "4 x 8 ft shower" }),
  },
  mirror_wall: {
    label: "feature / full-length wall mirror", rateId: "pr:MIRROR", item: "Mirror / Glass", basis: "elevation",
    size: () => ({ width: 8, height: 8, why: "8 x 8 ft mirror wall" }),
  },
  dresser_mirror: {
    label: "mirror over a dresser", rateId: "pr:DMIRROR", item: "Mirror / Glass", basis: "elevation",
    size: () => ({ width: 5, height: 3, why: "5 x 3 ft" }),
  },
  feature_wall: {
    label: "feature wall: laminate / WPC louver / panel / inlays / LED", rateId: "pr:FEATURE", item: "Wall Panelling", basis: "elevation",
    size: (c) => (c.area > 350 ? { width: fit(10, c), height: 10, why: "10 x 10 ft wall in a large room" } : { width: fit(8, c), height: 9, why: "8 x 9 ft wall (within the room's longest wall)" }),
  },
  french_moulding_wall: {
    label: "bedroom wall with French moulding (POP) and wallpaper", rateId: "pr:FRENCH", item: "Wall Panelling", basis: "elevation",
    size: (c) => (c.l > 0 ? { width: r1(0.75 * (c.l + c.b)), height: 10, why: "0.75 x (L + B) of wall, 10 ft high" } : NO_ROOM),
  },
  wainscot_wall: {
    label: "wall wainscoting with wallpaper and wall lights (running ft)", rateId: "pr:WAINSCOT", item: "Wall Panelling", basis: "length",
    size: (c) => (c.l > 0 ? { width: r1(Math.max(c.l, c.b) * 2), why: "two long walls" } : NO_ROOM),
  },
  foyer_panelling: {
    label: "entrance / foyer wall panelling (WPC louver / laminate)", rateId: "pr:FOYERPANEL", item: "Wall Panelling", basis: "elevation",
    size: (c) => ({ width: fit(10, c), height: 10, why: "10 x 10 ft wall (within the room's longest wall)" }),
  },
  pvc_ceiling: {
    label: "PVC ceiling (facade, balcony)", rateId: "pr:PVCCEIL", item: "False Ceiling", basis: "area", aiSized: true,
    size: (c) => ({ width: r1(c.area), height: 1, why: "plan floor area" }),
  },
  window_upvc: {
    label: "uPVC 3-track sliding window with mesh", rateId: "win:UP03", item: "Window / Grill", basis: "elevation", aiSized: true,
    size: () => ({ width: 5, height: 4, why: "5 x 4 ft window" }),
  },
  glass_railing: {
    label: "toughened-glass railing: balcony, stairs, terrace (running ft)", rateId: "al:RAILING", item: "Window / Grill", basis: "length", aiSized: true,
    size: (c) => ({ width: r1(Math.max(c.l, c.b) + 10), why: "one balcony / stair run" }),
  },
  fresh_paint: {
    label: "whole-level fresh paint, luxury emulsion (ONE per level)", rateId: "pr:PAINT", item: "Paint", basis: "area", once: "level",
    size: (c) => ({ width: r1(c.total * 2.45), height: 1, why: "2.45 x floor area of the level (walls + ceilings)" }),
  },
  deep_clean: {
    label: "whole-level standard deep cleaning (ONE per level)", rateId: "sc:SC01", item: "Cleaning / Protection", basis: "area", once: "level",
    size: (c) => ({ width: r1(c.total), height: 1, why: "floor area of the level" }),
  },
  jacuzzi: {
    label: "jacuzzi provision (civil, plumbing, electrical, tiling)", rateId: "al:JACUZZI", item: "Civil Work", basis: "count", once: "level",
    size: () => ({ count: 1, why: "one provision" }),
  },
};

export const UNIT_IDS = Object.keys(UNIT_CLASSES);

/** "id: label" lines for the AI prompt. */
export function unitClassText(): string {
  return UNIT_IDS.map((id) => `- ${id}: ${UNIT_CLASSES[id].label}`).join("\n");
}

/** Sum of a tier's all-in modular parts (carcass + shutter + hardware) at the card rates. */
const specSum = (tier: PackageTier) => SPEC_MODULAR_PARTS[tier].reduce((n, id) => n + getRate(id).rate, 0);
export { SPEC_MODULAR_PARTS };
/** Modular rate scale vs premium, derived from the tier spec table in build.ts (no rupee figures live here). */
export const tierScale = (tier: PackageTier) => specSum(tier) / specSum("premium");

/** The "1" / "2" of "Kids Bedroom-1", "bedroom 2" … or "" when there is none. */
export function ordinalOf(text: string): string {
  return text.match(/(?:bed ?room|room|kids?)[ -]*(\d)/i)?.[1] ?? "";
}

export interface ResolvedUnit {
  item: BriefItem;
  /** Rate multiplier for modular classes at non-premium tiers. */
  scale: number;
}

/**
 * Turn `unit: "<class>"` into a concrete rate item. A size the designer / model stated wins;
 * otherwise the class default is computed from the plan rooms and recorded in the note.
 */
/** A whole-home paint line the model priced by hand is the fresh-paint class (one rate, one rule). */
export function normalizeUnit(it: BriefItem): BriefItem {
  const paint = it.rateId ? findRate(it.rateId) : undefined;
  return !it.unit && it.room === "Others / Whole Home Civil" && paint?.trade === "Paint & Polish" && paint.uom === "Sq.Ft."
    ? { ...it, unit: "fresh_paint", rateId: undefined }
    : it;
}

export function resolveUnit(rawItem: BriefItem, rooms: PlanRoom[], tier: PackageTier): ResolvedUnit {
  const it = normalizeUnit(rawItem);
  const cls = it.unit ? UNIT_CLASSES[it.unit] : undefined;
  if (!cls) return { item: rawItem, scale: 1 };
  // The model's own rate id is measured differently from the class's (a Rft trim tagged feature_wall):
  // the class would reprice it per sq ft. Keep the model's item as a plain rate line.
  const given = it.rateId ? findRate(it.rateId) : undefined;
  if (given && given.uom !== findRate(cls.rateId)?.uom) return { item: { ...it, unit: undefined }, scale: 1 };

  let mine = rooms.filter((r) => r.boqRoom === it.room && r.l > 0 && r.b > 0);
  // A PVC ceiling is a balcony / facade item: it sizes from its own balcony, or (filed under whole-home) from the plan's
  // balconies. Filed under any other room it must NOT borrow that room's floor area, so it gets no default size.
  if (it.unit === "pvc_ceiling") {
    const facade = it.room.startsWith("Balcony") || it.room === "Others / Whole Home Civil";
    mine = !facade ? [] : mine.length ? mine : rooms.filter((r) => r.boqRoom.startsWith("Balcony") && r.l > 0 && r.b > 0);
  }
  // "Kids Bedroom-2": size from that bedroom (and its dress), not from every Kids Room on the plan.
  const nth = ordinalOf(`${it.area ?? ""} ${it.title ?? ""} ${it.requirement}`);
  if (nth) {
    const own = mine.filter((r) => ordinalOf(r.name) === nth);
    if (own.length) mine = own;
  }
  const biggest = [...mine].sort((a, b) => b.l * b.b - a.l * a.b)[0];
  const seen = new Set<string>();
  const total = rooms.reduce((n, r) => (r.l > 0 && r.b > 0 && !seen.has(r.id) && seen.add(r.id) ? n + r.l * r.b : n), 0);
  const ctx: SizeCtx = {
    area: mine.reduce((n, r) => n + r.l * r.b, 0),
    l: biggest?.l ?? 0,
    b: biggest?.b ?? 0,
    total,
  };

  let rateId = cls.rateId;
  if (it.unit === "vanity" && it.room === "Master Bathroom") rateId = "pr:VANITYM";
  if (it.unit === "vanity_mirror" && it.room === "Master Bathroom") rateId = "pr:VMIRRORM";

  // A size is "stated" only when the designer wrote one (a number with a unit in their words) or the
  // class is measured off the plan. Any other width/height the model volunteers is its guess and is
  // replaced by the class default: that is what makes two runs on one brief agree.
  const written = /\d\s*(?:ft|feet|foot|sq|sft|rft|'|"|x|×)/i.test(it.requirement);
  const honour = cls.aiSized || written || it.sizeBy === "designer";
  const stated = honour && ((it.width ?? 0) > 0 || (it.count ?? 0) > 0);
  let width = it.width;
  let height = it.height;
  let count = it.count;
  let note = it.note;
  if (!stated) {
    // No plan room behind a plan-derived size gives width 0, which quantify() flags instead of pricing.
    const s = cls.size(ctx, it.room);
    width = s.width;
    height = s.height;
    count = s.count;
    note = `${note ? `${note} ` : ""}Assumed size (${s.why}) — confirm on site.`;
  }
  return {
    item: { ...it, kind: "rate", rateId, item: cls.item as BriefItem["item"], basis: cls.basis, width, height, count, note },
    scale: cls.modular ? tierScale(tier) : 1,
  };
}
