import { describe, expect, it } from "vitest";
import { quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";

// Behaviours that close the gaps found against the professional BOQ (PLAN_BOQ_V3.md, G3–G7, G13).

const master: PlanRoom = { id: "m", name: "Master", boqRoom: "Master Bedroom", l: 12, b: 14, h: 10, source: "labelled" };
const plan: PlanRoom[] = [master, { id: "l", name: "Living", boqRoom: "Living", l: 10, b: 10, h: 10, source: "labelled" }];
const o = { tier: "premium" as const, city: "Delhi" };
const rate = (p: Partial<BriefItem>): BriefItem => ({
  room: "Master Bedroom", requirement: "req", kind: "rate", basis: "count", ...p,
});

describe("repaint is measured net of the feature wall", () => {
  it("subtracts panelling in the same room regardless of item order", () => {
    const paintFirst = [
      rate({ rateId: "pt:PT08", basis: "wall_area" }),
      rate({ rateId: "wp:WP11", basis: "area", width: 10, height: 8 }),
    ];
    const { lines } = quantify(paintFirst, [master], { ...o, homeCare: false });
    const paint = lines.find((l) => l.rateId === "pt:PT08")!;
    expect(paint.qty).toBeCloseTo(2 * 26 * 10 * 0.85 - 80, 2);
    expect(paint.remarks).toContain("Net of the 80 sq ft");
  });

  it("does not net features from another room", () => {
    const items = [
      rate({ rateId: "pt:PT08", basis: "wall_area" }),
      rate({ room: "Living", rateId: "wp:WP11", basis: "area", width: 10, height: 8 }),
    ];
    const paint = quantify(items, plan, { ...o, homeCare: false }).lines.find((l) => l.rateId === "pt:PT08")!;
    expect(paint.qty).toBeCloseTo(2 * 26 * 10 * 0.85, 2);
  });

  it("a feature larger than the walls leaves nothing to paint (skipped with a warning)", () => {
    const items = [
      rate({ rateId: "pt:PT08", basis: "wall_area" }),
      rate({ rateId: "wp:WP11", basis: "area", width: 100, height: 10 }),
    ];
    const r = quantify(items, [master], { ...o, homeCare: false });
    expect(r.lines.some((l) => l.rateId === "pt:PT08")).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/cover all the wall area/);
  });
});

describe("companions and multipliers", () => {
  it("wallpaper brings its oil-primer once per room", () => {
    const items = [
      rate({ rateId: "wp:WP53", basis: "area", width: 12, height: 10 }),
      rate({ rateId: "wp:WP53", basis: "area", width: 5, height: 10, requirement: "second wall" }),
    ];
    const { lines } = quantify(items, [master], { ...o, homeCare: false });
    expect(lines.filter((l) => l.rateId === "pt:PT12")).toHaveLength(1);
    expect(lines.find((l) => l.rateId === "pt:PT12")!.qty).toBe(120);
  });

  it("no duplicate primer when the scope already lists it", () => {
    const items = [
      rate({ rateId: "wp:WP53", basis: "area", width: 12, height: 10 }),
      rate({ rateId: "pt:PT12", basis: "area", width: 12, height: 10 }),
    ];
    expect(quantify(items, [master], { ...o, homeCare: false }).lines.filter((l) => l.rateId === "pt:PT12")).toHaveLength(1);
  });

  it("sides=2 doubles an area item (door both faces) but not a count item", () => {
    const door = quantify([rate({ rateId: "pt:PT13", basis: "area", width: 3, height: 7, sides: 2 })], [master], { ...o, homeCare: false });
    expect(door.lines[0].qty).toBe(42);
    const pts = quantify([rate({ rateId: "el:EL30", count: 3, sides: 2 })], [master], { ...o, homeCare: false });
    expect(pts.lines[0].qty).toBe(3);
  });

  it("a tiny dismantling job becomes the lump-sum minimum, amount still qty × rate", () => {
    const { lines } = quantify([rate({ rateId: "cv:CV22", basis: "area", width: 6, height: 2 })], [master], { ...o, homeCare: false });
    expect(lines[0]).toMatchObject({ uom: "L.S.", qty: 1, rate: 2500, amount: 2500 });
    const big = quantify([rate({ rateId: "cv:CV22", basis: "area", width: 20, height: 7 })], [master], { ...o, homeCare: false });
    expect(big.lines[0].uom).toBe("Sq.Ft.");
    expect(big.lines[0].qty).toBe(140);
  });
});

describe("whole-home care", () => {
  it("default: deep cleaning only — floor protection is opt-in", () => {
    const { lines } = quantify([], plan, o);
    expect(lines.map((l) => l.code)).toEqual(["SC02"]);
    const withProt = quantify([], plan, { ...o, floorProtection: true }).lines.map((l) => l.code);
    expect(withProt.sort()).toEqual(["SC02", "SC04"]);
  });

  it("homeCare:false adds nothing", () => {
    expect(quantify([], plan, { ...o, homeCare: false }).lines).toHaveLength(0);
  });
});

describe("coverage", () => {
  it("reports lines and rate codes per requirement; a skipped one has 0 lines", () => {
    const items = [
      rate({ requirement: "feature wall", rateId: "wp:WP11", basis: "area", width: 10, height: 8 }),
      rate({ requirement: "ghost item", rateId: "zz:NOPE" }),
    ];
    const { coverage } = quantify(items, [master], { ...o, homeCare: false });
    expect(coverage.find((c) => c.requirement === "feature wall")).toMatchObject({ lines: 1, codes: ["WP11"] });
    expect(coverage.find((c) => c.requirement === "ghost item")!.lines).toBe(0);
  });

  it("titles are specific: given title wins, else requirement + rate item", () => {
    const { lines } = quantify(
      [
        rate({ requirement: "Wall behind chair", title: "Living feature wall — custom wallpaper", rateId: "wp:WP53", basis: "area", width: 10, height: 9 }),
        rate({ requirement: "Point shift", rateId: "el:EL02", count: 2 }),
      ],
      [master],
      { ...o, homeCare: false }
    );
    expect(lines.find((l) => l.rateId === "wp:WP53")!.title).toBe("Living feature wall — custom wallpaper");
    expect(lines.find((l) => l.rateId === "el:EL02")!.title).toMatch(/^Point shift — /);
  });
});
