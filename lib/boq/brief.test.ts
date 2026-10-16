import { describe, expect, it } from "vitest";
import { quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";

const master: PlanRoom = {
  id: "r1",
  name: "Master bedroom",
  boqRoom: "Master Bedroom",
  l: 12,
  b: 14,
  h: 10,
  source: "labelled",
};
const utility: PlanRoom = { id: "r2", name: "Utility", boqRoom: "Utility", l: 6, b: 4, h: 10, source: "scaled" };
const opts = { tier: "premium" as const, city: "Delhi" };

const item = (p: Partial<BriefItem>): BriefItem => ({
  room: "Master Bedroom",
  requirement: "req",
  kind: "rate",
  basis: "count",
  ...p,
});

describe("quantify", () => {
  it("wall area = perimeter × height × 0.85 (openings)", () => {
    const { lines } = quantify([item({ rateId: "pt:PT03", basis: "wall_area" })], [master], opts);
    const paint = lines.find((l) => l.rateId === "pt:PT03")!;
    expect(paint.qty).toBeCloseTo(2 * (12 + 14) * 10 * 0.85, 1);
    expect(paint.room).toBe("Master Bedroom");
    expect(paint.amount).toBeCloseTo(paint.qty * paint.rate, 2);
  });

  it("floor / ceiling area = L × B", () => {
    const { lines } = quantify([item({ rateId: "fc:FC02", basis: "ceiling_area" })], [master], opts);
    expect(lines[0].qty).toBe(168);
  });

  it("running feet from the room perimeter or an explicit length", () => {
    const a = quantify([item({ rateId: "fl:SK03", basis: "perimeter" })], [master], opts).lines[0];
    expect(a.uom).toBe("Rft");
    expect(a.qty).toBe(52);
    const b = quantify([item({ rateId: "fl:SK03", basis: "length", width: 9 })], [master], opts).lines[0];
    expect(b.qty).toBe(9);
  });

  it("count units ignore the area basis and default to 1", () => {
    const { lines } = quantify(
      [item({ rateId: "el:EL30", basis: "wall_area", count: 6 }), item({ rateId: "el:EL09", basis: "floor_area" })],
      [master],
      { ...opts, homeCare: false }
    );
    expect(lines.map((l) => l.qty)).toEqual([6, 1]);
  });

  it("modular unit is one all-in line at the tier spec", () => {
    const { lines } = quantify(
      [item({ kind: "modular", item: "Wardrobe", basis: "elevation", width: 8, height: 7 })],
      [master],
      opts
    );
    const mod = lines.filter((l) => l.trade === "Modular Woodwork");
    expect(mod).toHaveLength(1);
    expect(mod[0].qty).toBe(56);
  });

  it("explicit width × height works without any plan room", () => {
    const { lines, warnings } = quantify(
      [item({ room: "Foyer / Entryway", rateId: "mg:MG01", basis: "area", width: 6, height: 7 })],
      [],
      opts
    );
    expect(lines[0].qty).toBe(42);
    expect(warnings).toHaveLength(0);
  });

  it("warns and skips when the room has no dimensions and none were given", () => {
    const { lines, warnings } = quantify([item({ room: "Dining", rateId: "pt:PT03", basis: "wall_area" })], [], opts);
    expect(lines.filter((l) => l.rateId === "pt:PT03")).toHaveLength(0);
    expect(warnings.join(" ")).toMatch(/Dining/);
  });

  it("warns on an unknown rate id instead of inventing a price", () => {
    const { lines, warnings } = quantify([item({ rateId: "zz:NOPE" })], [master], opts);
    expect(lines.filter((l) => l.rateId === "zz:NOPE")).toHaveLength(0);
    expect(warnings.join(" ")).toMatch(/zz:NOPE/);
  });

  it("adds whole-home protection and cleaning from the plan's floor area", () => {
    const { lines } = quantify([], [master, utility], opts);
    const cleaning = lines.find((l) => l.rateId === "sc:SC02")!;
    expect(cleaning.qty).toBe(12 * 14 + 6 * 4);
    expect(cleaning.room).toBe("Others / Whole Home Civil");
  });

  it("can switch the home-care lines off", () => {
    const { lines } = quantify([], [master], { ...opts, homeCare: false });
    expect(lines).toHaveLength(0);
  });

  it("applies no city factor without a verified policy, and warns for a non-NCR city", () => {
    const delhi = quantify([item({ rateId: "pt:PT03", basis: "wall_area" })], [master], opts).lines[0];
    const indore = quantify([item({ rateId: "pt:PT03", basis: "wall_area" })], [master], { ...opts, city: "Indore" }).lines[0];
    expect(indore.rate).toBe(delhi.rate);
    const w = quantify([item({ rateId: "pt:PT03", basis: "wall_area" })], [master], { ...opts, city: "Indore" }).warnings;
    expect(w.some((x) => /NCR card/.test(x))).toBe(true);
    expect(quantify([item({ rateId: "pt:PT03", basis: "wall_area" })], [master], opts).warnings.some((x) => /NCR card/.test(x))).toBe(false);
  });

  it("sums every plan room that maps to the same BOQ room", () => {
    const second: PlanRoom = { ...master, id: "r9", name: "Bedroom 5", l: 10, b: 10 };
    const { lines } = quantify(
      [item({ rateId: "fc:FC02", basis: "ceiling_area" })],
      [master, second],
      { ...opts, homeCare: false }
    );
    expect(lines[0].qty).toBe(12 * 14 + 10 * 10);
  });

  it("warns when the basis does not fit the unit", () => {
    const { lines, warnings } = quantify([item({ rateId: "fc:FC02", basis: "count" })], [master], opts);
    expect(lines.some((l) => l.rateId === "fc:FC02")).toBe(true);
    expect(warnings.join(" ")).toMatch(/doesn't fit/);
  });
});

describe("quantity provenance", () => {
  const assumed: PlanRoom = { ...master, id: "r3", source: "assumed" };
  const src = (items: BriefItem[], rooms: PlanRoom[]) => quantify(items, rooms, opts).lines.find((l) => l.trade !== "Site Protection, Deep Cleaning & Handover")!.qtySource;

  it("an area read off a labelled or scaled plan room is measured", () => {
    expect(src([item({ rateId: "fc:FC02", basis: "ceiling_area" })], [master])).toBe("measured");
    expect(src([item({ rateId: "fc:FC02", basis: "ceiling_area" })], [{ ...master, source: "scaled" }])).toBe("measured");
  });
  it("an area from an assumed plan room is an estimate", () => {
    expect(src([item({ rateId: "fc:FC02", basis: "ceiling_area" })], [assumed])).toBe("estimated");
  });
  it("a size the designer wrote is entered; an assumed class default is an estimate", () => {
    const written = item({ rateId: "wp:WP53", basis: "elevation", width: 8, height: 7, requirement: "wallpaper 8 ft x 7 ft" });
    expect(src([written], [master])).toBe("entered");
    const guessed = { ...written, requirement: "wallpaper feature", note: "Assumed size (class default) — confirm on site." };
    expect(src([guessed], [master])).toBe("estimated");
  });
  it("a stated count is entered, a defaulted count is an estimate", () => {
    expect(src([item({ rateId: "el:EL30", count: 4 })], [master])).toBe("entered");
    expect(src([item({ rateId: "el:EL30" })], [master])).toBe("estimated");
  });
  it("every quantified line carries a source", () => {
    const { lines } = quantify([item({ rateId: "fc:FC02", basis: "ceiling_area" }), item({ rateId: "pt:PT03", basis: "wall_area" })], [master, utility], opts);
    expect(lines.every((l) => l.qtySource)).toBe(true);
  });
  it("an unknown rate id is skipped with a warning, never priced", () => {
    const r = quantify([item({ rateId: "zz:NOPE", count: 1 })], [master], opts);
    expect(r.lines.filter((l) => l.rateId === "zz:NOPE")).toHaveLength(0);
    expect(r.warnings.some((w) => /unknown rate item/.test(w))).toBe(true);
  });
});
