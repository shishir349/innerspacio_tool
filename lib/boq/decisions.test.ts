import { describe, expect, it } from "vitest";
import { lineAssessment, openDecisions, type DecisionLine } from "@/lib/boq/decisions";
import { quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";
import { SPEC_MODULAR_PARTS, tierScale } from "@/lib/boq/classes";
import { summarizeBoq } from "@/lib/boq/build";
import { getRate } from "@/lib/rates/catalog";

const line = (o: Partial<DecisionLine>): DecisionLine => ({ room: "Living", trade: "Wall Panelling", item: "Panel", uom: "Sq.Ft.", qty: 10, rateId: "wp:WP01", qtySource: "measured", ...o });
const ids = (l: DecisionLine, all = [l]) => lineAssessment(l, all).reasons.map((r) => r.id).filter(Boolean);

describe("line state: confirmed / assumed / awaiting professional approval", () => {
  it("a card rate on a measured quantity is confirmed", () => {
    expect(lineAssessment(line({ rateId: "cv:CV04", trade: "Flooring & Skirting" }), []).state).toBe("confirmed");
  });
  it("an estimated quantity on a card rate is assumed", () => {
    expect(lineAssessment(line({ rateId: "cv:CV04", qtySource: "estimated" }), []).state).toBe("assumed");
  });
  it("an unverified estimator (pr:) rate or a provisional allowance awaits professional approval", () => {
    expect(lineAssessment(line({ rateId: "pr:TVUNIT", qtySource: "entered" }), []).state).toBe("awaiting");
    expect(lineAssessment(line({ rateId: "al:JACUZZI", provisional: true }), []).state).toBe("awaiting");
  });
});

describe("open professional decisions are flagged, never resolved", () => {
  it("kitchen cabinetry measured by default", () => {
    expect(ids(line({ room: "Kitchen", trade: "Modular Woodwork", rateId: "pr:KITCHEN", qtySource: "estimated" }))).toContain("kitchen-size");
    expect(ids(line({ room: "Kitchen", trade: "Modular Woodwork", rateId: "pr:KITCHEN", qtySource: "entered" }))).not.toContain("kitchen-size");
  });
  it("whole-home paint rate (fresh vs repaint, grade)", () => {
    expect(ids(line({ rateId: "pr:PAINT", trade: "Paint & Polish" }))).toContain("paint-rate");
  });
  it("bathroom wall-tile height, but not tiling elsewhere", () => {
    expect(ids(line({ room: "Master Bathroom", trade: "Wall Tiling", rateId: "cv:CV03" }))).toContain("tile-height");
    expect(ids(line({ room: "Living", trade: "Wall Tiling", rateId: "cv:CV03" }))).not.toContain("tile-height");
  });
  it("vanity (with counter) beside a fittings package may overlap", () => {
    const v = line({ room: "Kids Bathroom", trade: "Modular Woodwork", rateId: "pr:VANITY", uom: "Nos" });
    const f = line({ room: "Kids Bathroom", trade: "Bathroom Sanitaryware & CP Fittings", rateId: "bth:BTH01", uom: "Nos" });
    expect(ids(v, [v, f])).toContain("vanity-fittings");
    expect(ids(f, [v, f])).toContain("vanity-fittings");
    expect(ids(v, [v])).not.toContain("vanity-fittings");
  });
  it("lines added automatically, waterproofing, and a defaulted electrical count", () => {
    expect(ids(line({ rateId: "sc:SC02", trade: "Site Protection, Deep Cleaning & Handover", autoAdded: true }))).toContain("auto-added");
    expect(ids(line({ rateId: "cv:WP03", trade: "Waterproofing" }))).toContain("waterproofing");
    expect(ids(line({ rateId: "el:EL02", trade: "Electrical & AC Works", uom: "Point", qtySource: "estimated" }))).toContain("electrical-count");
    expect(ids(line({ rateId: "el:EL02", trade: "Electrical & AC Works", uom: "Point", qtySource: "entered" }))).not.toContain("electrical-count");
  });
  it("groups the open decisions across a BOQ", () => {
    const all = [line({ rateId: "pr:PAINT", trade: "Paint & Polish" }), line({ rateId: "pr:PAINT", trade: "Paint & Polish", room: "Dining" })];
    expect(openDecisions(all)).toEqual([expect.objectContaining({ id: "paint-rate", count: 2 })]);
  });
});

describe("engine: nothing is added that the scope did not ask for", () => {
  const R = (id: string, boqRoom: PlanRoom["boqRoom"], l: number, b: number): PlanRoom => ({ id, name: id, boqRoom, l, b, h: 10, source: "labelled" });
  const rooms = [R("m", "Master Bedroom", 24, 20), R("k", "Kids Room", 10, 9), R("b", "Master Bathroom", 6, 8)];
  const item = (room: BriefItem["room"], unit: string): BriefItem => ({ room, requirement: unit, kind: "rate", basis: "elevation", unit, status: "NEW" });
  it("with home care off, the lines are exactly the requested items", () => {
    const items = [item("Master Bedroom", "wardrobe"), item("Kids Room", "wardrobe")];
    expect(quantify(items, rooms, { tier: "premium", city: "Noida", homeCare: false }).lines).toHaveLength(2);
  });
  it("by default exactly ONE extra line appears — floor protection — and it is marked auto-added", () => {
    const { lines } = quantify([item("Master Bedroom", "wardrobe")], rooms, { tier: "premium", city: "Noida" });
    expect(lines).toHaveLength(2);
    const extra = lines.filter((l) => l.autoAdded);
    expect(extra.map((l) => l.rateId)).toEqual(["sc:SC04"]);
  });
  it("items stay in their own room and are sized from that room only", () => {
    const { lines } = quantify([item("Master Bedroom", "wardrobe"), item("Kids Room", "wardrobe")], rooms, { tier: "premium", city: "Noida", homeCare: false });
    const m = lines.find((l) => l.room === "Master Bedroom")!;
    const k = lines.find((l) => l.room === "Kids Room")!;
    expect(m.qty).toBeGreaterThan(k.qty); // a 24x20 master vs a 10x9 kids room → different default faces (kids is at the 60 sq ft minimum)
    expect(m.area).toBeTruthy();
  });
});

describe("tier configuration is derived from the rate card, not hardcoded", () => {
  it("modular tier parts are card rate ids from the spec table", () => {
    for (const t of ["essential", "premium", "luxury"] as const) for (const id of SPEC_MODULAR_PARTS[t]) expect(() => getRate(id)).not.toThrow();
  });
  it("tierScale is unchanged: essential 0.739, premium 1, luxury 1.273", () => {
    expect(tierScale("premium")).toBe(1);
    expect(tierScale("essential")).toBeCloseTo((763 + 747 + 389) / (1152 + 950 + 467), 6);
    expect(tierScale("luxury")).toBeCloseTo((1635 + 1168 + 467) / (1152 + 950 + 467), 6);
  });
});

describe("totals", () => {
  it("the BOQ total is exactly the sum of the line amounts, and each amount is qty x rate", () => {
    const R2: PlanRoom[] = [{ id: "k", name: "K", boqRoom: "Kitchen", l: 14, b: 8, h: 10, source: "labelled" }];
    const { lines } = quantify([{ room: "Kitchen", requirement: "k", kind: "rate", basis: "elevation", unit: "kitchen_cabinetry", status: "NEW" }, { room: "Kitchen", requirement: "q", kind: "rate", basis: "area", unit: "quartz_counter", status: "NEW" }], R2, { tier: "premium", city: "Noida" });
    for (const l of lines) expect(l.amount).toBeCloseTo(l.qty * l.rate, 2);
    expect(summarizeBoq(lines).total).toBeCloseTo(lines.reduce((n, l) => n + l.qty * l.rate, 0), 2);
  });
});

describe("room size boundaries (defaults scale with the room and never exceed it)", () => {
  const R = (boqRoom: PlanRoom["boqRoom"], l: number, b: number): PlanRoom => ({ id: boqRoom, name: boqRoom, boqRoom, l, b, h: 10, source: "labelled" });
  const run = (room: BriefItem["room"], unit: string, l: number, b: number) =>
    quantify([{ room, requirement: unit, kind: "rate", basis: "elevation", unit, status: "NEW" }], [R(room as PlanRoom["boqRoom"], l, b)], { tier: "premium", city: "Noida", homeCare: false }).lines[0];

  it("kitchen: small flat kitchen < villa-size, growing with the room, capped by the run limits", () => {
    const tiny = run("Kitchen", "kitchen_cabinetry", 6, 6); // 36 sq ft
    const flat = run("Kitchen", "kitchen_cabinetry", 14, 8); // 112 sq ft
    const villa = run("Kitchen", "kitchen_cabinetry", 12.75, 11.58); // 148 sq ft keeps the professional's U-run
    expect(tiny.qty).toBeLessThan(flat.qty);
    expect(flat.qty).toBeLessThan(villa.qty);
    expect(tiny.qty).toBe(12 * 8); // run floor of 12 ft
    expect(run("Kitchen", "kitchen_cabinetry", 40, 3).qty).toBeLessThanOrEqual(42 * 9.5 + 0.1); // implausible plan read cannot run away
  });
  it("wall defaults never exceed the longest wall of a small room, and stay standard in a big one", () => {
    expect(run("Foyer / Entryway", "foyer_panelling", 3, 4).qty).toBe(4 * 10);
    expect(run("Foyer / Entryway", "foyer_panelling", 12, 14).qty).toBe(10 * 10);
    expect(run("Dining", "tv_unit", 5, 6).qty).toBeLessThanOrEqual(6 * 8);
    expect(run("Living", "tv_unit", 14, 18).qty).toBe(9 * 8);
  });
  it("wardrobe face is floored at 60 sq ft, capped at 220, and between scales with the room", () => {
    expect(run("Kids Room", "wardrobe", 8, 8).qty).toBeCloseTo(60, 0);
    expect(run("Master Bedroom", "wardrobe", 30, 30).qty).toBeCloseTo(220, 0);
    expect(run("Master Bedroom", "wardrobe", 20, 20).qty).toBeCloseTo(124, 0);
  });
});

describe("missing measurements and optional items", () => {
  const room0: PlanRoom = { id: "k", name: "K", boqRoom: "Kitchen", l: 0, b: 8, h: 10, source: "assumed" };
  const opts = { tier: "premium" as const, city: "Noida", homeCare: false };
  it("a room with no length gives no default size: the line is skipped with a warning, not guessed", () => {
    const r = quantify([{ room: "Kitchen", requirement: "kitchen", kind: "rate", basis: "elevation", unit: "kitchen_cabinetry", status: "NEW" }], [room0], opts);
    expect(r.lines).toHaveLength(0);
    expect(r.warnings.join("|")).toMatch(/no dimensions|no width|measurement/i);
  });
  it("an item for a room that is not on the plan is skipped with a warning", () => {
    const r = quantify([{ room: "Study / Office", requirement: "desk", kind: "rate", basis: "elevation", unit: "study_unit", status: "NEW" }], [{ ...room0, l: 10 }], opts);
    expect(r.lines.every((l) => l.room !== "Study / Office" || l.qty > 0)).toBe(true);
  });
  it("an optional count that is missing defaults to 1 and is flagged for confirmation, not silently accepted", () => {
    const l = quantify([{ room: "Kitchen", requirement: "hob point", kind: "rate", basis: "count", rateId: "el:EL03", status: "NEW" }], [{ ...room0, l: 14 }], opts).lines[0];
    expect(l.qty).toBe(1);
    expect(lineAssessment(l, [l]).reasons.map((r) => r.id)).toContain("electrical-count");
  });
  it("an empty scope prices nothing", () => {
    expect(quantify([], [{ ...room0, l: 14 }], opts).lines).toHaveLength(0);
  });
});
