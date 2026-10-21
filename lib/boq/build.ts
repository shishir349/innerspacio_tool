import { findRate, getRate } from "@/lib/rates/catalog";
import { CEILING_H, FURNITURE as F, ROOM_STANDARDS, SECONDARY_BEDROOM, WALL_NET, carpetArea, roomScale } from "@/lib/boq/standards";
import { livspaceModular, resolveRate, type RateSheet, type RateSource } from "@/lib/rates/sheets";
import { BOQ_ROOMS, type BoqRoom } from "@/lib/boq/lists";
import {
  BHK_ROOM_DEFAULTS,
  PACKAGE_BANDS,
  type Bhk,
  type HomeSize,
  type PackageTier,
  type QuoteRoomType,
} from "@/lib/quote/constants";

/**
 * Scope → BOQ lines. One engine feeds both the public estimate (sum of lines) and the
 * designer BOQ (editable lines → .xlsx). Pure: no I/O, no server imports.
 *
 * Everything under "ASSUMPTIONS" is a placeholder for your estimators to overwrite;
 * tests pin the tier bands, not these numbers.
 */

export interface BoqInput {
  bhk: Bhk;
  homeSize?: HomeSize;
  city: string;
  tier: PackageTier;
  /** One entry per room instance, in the order the customer added them. */
  rooms: { roomType: QuoteRoomType }[];
  /** Rate sheet that prices the BOQ (default Spazay). */
  sheet?: RateSheet;
}

export { carpetArea };

/** Where a quantity comes from: read off a plan, written by the user, or a standard assumption. */
export type QtySource = "measured" | "entered" | "estimated";
/** What the designer's scope says about an item. Only NEW / REPLACE / REFURBISH (with a rate) produce a priced line. */
export const SCOPE_STATUSES = ["NEW", "REPLACE", "RETAIN", "REFURBISH", "EXCLUDED", "UNCONFIRMED"] as const;
export type ScopeStatus = (typeof SCOPE_STATUSES)[number];

export interface BoqLine {
  room: BoqRoom;
  trade: string;
  /** Standard BOQ item label (BOQ_ITEMS). */
  item: string;
  /** Specific line title shown in the "Line / BOQ Item" column (falls back to `item`). */
  title?: string;
  code: string;
  rateId: string;
  description: string;
  /** Estimator note / assumption for this line (kept apart from the standard description). */
  remarks?: string;
  /** Area label from the client's plan (e.g. "Kids Bedroom-2", "Boot Room"); falls back to the room. */
  area?: string;
  uom: string;
  l?: number;
  b?: number;
  h?: number;
  qty: number;
  rate: number;
  amount: number;
  /** Which sheet priced this line. */
  rateSource: RateSource;
  /** Livspace reference rate (sheet = "both", where a verified equivalent exists). */
  altRate?: number;
  /** No rate in the sheet — a placeholder allowance to confirm before issue. */
  provisional?: boolean;
  /** Provenance of `qty`. Spec-mode lines are always "estimated"; the user editing a quantity makes it "entered". */
  qtySource?: QtySource;
  /** A rate that needs a human look (e.g. no verified Livspace equivalent, billed at the Spazay rate). */
  rateNote?: string;
  /** The scope status of the item this line prices (default NEW). */
  scopeStatus?: ScopeStatus;
  /** Added by the engine rather than by a scope item (deep clean, wallpaper primer). */
  autoAdded?: boolean;
}

// ---------- ASSUMPTIONS ----------

/** Which reference-sheet room each instance of a type becomes (index = nth of that type). */
const ROOM_MAP: Record<QuoteRoomType, BoqRoom[]> = {
  living_room: ["Living", "TV Lounge/Study"],
  kitchen: ["Kitchen", "Utility"],
  bedroom: ["Master Bedroom", "Kids Room", "Guest / Parents Bedroom", "Bedroom - 4", "Bedroom - 5"],
  bathroom: ["Master Bathroom", "Kids Bathroom", "Guest / Parents Bathroom", "Bathroom - 4", "Bathroom - 5"],
  dining_room: ["Dining"],
  other: ["Foyer / Entryway", "Balcony 1"],
};

/**
 * City rate policy. The Spazay card is an NCR selling-rate list. No verified policy exists for any
 * other city, so no factor is applied (1.0) and `cityNote()` says so. To adopt a policy, add the
 * confirmed multiplier here, e.g. `Mumbai: 1.05`; it then applies to the rate on every line.
 */
export const CITY_RATE_FACTORS: Readonly<Record<string, number>> = {};
const NCR = ["Delhi", "Gurugram", "Noida"];
export function cityFactor(city: string): number {
  return CITY_RATE_FACTORS[city] ?? 1;
}
/** A warning when the city is outside the card's NCR basis and no policy is configured. */
export function cityNote(city: string): string | null {
  if (!city || NCR.includes(city) || CITY_RATE_FACTORS[city] !== undefined) return null;
  return `Rates are the Spazay NCR card. No verified rate adjustment is configured for ${city}, so none is applied.`;
}

interface Spec {
  carcass: string;
  shutter: string;
  hardware: string;
  panel: string;
  ceiling: string;
  paint: string;
  stone: string;
  stoneFab: string;
  backsplash: "tile" | "stone";
  sinkCut: string;
  bathPackage: string;
  partition: string;
  mirror: string;
  lf: "LFB" | "LFE" | "LFL";
  decor: string | null;
  kitchenExtras: string[];
  floor: { living: string | null; bed: string | null };
  skirt: { living: string | null; bed: string | null };
  ledProfile: boolean;
  loft: boolean;
  curtain: string;
}

const SPEC: Record<PackageTier, Spec> = {
  essential: {
    carcass: "mod:C01",
    shutter: "mod:S01",
    hardware: "mod:H01",
    panel: "wp:WP01",
    ceiling: "fc:FC01",
    paint: "ps:F01", // Asian Apcolite Premium Emulsion
    stone: "st:ST02",
    stoneFab: "cv:CV07",
    backsplash: "tile",
    sinkCut: "cv:CV17",
    bathPackage: "bth:BTH01",
    partition: "mg:MG12",
    mirror: "mg:MG01",
    lf: "LFB",
    decor: null,
    kitchenExtras: ["mod:K01"],
    floor: { living: null, bed: null },
    skirt: { living: null, bed: null },
    ledProfile: false,
    loft: false,
    curtain: "fu:BF02",
  },
  premium: {
    carcass: "mod:C06",
    shutter: "mod:S04",
    hardware: "mod:H02",
    panel: "wp:WP09",
    ceiling: "fc:FC02",
    paint: "ps:F06", // Asian Royale Luxury Emulsion
    stone: "st:ST08",
    stoneFab: "cv:CV09",
    backsplash: "stone",
    sinkCut: "cv:CV17",
    bathPackage: "bth:BTH01",
    partition: "mg:MG13",
    mirror: "mg:MG04",
    lf: "LFE",
    decor: "fu:BF14",
    kitchenExtras: ["mod:K01", "mod:K09", "mod:K14"],
    floor: { living: "fl:FL13", bed: "fl:FL04" },
    skirt: { living: "fl:SK13", bed: "fl:SK03" },
    ledProfile: false,
    loft: true,
    curtain: "fu:BF03",
  },
  luxury: {
    carcass: "mod:C09",
    shutter: "mod:S05",
    hardware: "mod:H02",
    panel: "wp:WP23",
    ceiling: "fc:FC03",
    paint: "ps:F05", // Asian Royale Lustre
    stone: "st:ST09",
    stoneFab: "cv:CV09",
    backsplash: "stone",
    sinkCut: "cv:CV18",
    bathPackage: "bth:BTH02",
    partition: "mg:MG14",
    mirror: "mg:MG04",
    lf: "LFL",
    decor: "fu:BF15",
    kitchenExtras: ["mod:K01", "mod:K03", "mod:K09", "mod:K13", "mod:K14", "mod:K15"],
    floor: { living: "fl:FL10", bed: "fl:FL06" },
    skirt: { living: "fl:SK10", bed: "fl:SK06" },
    ledProfile: true,
    loft: true,
    curtain: "fu:BF03",
  },
};

/** The three card rates that make up an all-in modular unit, per tier — the single source of tier spec for modular work. */
export const SPEC_MODULAR_PARTS: Record<PackageTier, [string, string, string]> = {
  essential: [SPEC.essential.carcass, SPEC.essential.shutter, SPEC.essential.hardware],
  premium: [SPEC.premium.carcass, SPEC.premium.shutter, SPEC.premium.hardware],
  luxury: [SPEC.luxury.carcass, SPEC.luxury.shutter, SPEC.luxury.hardware],
};

// ---------- builder ----------

const r2 = (n: number) => Math.round(n * 100) / 100;
const half = (n: number) => Math.round(n * 2) / 2;

interface Ctx {
  tier: PackageTier;
  spec: Spec;
  factor: number;
  out: BoqLine[];
  scale: number;
  sheet: RateSheet;
  /** Provenance stamped on every line this context builds. */
  qtySource: QtySource;
}

/** Minimum billable amount per rate id: a small job is a lump sum, not qty × a tiny rate. */
const MIN_AMOUNT: Record<string, number> = {
  "cv:CV22": 2500, // dismantling a unit: site mobilisation minimum
};

interface Dims {
  l?: number;
  b?: number;
  h?: number;
}

function push(
  ctx: Ctx,
  room: BoqRoom,
  rateId: string,
  item: string,
  qty: number,
  dims: Dims = {},
  note?: string,
  title?: string
) {
  if (!(qty > 0) || !Number.isFinite(qty)) return;
  const r = getRate(rateId);
  const res = resolveRate(rateId, r.rate, ctx.sheet);
  const rateNote = res.unmapped ? "No verified Livspace rate for this item; billed at the Spazay card rate. Review." : undefined;
  const rate = Math.round(res.rate * ctx.factor);
  const base = r.desc || r.item;
  let q = r2(qty);
  let uom = r.uom;
  let lump = "";
  const min = MIN_AMOUNT[rateId];
  if (min && q * rate < min) {
    q = 1;
    uom = "L.S.";
    lump = " Lump-sum minimum allowance; measured and settled on actuals.";
  }
  const unit = uom === "L.S." && lump ? min : rate;
  ctx.out.push({
    room,
    trade: r.trade,
    item,
    ...(title ? { title } : {}),
    code: r.code,
    rateId,
    description: `${base}${lump}`,
    ...(note ? { remarks: note } : {}),
    uom,
    ...(lump ? {} : dims),
    qty: q,
    rate: unit,
    amount: r2(q * unit),
    rateSource: res.source,
    ...(res.alt !== undefined ? { altRate: Math.round(res.alt * ctx.factor) } : {}),
    ...(r.provisional ? { provisional: true } : {}),
    ...(rateNote ? { rateNote } : {}),
    qtySource: ctx.qtySource,
  });
}

/** Carcass + shutter + hardware for `w × h` ft of cabinet elevation (Spazay prices them separately). */
function modular(ctx: Ctx, room: BoqRoom, item: string, w: number, h: number, note: string) {
  const area = w * h;
  const dims = { l: w, h };
  const ls = livspaceModular(item);
  if (ctx.sheet === "livspace" && ls) {
    // Livspace prices a unit as one all-in standard rate, not carcass + shutter + hardware.
    const m = ls;
    const rate = Math.round(m.rate * ctx.factor);
    const q = r2(area);
    ctx.out.push({
      room,
      trade: "Modular Woodwork",
      item,
      code: "LS-MOD",
      rateId: `ls:modular:${item}`,
      description: `${m.label} — carcass, shutter and standard hardware complete; measured on finished cabinet elevation area.`,
      ...(note ? { remarks: note } : {}),
      uom: "Sq.Ft.",
      ...dims,
      qty: q,
      rate,
      amount: r2(q * rate),
      rateSource: "livspace",
      qtySource: ctx.qtySource,
    });
    return;
  }
  // Spazay's professional BOQ prices a unit as ONE all-in line (carcass + shutter + hardware).
  const parts = [ctx.spec.carcass, ctx.spec.shutter, ctx.spec.hardware].map((id) => getRate(id));
  const rate = parts.reduce((n, p) => n + Math.round(p.rate * ctx.factor), 0);
  const q = r2(area);
  const alt = ctx.sheet === "both" && ls ? Math.round(ls.rate * ctx.factor) : undefined;
  const rateNote =
    ctx.sheet === "livspace" && !ls ? "No verified Livspace rate for this unit; billed at the Spazay card rate. Review." : undefined;
  ctx.out.push({
    room,
    trade: "Modular Woodwork",
    item,
    code: parts.map((p) => p.code).join("+"),
    rateId: MODULAR_ALLIN,
    description:
      `Modular ${item.toLowerCase()} with ${parts[0].item} carcass, ${parts[1].item} shutters/fronts and ${parts[2].item}, ` +
      "including standard internal shelves, drawers and hanging provision as per approved design. " +
      "Measured on finished cabinet elevation area; visible sides, extra depth and add-ons are separate.",
    ...(note ? { remarks: note } : {}),
    uom: "Sq.Ft.",
    ...dims,
    qty: q,
    rate,
    amount: r2(q * rate),
    rateSource: "spazay",
    ...(alt ? { altRate: alt } : {}),
    ...(rateNote ? { rateNote } : {}),
    qtySource: ctx.qtySource,
  });
}

/** Synthetic rate id of an all-in modular line (not a rate-card row). */
export const MODULAR_ALLIN = "mod:unit";

function envelope(ctx: Ctx, room: BoqRoom, L: number, B: number, opts: { paintWalls?: number; wet?: boolean } = {}) {
  const floor = L * B;
  const wall = 2 * (L + B) * CEILING_H * WALL_NET;
  const { spec } = ctx;
  if (!opts.wet) {
    push(ctx, room, spec.ceiling, "False Ceiling", floor, { l: L, b: B }, "Gypsum false ceiling");
    push(ctx, room, "el:EL04", "Electrical Point", floor, { l: L, b: B }, "False-ceiling wiring and conduit");
    push(ctx, room, spec.paint, "Paint", wall * (opts.paintWalls ?? 1), opts.paintWalls ? {} : { l: 2 * (L + B), h: CEILING_H }, "Wall paint, 2 coats over primer");
    push(ctx, room, CEILING_PAINT, "Paint", floor, { l: L, b: B }, "Ceiling paint");
    push(ctx, room, "el:EL30", "Electrical Point", Math.max(2, Math.round(floor / 25)), {}, "Light points");
    push(ctx, room, "el:EL13", "Electrical Point", floor > 150 ? 2 : 1, {}, "Switch / socket boards");
  }
}

function livingRoom(ctx: Ctx, room: BoqRoom, L: number, B: number) {
  const { spec } = ctx;
  envelope(ctx, room, L, B);
  modular(ctx, room, "TV Unit", F.tvBase.w, F.tvBase.h, `TV base unit, ${F.tvBase.w} ft × ${F.tvBase.h} ft`);
  modular(ctx, room, "TV Unit", F.tvFloat.w, F.tvFloat.h, `TV floating wall unit, ${F.tvFloat.w} ft × ${F.tvFloat.h} ft`);
  push(ctx, room, spec.panel, "Wall Panelling", F.tvPanel.w * F.tvPanel.h, { l: F.tvPanel.w, h: F.tvPanel.h }, `TV wall panelling, ${F.tvPanel.w} ft × ${F.tvPanel.h} ft`);
  push(ctx, room, "el:EL11", "Electrical Point", 1, {}, "TV + data point");
  push(ctx, room, "el:EL35", "Electrical Point", 1, {}, "32A AC point");
  if (spec.floor.living) {
    push(ctx, room, spec.floor.living, "Floor Tiling", L * B, { l: L, b: B }, "Flooring");
    if (spec.skirt.living) push(ctx, room, spec.skirt.living, "Floor Tiling", 2 * (L + B), {}, "Skirting");
  }
  if (spec.ledProfile) push(ctx, room, "el:EL08", "Decorative Lighting", L * B, { l: L, b: B }, "LED profile lighting allowance");
  push(ctx, room, spec.curtain, "Curtain Channels/Rods", B, { l: B }, "Curtain channel along window wall");
  push(ctx, room, `lf:${spec.lf}01`, "Sofa", 1, {}, "3-seater sofa");
  push(ctx, room, `lf:${spec.lf}03`, "Coffee Table", 1, {}, "Coffee table");
  push(ctx, room, `lf:${spec.lf}04`, "End/Side Table", 1, {}, "Side table");
  if (ctx.tier !== "essential") push(ctx, room, `lf:${spec.lf}02`, "Loose Furniture - Other", 1, {}, "Accent chair");
}

function diningRoom(ctx: Ctx, room: BoqRoom, L: number, B: number) {
  const { spec } = ctx;
  envelope(ctx, room, L, B);
  modular(ctx, room, "Crockery Unit", F.crockery.w, F.crockery.h, `Crockery unit, ${F.crockery.w} ft × ${F.crockery.h} ft`);
  if (spec.floor.living) push(ctx, room, spec.floor.living, "Floor Tiling", L * B, { l: L, b: B }, "Flooring");
  push(ctx, room, `lf:${spec.lf}${ctx.tier === "luxury" ? "06" : "05"}`, "Dining Table With Chairs", 1, {}, "Dining table with chairs");
}

function kitchen(ctx: Ctx, room: BoqRoom, L: number, B: number) {
  const { spec } = ctx;
  const run = Math.max(8, L + B - 3); // L-shaped run, ft
  const top = run * F.counterDepth;
  envelope(ctx, room, L, B, { paintWalls: 0.4 });
  modular(ctx, room, "Kitchen Base Unit", run, F.kitchenUnitH, `Base units, ${r2(run)} ft run`);
  modular(ctx, room, "Kitchen Wall Unit", r2(run * F.kitchenWallRun), F.kitchenUnitH, `Wall units, ${r2(run * F.kitchenWallRun)} ft run`);
  modular(ctx, room, "Kitchen Tall Unit", F.kitchenTall.w, F.kitchenTall.h, `Tall pantry unit, ${F.kitchenTall.w} ft × ${F.kitchenTall.h} ft`);
  push(ctx, room, spec.stone, "Countertop - Supply", top, { l: run, b: F.counterDepth }, "Countertop slab supply");
  push(ctx, room, spec.stoneFab, "Countertop", top, { l: run, b: F.counterDepth }, "Countertop fabrication and installation");
  if (spec.backsplash === "stone") {
    push(ctx, room, spec.stone, "Countertop - Supply", top, { l: run, h: 2 }, "Backsplash slab supply");
    push(ctx, room, "cv:CV15", "Backsplash", top, { l: run, h: 2 }, "Backsplash fabrication and installation");
  } else {
    push(ctx, room, "cv:CV05", "Backsplash", top, { l: run, h: 2 }, "Backsplash tiling");
  }
  push(ctx, room, "cv:CV16", "Countertop", 1, {}, "Hob cut-out");
  push(ctx, room, spec.sinkCut, "Sink & Faucet", 1, {}, "Sink cut-out");
  for (const id of spec.kitchenExtras) push(ctx, room, id, "Kitchen Cabinetry (Top & Bottom)", 1, {}, getRate(id).item);
  push(ctx, room, "cv:CV25", "Plumbing Point", 2, {}, "Sink and appliance plumbing points");
  push(ctx, room, "cv:WP03", "Civil Work", L * B, { l: L, b: B }, "Kitchen wet-area waterproofing");
  push(ctx, room, "el:EL03", "Electrical Point", 3, {}, "Hob, fridge, microwave points");
  push(ctx, room, "el:EL35", "Electrical Point", 1, {}, "32A point");
  push(ctx, room, "el:EL09", "Electrical Point", 1, {}, "Exhaust-fan point");
  if (ctx.tier !== "essential") push(ctx, room, "cv:CV04", "Floor Tiling", L * B, { l: L, b: B }, "Floor tiling");
}

function bedroom(ctx: Ctx, room: BoqRoom, L: number, B: number, index: number) {
  const { spec } = ctx;
  envelope(ctx, room, L, B);
  const std = index === 0 ? F.wardrobeMaster : F.wardrobeOther;
  const w = Math.min(std.w, half(F.wardrobeMaxShare * Math.max(L, B)));
  modular(ctx, room, "Wardrobe", w, std.h, `Wardrobe, ${w} ft × ${std.h} ft`);
  if (spec.loft) modular(ctx, room, "Wardrobe", w, F.loftH, `Wardrobe loft, ${w} ft × ${F.loftH} ft`);
  push(ctx, room, spec.panel, "Bed Back Panel", F.bedPanel.w * F.bedPanel.h, { l: F.bedPanel.w, h: F.bedPanel.h }, `Bed back panel, ${F.bedPanel.w} ft × ${F.bedPanel.h} ft`);
  if (index === 0 && ctx.tier !== "essential") modular(ctx, room, "Console/Chest Of Drawers", F.dresser.w, F.dresser.h, `Dresser unit, ${F.dresser.w} ft × ${F.dresser.h} ft`);
  if (index === 1) {
    push(ctx, room, `lf:${spec.lf}11`, "Study Table/Desk", 1, {}, "Study desk");
    push(ctx, room, `lf:${spec.lf}12`, "Office/Study Chair", 1, {}, "Ergonomic study chair");
  }
  push(ctx, room, `lf:${spec.lf}${index === 0 ? "08" : "07"}`, index === 0 ? "King Size Bed" : "Queen Size Bed", 1, {}, "Bed with storage, frame only");
  push(ctx, room, `lf:${spec.lf}09`, "Soft Furnishings", 1, {}, "Mattress");
  push(ctx, room, `lf:${spec.lf}10`, "End/Side Table", 1, {}, "Pair of bedside tables");
  push(ctx, room, "el:EL35", "Electrical Point", 1, {}, "32A AC point");
  if (spec.floor.bed) {
    push(ctx, room, spec.floor.bed, "Floor Tiling", L * B, { l: L, b: B }, "Flooring");
    if (spec.skirt.bed) push(ctx, room, spec.skirt.bed, "Floor Tiling", 2 * (L + B), {}, "Skirting");
  }
  if (spec.ledProfile) push(ctx, room, "el:EL08", "Decorative Lighting", L * B, { l: L, b: B }, "LED profile lighting allowance");
  push(ctx, room, spec.curtain, "Curtain Channels/Rods", B, { l: B }, "Curtain channel along window wall");
}

function bathroom(ctx: Ctx, room: BoqRoom, L: number, B: number) {
  const { spec } = ctx;
  const floor = L * B;
  const wallTile = 2 * (L + B) * F.bathWallTileH * WALL_NET;
  push(ctx, room, "cv:CV10", "Civil Work", floor, { l: L, b: B }, "Bathroom waterproofing");
  push(ctx, room, "cv:CV04", "Floor Tiling", floor, { l: L, b: B }, "Floor tiling");
  push(ctx, room, "cv:CV03", "Wall Tiling", wallTile, { l: 2 * (L + B), h: F.bathWallTileH }, `Wall tiling up to ${F.bathWallTileH} ft`);
  push(ctx, room, "fc:FC28", "False Ceiling", floor, { l: L, b: B }, "Grid ceiling");
  push(ctx, room, spec.bathPackage, "Sanitary Fittings", 1, {}, "Sanitaryware and CP fittings package");
  modular(ctx, room, "Bathroom Vanity", F.vanity.w, F.vanity.h, `Vanity unit, ${F.vanity.w} ft × ${F.vanity.h} ft`);
  push(ctx, room, spec.partition, "Mirror / Glass", F.partition.w * F.partition.h, { l: F.partition.w, h: F.partition.h }, `Shower partition, ${F.partition.w} ft × ${F.partition.h} ft`);
  push(ctx, room, spec.mirror, "Mirror / Glass", F.vanityMirror.w * F.vanityMirror.h, { l: F.vanityMirror.w, h: F.vanityMirror.h }, `Vanity mirror, ${F.vanityMirror.w} ft × ${F.vanityMirror.h} ft`);
  push(ctx, room, "fu:BF10", "Sanitary Fittings", 1, {}, "Storage geyser, supply");
  push(ctx, room, "el:EL09", "Electrical Point", 1, {}, "Exhaust-fan point");
  push(ctx, room, "el:EL30", "Electrical Point", 3, {}, "Light points");
}

function otherRoom(ctx: Ctx, room: BoqRoom, L: number, B: number) {
  envelope(ctx, room, L, B);
  modular(ctx, room, "Study Table/Desk", F.studyDesk.w, F.studyDesk.h, `Study / utility unit, ${F.studyDesk.w} ft × ${F.studyDesk.h} ft`);
}

function wholeHome(ctx: Ctx, carpet: number) {
  const room: BoqRoom = "Others / Whole Home Civil";
  push(ctx, room, "sc:SC04", "Cleaning / Protection", carpet, {}, "Floor protection during works");
  push(ctx, room, "sc:SC02", "Cleaning / Protection", carpet, {}, "Post-renovation deep cleaning");
  if (ctx.spec.decor) push(ctx, room, ctx.spec.decor, "Furnishing", 1, {}, "Art & décor styling allowance");
}

/** Where in the tier band a home lands: smaller homes sit lower, larger ones higher, unknown size mid-band. */
function bandPosition(size: HomeSize | undefined): number {
  return size === "large" ? 0.75 : size === "small" ? 0.35 : 0.5;
}

const rawTotals = new Map<string, number>();

/**
 * Package pricing for the quote / spec-mode BOQ, per InnerSpacio's price sheet (PACKAGE_BANDS).
 * The bottom-up build prices every item at the full à-la-carte Spazay card; a package is priced to the
 * sheet. One multiplier on every rate, fitted so the BHK's standard room set lands at the band position
 * for the home size. qty × rate still equals each amount; extra or fewer rooms scale from there.
 * Plan mode (brief.ts) is NOT calibrated: it prices the plan's own scope at card/estimator rates.
 */
export function packageFactor(input: Pick<BoqInput, "bhk" | "homeSize" | "tier" | "sheet">): number {
  const band = PACKAGE_BANDS[input.bhk]?.[input.tier];
  const defaults = BHK_ROOM_DEFAULTS[input.bhk];
  if (!band || !defaults) return 1;
  const key = `${input.bhk}|${input.homeSize ?? ""}|${input.tier}|${input.sheet ?? "spazay"}`;
  let raw = rawTotals.get(key);
  if (raw === undefined) {
    const rooms: BoqInput["rooms"] = [];
    for (const [roomType, n] of Object.entries(defaults)) for (let i = 0; i < (n ?? 0); i++) rooms.push({ roomType: roomType as QuoteRoomType });
    raw = summarizeBoq(buildLines({ ...input, city: "Delhi", rooms }, 1)).total;
    rawTotals.set(key, raw);
  }
  if (!(raw > 0)) return 1;
  return (band.min + (band.max - band.min) * bandPosition(input.homeSize)) / raw;
}

export function buildBoq(input: BoqInput): BoqLine[] {
  return buildLines(input, cityFactor(input.city) * packageFactor(input));
}

function buildLines(input: BoqInput, factor: number): BoqLine[] {
  const carpet = carpetArea(input.bhk, input.homeSize);
  const scale = roomScale(input.bhk, input.homeSize);
  const ctx: Ctx = {
    tier: input.tier,
    spec: SPEC[input.tier],
    factor,
    out: [],
    scale,
    sheet: input.sheet ?? "spazay",
    qtySource: "estimated",
  };

  const seen: Partial<Record<QuoteRoomType, number>> = {};
  for (const { roomType } of input.rooms) {
    const idx = seen[roomType] ?? 0;
    seen[roomType] = idx + 1;
    const names = ROOM_MAP[roomType];
    if (!names) continue;
    const room = names[Math.min(idx, names.length - 1)];
    const [bl, bb] = ROOM_STANDARDS[roomType];
    // Secondary bedrooms are smaller than the master.
    const shrink = roomType === "bedroom" && idx > 0 ? SECONDARY_BEDROOM : 1;
    const L = half(bl * ctx.scale * shrink);
    const B = half(bb * ctx.scale * shrink);
    switch (roomType) {
      case "living_room":
        livingRoom(ctx, room, L, B);
        break;
      case "dining_room":
        diningRoom(ctx, room, L, B);
        break;
      case "kitchen":
        kitchen(ctx, room, L, B);
        break;
      case "bedroom":
        bedroom(ctx, room, L, B, idx);
        break;
      case "bathroom":
        bathroom(ctx, room, bl, bb);
        break;
      default:
        otherRoom(ctx, room, L, B);
    }
  }

  if (input.rooms.length > 0) wholeHome(ctx, carpet);

  // Reference-sheet room order, stable within a room.
  const order = new Map<string, number>(BOQ_ROOMS.map((r, i) => [r, i]));
  return ctx.out
    .map((l, i) => ({ l, i }))
    .sort((a, b) => (order.get(a.l.room)! - order.get(b.l.room)!) || a.i - b.i)
    .map((x) => x.l);
}

export interface BoqSummary {
  total: number;
  byTrade: { trade: string; amount: number }[];
  byRoom: { room: string; amount: number }[];
}

export function summarizeBoq(lines: Pick<BoqLine, "trade" | "room" | "amount">[]): BoqSummary {
  const trade = new Map<string, number>();
  const room = new Map<string, number>();
  let total = 0;
  for (const l of lines) {
    const a = Number.isFinite(l.amount) ? l.amount : 0;
    total += a;
    trade.set(l.trade, (trade.get(l.trade) ?? 0) + a);
    room.set(l.room, (room.get(l.room) ?? 0) + a);
  }
  const ranked = (m: Map<string, number>) =>
    [...m.entries()].map(([k, amount]) => ({ k, amount: r2(amount) })).sort((a, b) => b.amount - a.amount);
  return {
    total: r2(total),
    byTrade: ranked(trade).map(({ k, amount }) => ({ trade: k, amount })),
    byRoom: ranked(room).map(({ k, amount }) => ({ room: k, amount })),
  };
}

// ---------- helpers for the brief-driven (plan + requirements) flow ----------

function stubCtx(tier: PackageTier, city: string, sheet: RateSheet): Ctx {
  return { tier, spec: SPEC[tier], factor: cityFactor(city), out: [], scale: 1, sheet, qtySource: "estimated" };
}

/** One priced line for a rate-card id, or null if the id is unknown / qty is not positive. */
export function makeLine(
  rateId: string,
  room: BoqRoom,
  item: string,
  qty: number,
  dims: Dims,
  note: string | undefined,
  city: string,
  sheet: RateSheet = "spazay",
  title?: string
): BoqLine | null {
  if (!findRate(rateId)) return null;
  // Tier is irrelevant for a single explicit rate id (push() only reads factor).
  const ctx = stubCtx("premium", city, sheet);
  push(ctx, room, rateId, item, qty, dims, note, title);
  return ctx.out[0] ?? null;
}

/** A modular unit (carcass + shutter + hardware) at the tier's specification. */
export function modularLines(
  tier: PackageTier,
  city: string,
  room: BoqRoom,
  item: string,
  w: number,
  h: number,
  note: string,
  sheet: RateSheet = "spazay"
): BoqLine[] {
  const ctx = stubCtx(tier, city, sheet);
  modular(ctx, room, item, w, h, note);
  return ctx.out;
}

/** Repaint (existing painted walls) by tier — a renovation repaints, it does not "fresh paint". */
export const REPAINT: Record<PackageTier, string> = {
  essential: "ps:R01", // Asian Apcolite Premium Emulsion
  premium: "ps:R02", // Asian Health Shield
  luxury: "ps:R03", // Asian Royale Lustre
};

/** Ceilings take one mid-grade emulsion at every tier (Asian Royale Aspira, fresh). */
const CEILING_PAINT = "ps:F03";

/** The loose-furniture grade prefix and bathroom package a tier uses (the server enforces these on AI-picked ids). */
export function tierGrade(tier: PackageTier): { lf: Spec["lf"]; bath: string } {
  return { lf: SPEC[tier].lf, bath: SPEC[tier].bathPackage };
}

/** Rate ids the tier uses for common finishes — a hint for the AI scope step. */
export function tierHints(tier: PackageTier): Record<string, string> {
  const s = SPEC[tier];
  return {
    carcass: s.carcass,
    shutter: s.shutter,
    hardware: s.hardware,
    wallPanelling: s.panel,
    falseCeiling: s.ceiling,
    wallPaint: s.paint,
    looseFurniture: `${s.lf}01-${s.lf}15 only (grade fixed by the tier)`,
    bathroomFittings: s.bathPackage,
    repaintExistingWalls: REPAINT[tier],
    stone: s.stone,
    showerPartition: s.partition,
    mirror: s.mirror,
    curtainChannel: s.curtain,
  };
}

/** Plain-language list of the standard sizes a spec-mode BOQ rests on (shown next to the BOQ, never hidden). */
export function specAssumptions(input: Pick<BoqInput, "bhk" | "homeSize">): string[] {
  const carpet = carpetArea(input.bhk, input.homeSize);
  const sc = roomScale(input.bhk, input.homeSize);
  const dim = (t: keyof typeof ROOM_STANDARDS) => {
    const [l, b] = ROOM_STANDARDS[t];
    return t === "bathroom" ? `${l}×${b}` : `${half(l * sc)}×${half(b * sc)}`;
  };
  return [
    `All quantities are standard-size ESTIMATES for a ${input.bhk} BHK of about ${carpet} sq ft carpet, not measurements. Replace with site measurements before issue.`,
    `Room sizes (ft): living ${dim("living_room")}, dining ${dim("dining_room")}, kitchen ${dim("kitchen")}, bedroom ${dim("bedroom")} (later bedrooms ${Math.round((1 - SECONDARY_BEDROOM) * 100)}% smaller), bathroom ${dim("bathroom")}; ceiling ${CEILING_H} ft; ${Math.round(WALL_NET * 100)}% of wall area after doors and windows.`,
    `Joinery: master wardrobe ${F.wardrobeMaster.w}×${F.wardrobeMaster.h} ft, other bedrooms ${F.wardrobeOther.w}×${F.wardrobeOther.h} ft (never more than ${Math.round(F.wardrobeMaxShare * 100)}% of the room's long side), TV unit ${F.tvBase.w}×${F.tvBase.h} ft plus a ${F.tvFloat.w}×${F.tvFloat.h} ft floating unit, crockery ${F.crockery.w}×${F.crockery.h} ft.`,
    "Rates are package rates: the Spazay card items scaled so a standard home of this size and tier lands in InnerSpacio's price band. Essential, Premium and Luxury change the specification and scope.",
  ];
}
