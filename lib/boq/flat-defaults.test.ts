import { describe, expect, it } from "vitest";
import { quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";

const room = (id: string, boqRoom: PlanRoom["boqRoom"], l: number, b: number): PlanRoom => ({ id, name: id, boqRoom, l, b, h: 10, source: "labelled" });
const opts = { tier: "premium" as const, city: "Noida", homeCare: false };
const unit = (room: BriefItem["room"], u: string, basis: BriefItem["basis"] = "elevation"): BriefItem => ({ room, requirement: u, kind: "rate", basis, unit: u });
const one = (rooms: PlanRoom[], it: BriefItem) => quantify([it], rooms, opts).lines[0];

describe("apartment defaults (no stated size)", () => {
  const flat = [room("k", "Kitchen", 14, 8), room("l", "Living", 17, 12), room("d", "Dining", 11.75, 10), room("m", "Master Bedroom", 16, 11)];

  it("a 14 x 8 ft kitchen is an L-run of base + wall units, not a villa U-run", () => {
    const k = one(flat, unit("Kitchen", "kitchen_cabinetry"));
    expect(k.qty).toBeGreaterThan(150);
    expect(k.qty).toBeLessThan(200);
    expect(k.remarks).toMatch(/apartment/i);
  });

  it("its quartz top has no island", () => {
    const q = one(flat, unit("Kitchen", "quartz_counter", "area"));
    expect(q.qty).toBeLessThan(100);
  });

  it("TV, crockery, utility, kids-study and feature-wall defaults are apartment-sized", () => {
    expect(one(flat, unit("Living", "tv_unit")).qty).toBeLessThanOrEqual(72);
    expect(one(flat, unit("Master Bedroom", "tv_unit")).qty).toBeLessThanOrEqual(42);
    expect(one(flat, unit("Dining", "crockery_unit")).qty).toBeLessThanOrEqual(40);
    expect(one(flat, unit("Utility", "utility_counter")).qty).toBeLessThanOrEqual(48);
    expect(one(flat, unit("Kids Room", "kids_study")).qty).toBeLessThanOrEqual(48);
    expect(one(flat, unit("Living", "feature_wall")).qty).toBeLessThanOrEqual(72);
  });

  it("a villa-size kitchen keeps the professional's U-run", () => {
    const k = one([room("k", "Kitchen", 12.75, 11.58)], unit("Kitchen", "kitchen_cabinetry"));
    expect(k.qty).toBeGreaterThan(330);
  });
});

describe("unit class never overrides a rate with a different measure", () => {
  it("a running-foot PVC trim tagged feature_wall keeps its own Rft rate", () => {
    const it: BriefItem = { room: "Foyer / Entryway", requirement: "PVC wall trim 40 ft", title: "PVC wall trim / moulding", kind: "rate", basis: "length", unit: "feature_wall", rateId: "wp:WP52", width: 40 };
    const l = quantify([it], [room("f", "Foyer / Entryway", 6.58, 4)], opts).lines[0];
    expect(l.uom).toBe("Rft");
    expect(l.rate).toBe(125);
    expect(l.qty).toBe(40);
  });
});

import { rateBasis } from "@/lib/rates/catalog";
describe("rate basis and double counting", () => {
  it("classifies rates", () => {
    expect(rateBasis("pr:KITCHEN")).toBe("all-in");
    expect(rateBasis("mod:C03")).toBe("component");
    expect(rateBasis("mod:S04")).toBe("component");
    expect(rateBasis("al:JACUZZI")).toBe("provisional");
    expect(rateBasis("cv:CV04")).toBe("unit");
  });
  it("warns when a room bills an all-in unit and carcass / shutter components", () => {
    const rooms = [room("m", "Master Bedroom", 16, 11)];
    const items: BriefItem[] = [
      { room: "Master Bedroom", requirement: "wardrobe", kind: "rate", basis: "elevation", unit: "wardrobe" },
      { room: "Master Bedroom", requirement: "extra carcass 6 ft x 8 ft", kind: "rate", basis: "elevation", rateId: "mod:C03", width: 6, height: 8 },
    ];
    expect(quantify(items, rooms, opts).warnings.join("|")).toMatch(/charged twice/);
    expect(quantify([items[0]], rooms, opts).warnings.join("|")).not.toMatch(/charged twice/);
  });
});

describe("a default size never exceeds the room it sits in (audit: 100 sq ft foyer wall in a 4 x 6.58 ft foyer)", () => {
  const foyer = [room("f", "Foyer / Entryway", 4, 6.58), room("l", "Living", 12, 17)];
  it("foyer panelling and feature walls are capped at the room's longest wall", () => {
    const f = one(foyer, unit("Foyer / Entryway", "foyer_panelling"));
    expect(f.qty).toBeLessThanOrEqual(6.58 * 10 + 0.1);
    expect(f.qty).toBeGreaterThan(50);
    const small = one([room("s", "Study / Office", 5, 6)], unit("Study / Office", "feature_wall"));
    expect(small.qty).toBeLessThanOrEqual(6 * 9 + 0.1);
  });
  it("a big room keeps the standard default", () => {
    expect(one(foyer, unit("Living", "feature_wall")).qty).toBe(72);
  });
});

describe("balcony PVC ceiling is never sized from a bedroom's floor (audit: 176.9 sq ft 'master balcony')", () => {
  const rooms = [room("m", "Master Bedroom", 16.08, 11), room("b", "Balcony 1", 16.42, 6.33)];
  it("filed under a non-balcony room with no stated size, it is held with a warning", () => {
    const r = quantify([unit("Master Bedroom", "pvc_ceiling", "area")], rooms, opts);
    expect(r.lines).toHaveLength(0);
    expect(r.warnings.join("|")).toMatch(/no dimensions/i);
  });
  it("filed under the balcony it uses the balcony's own area", () => {
    const l = quantify([unit("Balcony 1", "pvc_ceiling", "area")], rooms, opts).lines[0];
    expect(l.qty).toBeCloseTo(16.42 * 6.33, 0);
  });
  it("a stated size is still honoured anywhere", () => {
    const it: BriefItem = { ...unit("Master Bedroom", "pvc_ceiling", "area"), width: 60, height: 1, requirement: "PVC ceiling 60 sq ft" };
    expect(quantify([it], rooms, opts).lines[0].qty).toBe(60);
  });
});
