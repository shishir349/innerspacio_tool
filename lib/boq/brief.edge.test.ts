import { BOQ_ROOMS } from "@/lib/boq/lists";
import { describe, expect, it } from "vitest";
import { quantify, quantifyRequestSchema, briefItemSchema, planRoomSchema, type BriefItem, type PlanRoom } from "@/lib/boq/brief";

const room = (p: Partial<PlanRoom>): PlanRoom => ({
  id: "r1", name: "Bed", boqRoom: "Master Bedroom", l: 12, b: 14, h: 10, source: "labelled", ...p,
});
const item = (p: Partial<BriefItem>): BriefItem => ({
  room: "Master Bedroom", requirement: "req", kind: "rate", basis: "count", ...p,
});
const opts = { tier: "premium" as const, city: "Delhi", homeCare: false };

describe("quantify edge cases", () => {
  it("modular without width warns and emits no lines", () => {
    const r = quantify([item({ kind: "modular", item: "Wardrobe", basis: "elevation" })], [room({})], opts);
    expect(r.lines).toHaveLength(0);
    expect(r.warnings).toHaveLength(1);
  });

  it("zero-dimension room is ignored: area item warns", () => {
    const r = quantify([item({ rateId: "fc:FC02", basis: "ceiling_area" })], [room({ l: 0 })], opts);
    expect(r.lines).toHaveLength(0);
    expect(r.warnings).toHaveLength(1);
  });

  it("home-care skips when every room has zero floor area", () => {
    const r = quantify([], [room({ l: 0, b: 0 })], { tier: "premium", city: "Delhi" });
    expect(r.lines).toHaveLength(0);
  });

  it("two rooms sharing an id are counted once in home-care floor area", () => {
    const r = quantify([], [room({ id: "x" }), room({ id: "x", boqRoom: "Utility", l: 5, b: 5 })], { tier: "premium", city: "Delhi" });
    expect(r.lines.find((l) => l.rateId === "sc:SC02")!.qty).toBe(168);
  });

  it("two plan rooms with same boqRoom: items measure both", () => {
    const r = quantify(
      [item({ rateId: "fc:FC02", basis: "ceiling_area" })],
      [room({ id: "a" }), room({ id: "b", l: 20, b: 20 })],
      opts
    );
    expect(r.lines[0].qty).toBe(168 + 400);
  });

  it("output is ordered by BOQ room list", () => {
    const r = quantify(
      [item({ room: "Utility", rateId: "el:EL09" }), item({ rateId: "el:EL09" })],
      [],
      opts
    );
    const idx = r.lines.map((l) => BOQ_ROOMS.indexOf(l.room));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    expect(new Set(idx).size).toBe(2);
  });

  it("negative qty-ish inputs are rejected by schemas", () => {
    expect(briefItemSchema.safeParse(item({ width: -1 })).success).toBe(false);
    expect(planRoomSchema.safeParse(room({ h: 2 })).success).toBe(false);
    expect(quantifyRequestSchema.safeParse({ tier: "gold", city: "", rooms: [], items: [] }).success).toBe(false);
    expect(
      quantifyRequestSchema.safeParse({ tier: "premium", city: "x", rooms: [], items: new Array(201).fill(item({})) }).success
    ).toBe(false);
  });
});

import { quantify as q2 } from "@/lib/boq/brief";
describe("home care does not double an explicit cleaning line", () => {
  it("skips the automatic deep clean when the scope already has one", () => {
    const r = { id: "a", name: "A", boqRoom: "Living" as const, l: 10, b: 10, h: 10, source: "labelled" as const };
    const own = { room: "Others / Whole Home Civil" as const, requirement: "clean", kind: "rate" as const, rateId: "sc:SC01", basis: "area" as const, width: 500, height: 1 };
    const { lines } = q2([own], [r], { tier: "premium", city: "Delhi" });
    expect(lines.filter((l) => l.trade.startsWith("Site Protection"))).toHaveLength(1);
  });
});
