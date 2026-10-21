import type { BriefItem, PlanRoom } from "@/lib/boq/brief";

/**
 * Offline replay fixture: Cleo County Type A (1620 sq ft 3BHK). Rooms are the plan read stored in the saved
 * "Karan — BOQ"; items are the scope the designer's 12-section brief calls for, written by hand (what the model
 * extracts varies run to run). Re-price with quantify() — no AI, no credits.
 */
const R = (id: string, name: string, boqRoom: PlanRoom["boqRoom"], l: number, b: number): PlanRoom => ({ id, name, boqRoom, l, b, h: 10, source: "labelled" });
export const CLEO_ROOMS: PlanRoom[] = [
  R("1", "BALCONY", "Balcony 1", 16.42, 6.33), R("2", "ENSUITE (west)", "Guest / Parents Bathroom", 6, 12), R("3", "MASTER BED ROOM", "Master Bedroom", 16.08, 11),
  R("4", "ENSUITE (north)", "Master Bathroom", 11, 6), R("5", "BED ROOM", "Kids Room", 13.08, 11), R("6", "BALCONY 2", "Balcony 2", 11.58, 6),
  R("7", "DRAWING ROOM", "Living", 12, 17), R("8", "DINING", "Dining", 11.75, 10), R("9", "PASSAGE", "Passage / Lobby", 3.67, 14), R("10", "TOILET", "Kids Bathroom", 6, 9),
  R("11", "BED ROOM ll", "Guest / Parents Bedroom", 11, 13), R("12", "KITCHEN", "Kitchen", 14, 8), R("13", "FOYER", "Foyer / Entryway", 4, 6.58), R("14", "UTILITY", "Utility", 17.5, 5),
];
const I = (room: BriefItem["room"], requirement: string, o: Partial<BriefItem>): BriefItem => ({ room, requirement, kind: "rate", basis: "area", status: "NEW", ...o }) as BriefItem;
const U = (room: BriefItem["room"], requirement: string, unit: string, o: Partial<BriefItem> = {}) => I(room, requirement, { unit, ...o });
const C = (room: BriefItem["room"], requirement: string, rateId: string, count = 1) => I(room, requirement, { rateId, count });
const HOLD = (room: BriefItem["room"], requirement: string, status: BriefItem["status"], o: Partial<BriefItem> = {}) => I(room, requirement, { status, ...o });

/** What the model would pick per tier: loose furniture grade (Basic / Elevated / Luxury) and the fittings package. */
export const cleoItems = (tier: "essential" | "premium" | "luxury"): BriefItem[] => {
  const g = { essential: "B", premium: "E", luxury: "L" }[tier];
  return CLEO_ITEMS.map((i) => ({
    ...i,
    rateId: i.rateId?.startsWith("lf:LF") ? `lf:LF${g}${i.rateId.slice(6)}` : i.rateId === "bth:BTH01" && tier === "luxury" ? "bth:BTH02" : i.rateId,
  }));
};

/**
 * The 12-section brief, item by item, and nothing the brief does not say. Vague wording ("necessary civil modifications",
 * "furnish and design the balcony", "electrical modifications") is UNCONFIRMED, not a guessed scope; the retained bed,
 * retained shower / plumbing and the excluded dining table are recorded and not priced; a bed upholstery refresh has no
 * card rate, so it is held for a manual line.
 */
const CLEO_ITEMS: BriefItem[] = [
  // 1 Foyer
  U("Foyer / Entryway", "design and enhance the foyer wall", "foyer_panelling"),
  U("Foyer / Entryway", "console unit with paneling", "dresser"),
  // 2 Living
  U("Living", "feature wall design", "feature_wall"), U("Living", "TV unit", "tv_unit"), U("Living", "TV backdrop wall", "feature_wall"),
  C("Living", "procure and install the living room sofa set", "lf:LFE01"),
  HOLD("Balcony 1", "furnish and design the living room balcony", "UNCONFIRMED", { unit: "pvc_ceiling" }),
  // 3 Dining
  U("Dining", "storage-cum-bar cabinet", "crockery_unit"),
  HOLD("Dining", "dining table procurement is excluded", "EXCLUDED", { rateId: "lf:LFE06", count: 1 }),
  // 4 Kitchen
  U("Kitchen", "modular kitchen with comprehensive storage", "kitchen_cabinetry"), U("Kitchen", "countertop for the new kitchen", "quartz_counter"),
  HOLD("Kitchen", "necessary civil modifications", "UNCONFIRMED", { rateId: "cv:CV13", basis: "floor_area" }),
  HOLD("Kitchen", "electrical works per approved design", "UNCONFIRMED", { rateId: "el:EL02", count: 1 }),
  // 5 Utility
  U("Utility", "additional storage cabinetry", "utility_counter"), C("Utility", "washing machine utility outlets", "el:EL03", 2), C("Utility", "utility sink plumbing provisions", "cv:CV27"),
  // 6 Guest bedroom
  C("Guest / Parents Bedroom", "bed", "lf:LFE07"), C("Guest / Parents Bedroom", "side tables", "lf:LFE10"),
  I("Guest / Parents Bedroom", "complete flooring replacement", { rateId: "cv:CV04", basis: "floor_area" }),
  I("Guest / Parents Bedroom", "replace wardrobe shutters 6 ft x 8 ft", { status: "REPLACE", rateId: "mod:S04", basis: "elevation", width: 6, height: 8 }),
  U("Guest / Parents Bedroom", "bed-back wall design and wall enhancements", "feature_wall"),
  // 7 Master bedroom
  HOLD("Master Bedroom", "retain existing bed", "RETAIN", { rateId: "lf:LFE08", count: 1 }),
  HOLD("Master Bedroom", "refreshed fabric upholstery for the existing bed", "REFURBISH"),
  C("Master Bedroom", "new side tables", "lf:LFE10"), C("Master Bedroom", "two accent chairs", "lf:LFE02", 2), C("Master Bedroom", "coffee table", "lf:LFE03"),
  I("Master Bedroom", "complete flooring replacement", { rateId: "cv:CV04", basis: "floor_area" }),
  U("Master Bedroom", "bed-back feature wall design", "feature_wall"), U("Master Bedroom", "dresser", "dresser"), U("Master Bedroom", "TV unit", "tv_unit"),
  HOLD("Master Bedroom", "furnish and design the master bedroom balcony", "UNCONFIRMED", { unit: "pvc_ceiling" }),
  // 8 Master bathroom
  I("Master Bathroom", "new wall tiling", { rateId: "cv:CV03", basis: "wall_area" }), I("Master Bathroom", "new floor tiling", { rateId: "cv:CV04", basis: "floor_area" }),
  U("Master Bathroom", "redesign the vanity with a new countertop", "vanity", { basis: "count" }), C("Master Bathroom", "replace sanitaryware and fixtures", "bth:BTH01"),
  HOLD("Master Bathroom", "maintain existing plumbing", "RETAIN", { rateId: "cv:CV12", basis: "floor_area" }),
  HOLD("Master Bathroom", "retain existing shower partition", "RETAIN", { unit: "shower_partition" }),
  HOLD("Master Bathroom", "replace wardrobe internal components where necessary", "UNCONFIRMED", { unit: "wardrobe" }),
  // 9 Kids bedroom
  C("Kids Room", "bed", "lf:LFE07"), C("Kids Room", "side tables", "lf:LFE10"), U("Kids Room", "study-cum-storage unit", "kids_study"),
  I("Kids Room", "replace wardrobe shutters 6 ft x 8 ft", { status: "REPLACE", rateId: "mod:S04", basis: "elevation", width: 6, height: 8 }),
  U("Kids Room", "bed-back wall design and decorative enhancements", "feature_wall"),
  // 10 Common bathroom
  I("Kids Bathroom", "new wall tiling", { rateId: "cv:CV03", basis: "wall_area" }), I("Kids Bathroom", "new floor tiling", { rateId: "cv:CV04", basis: "floor_area" }),
  U("Kids Bathroom", "redesign the vanity with a new countertop", "vanity", { basis: "count" }), C("Kids Bathroom", "replace sanitaryware and fixtures", "bth:BTH01"),
  U("Kids Bathroom", "install a new shower partition", "shower_partition"),
  HOLD("Kids Bathroom", "maintain existing plumbing", "RETAIN", { rateId: "cv:CV12", basis: "floor_area" }),
  // 11 Painting
  U("Others / Whole Home Civil", "full interior painting of the apartment", "fresh_paint"),
  // 12 Electrical
  HOLD("Others / Whole Home Civil", "electrical modifications and new points per approved design", "UNCONFIRMED", { rateId: "el:EL02", count: 1 }),
];
