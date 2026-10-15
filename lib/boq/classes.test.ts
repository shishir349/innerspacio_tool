import { describe, expect, it } from "vitest";
import { briefItemSchema, quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";
import { reconcileUnpriced } from "@/lib/boq/brief-response";
import { resolveUnit, tierScale, UNIT_CLASSES } from "@/lib/boq/classes";
import { findRate } from "@/lib/rates/catalog";
import { normalizeScope } from "@/lib/ai/boq-brief";

const room = (id: string, boqRoom: PlanRoom["boqRoom"], l: number, b: number): PlanRoom => ({ id, name: id, boqRoom, l, b, h: 10, source: "labelled" });
const rooms: PlanRoom[] = [room("k", "Kitchen", 12.75, 11.58), room("m", "Master Bedroom", 14.4, 21.2), room("s", "Study / Office", 15.9, 11.5)];
const opts = { tier: "premium" as const, city: "Noida", homeCare: false };
const unit = (p: Partial<BriefItem> & Pick<BriefItem, "room" | "unit">): BriefItem => ({
  // a size only counts when the designer's words carry one (number + unit)
  requirement: p.width ? `${p.unit} ${p.width} ft x ${p.height ?? 1} ft` : String(p.unit),
  kind: "rate",
  basis: "elevation",
  ...p,
});

describe("unit classes", () => {
  it("every class points at a real rate", () => {
    for (const [id, c] of Object.entries(UNIT_CLASSES)) expect(findRate(c.rateId), id).toBeDefined();
    expect(findRate("pr:VANITYM")).toBeDefined();
    expect(findRate("pr:VMIRRORM")).toBeDefined();
  });

  it("the professional's quantities price to the professional's amounts (Greenwoods)", () => {
    const sized = [
      unit({ room: "Kitchen", unit: "kitchen_cabinetry", width: 35, height: 10 }), // 350 sq ft
      unit({ room: "Kitchen", unit: "quartz_counter", basis: "area", width: 200, height: 1 }),
      unit({ room: "Master Bedroom", unit: "wardrobe", width: 20, height: 10 }),
      unit({ room: "Others / Whole Home Civil", unit: "fresh_paint", basis: "area", width: 14000, height: 1 }),
      unit({ room: "Others / Whole Home Civil", unit: "glass_railing", basis: "length", width: 250 }),
      unit({ room: "Others / Whole Home Civil", unit: "pvc_ceiling", basis: "area", width: 450, height: 1 }),
      unit({ room: "Others / Whole Home Civil", unit: "window_upvc", width: 10, height: 10 }),
    ];
    const amounts = quantify(sized, rooms, opts).lines.map((l) => Math.round(l.amount));
    expect(amounts).toEqual([1_171_800, 249_200, 498_200, 868_000, 622_750, 139_950, 113_800]);
  });

  it("a stated size wins; an omitted one is computed from the plan and recorded", () => {
    const stated = resolveUnit(unit({ room: "Master Bedroom", unit: "wardrobe", width: 8, height: 7 }), rooms, "premium").item;
    expect([stated.width, stated.height]).toEqual([8, 7]);
    expect(stated.note).toBeUndefined();
    const auto = resolveUnit(unit({ room: "Master Bedroom", unit: "wardrobe" }), rooms, "premium").item;
    expect((auto.width ?? 0) * (auto.height ?? 0)).toBeCloseTo(0.31 * 14.4 * 21.2, 0);
    expect(auto.note).toMatch(/Assumed size/);
  });

  it("kitchen default is the U-run x 9.5 ft, in the professional's range", () => {
    const k = quantify([unit({ room: "Kitchen", unit: "kitchen_cabinetry" })], rooms, opts).lines[0];
    expect(k.qty).toBeGreaterThan(330);
    expect(k.qty).toBeLessThan(360);
    expect(k.rate).toBe(3348);
  });

  it("master bathroom picks the master vanity; modular classes scale with the tier", () => {
    const v = resolveUnit(unit({ room: "Master Bathroom", unit: "vanity", basis: "count" }), rooms, "premium").item;
    expect(v.rateId).toBe("pr:VANITYM");
    expect(tierScale("premium")).toBe(1);
    expect(tierScale("essential")).toBeLessThan(1);
    expect(tierScale("luxury")).toBeGreaterThan(1);
    const lux = quantify([unit({ room: "Master Bedroom", unit: "wardrobe", width: 10, height: 10 })], rooms, { ...opts, tier: "luxury" }).lines[0];
    expect(lux.rate).toBe(Math.round(2491 * tierScale("luxury")));
    expect(lux.amount).toBeCloseTo(lux.qty * lux.rate, 2);
  });

  it("unknown unit ids are ignored, not fatal", () => {
    const it = unit({ room: "Kitchen", unit: "nope", rateId: "mg:MG01", basis: "area", width: 2, height: 2 });
    expect(resolveUnit(it, rooms, "premium").item).toBe(it);
  });
});

describe("reconcileUnpriced", () => {
  const coverage = [
    { requirement: "Boot room: floating shelf storage with hanging space", lines: 1 },
    { requirement: "Whole home: full repaint of the entire villa", lines: 0 },
  ];
  it("drops a requirement the items priced, and reasons that say it was priced", () => {
    const out = reconcileUnpriced(
      [
        { requirement: "Boot room: floating shelf storage with hanging space for coats", reason: "no hanging rail rate" },
        { requirement: "Study: modular storage", reason: "The floating shelves are priced using mod:FS01" },
        { requirement: "Design consultancy fees", reason: "No rate-card item" },
        { requirement: "Whole home: full repaint of the entire villa", reason: "no wall dimensions" },
      ],
      coverage
    );
    expect(out.map((u) => u.requirement)).toEqual(["Design consultancy fees", "Whole home: full repaint of the entire villa"]);
  });
});

describe("model slips are absorbed", () => {
  it("an unknown basis falls back to area instead of dropping the item", () => {
    const p = briefItemSchema.safeParse({ room: "Kitchen", requirement: "x", kind: "rate", basis: "wall", unit: "tv_unit" });
    expect(p.success && p.data.basis).toBe("area");
  });

  it("a second 'one per level / room' unit is dropped with a warning", () => {
    const items = [
      unit({ room: "Others / Whole Home Civil", unit: "deep_clean", basis: "area", requirement: "ground" }),
      unit({ room: "Others / Whole Home Civil", unit: "deep_clean", basis: "area", requirement: "first" }),
      unit({ room: "Master Bedroom", unit: "wardrobe", area: "Dress" }),
      unit({ room: "Master Bedroom", unit: "wardrobe", area: "Dress", requirement: "again" }),
      unit({ room: "Master Bedroom", unit: "wardrobe", area: "Bedroom", requirement: "other area" }),
    ];
    const r = quantify(items, rooms, opts);
    // deep clean once per level; one wardrobe per master (bedroom + dress are one unit)
    expect(r.lines).toHaveLength(2);
    expect(r.warnings.filter((w) => /duplicate/.test(w))).toHaveLength(3);
  });

  it("whole-home paint with no size is 2.45 x the plan floor area", () => {
    const own = { room: "Others / Whole Home Civil" as const, requirement: "repaint villa", kind: "rate" as const, rateId: "pt:PT08", basis: "area" as const };
    const r = quantify([own], rooms, opts);
    const floor = rooms.reduce((n, x) => n + x.l * x.b, 0);
    expect(r.lines[0].qty).toBeCloseTo(floor * 2.45, 0);
  });
});

describe("the model's own sizes are not trusted", () => {
  it("a width the designer never wrote is replaced by the class default", () => {
    const guess = unit({ room: "Master Bedroom", unit: "wardrobe", width: 40, height: 10, requirement: "wardrobe" });
    const out = resolveUnit(guess, rooms, "premium").item;
    expect((out.width ?? 0) * (out.height ?? 0)).toBeCloseTo(0.31 * 14.4 * 21.2, 0);
  });
  it("plan-measured classes keep the model's reading", () => {
    const rail = unit({ room: "Others / Whole Home Civil", unit: "glass_railing", basis: "length", width: 80, requirement: "railing" });
    expect(resolveUnit(rail, rooms, "premium").item.width).toBe(80);
  });
  it("an implausible height does not drop the item", () => {
    const p = briefItemSchema.safeParse({ room: "Kitchen", requirement: "x", kind: "rate", basis: "area", height: 900 });
    expect(p.success && p.data.height).toBeUndefined();
  });
});

describe("plan pointers beat the model's section choice", () => {
  it("a plan room named Utility is Utility even if the model said Kitchen", () => {
    const s = normalizeScope({
      rooms: [{ id: "u", name: "UTILITY ROOM", boqRoom: "Kitchen", l: 6.5, b: 6, h: 10, source: "labelled" }],
      items: [],
    });
    expect(s.rooms[0].boqRoom).toBe("Utility");
  });

  it("an item whose area is a plan room moves to that room's section", () => {
    const rs: PlanRoom[] = [room("UTILITY ROOM", "Utility", 6.5, 6), room("KITCHEN", "Kitchen", 12.75, 11.5)];
    const it = unit({ room: "Kitchen", unit: "quartz_counter", area: "UTILITY ROOM", basis: "area" });
    const r = quantify([it], rs, opts);
    expect(r.lines[0].room).toBe("Utility");
    expect(r.lines[0].qty).toBe(25);
  });

  it("a misread kitchen depth cannot make a 70 ft kitchen", () => {
    const rs: PlanRoom[] = [room("KITCHEN", "Kitchen", 12.75, 29.08)];
    const k = quantify([unit({ room: "Kitchen", unit: "kitchen_cabinetry" })], rs, opts).lines[0];
    expect(k.qty).toBeLessThanOrEqual(42 * 9.5 + 0.1);
  });
});

describe("area re-homing is conservative", () => {
  it("an ambiguous label ('BEDROOM' on two sections) leaves the item where the model put it", () => {
    const rs: PlanRoom[] = [room("BEDROOM (upper)", "Master Bedroom", 14, 21), room("BEDROOM (lower)", "Kids Room", 16, 16)];
    const it = unit({ room: "Master Bedroom", unit: "tv_unit", area: "BEDROOM", basis: "elevation" });
    expect(quantify([it], rs, opts).lines[0].room).toBe("Master Bedroom");
  });
});

describe("facade PVC ceiling and lenient kinds", () => {
  it("a whole-home PVC ceiling with no size covers the plan's balconies", () => {
    const rs: PlanRoom[] = [room("BALCONY", "Balcony 1", 40, 7.5), room("BALCONY", "Balcony 2", 40, 2.8)];
    const it = unit({ room: "Others / Whole Home Civil", unit: "pvc_ceiling", basis: "area" });
    expect(quantify([it], rs, opts).lines[0].qty).toBeCloseTo(412, 0);
  });
  it("kind 'unit' (the model echoing the field) is a rate item, not a dropped one", () => {
    const p = briefItemSchema.safeParse({ room: "Kitchen", requirement: "x", kind: "unit", basis: "area", unit: "tv_unit" });
    expect(p.success && p.data.kind).toBe("rate");
  });
});
