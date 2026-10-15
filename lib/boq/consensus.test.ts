import { describe, expect, it } from "vitest";
import { medianRunIndex, pickMedianRun } from "@/lib/boq/consensus";
import type { BriefItem, PlanRoom } from "@/lib/boq/brief";

const kitchen: PlanRoom = { id: "k", name: "KITCHEN", boqRoom: "Kitchen", l: 12.75, b: 11.58, h: 10, source: "labelled" };
const unit = (u: string, room: BriefItem["room"] = "Kitchen"): BriefItem => ({
  room, requirement: u, kind: "rate", basis: "elevation", unit: u,
});
const run = (...us: string[]) => ({ rooms: [kitchen], items: us.map((u) => unit(u)) });

describe("median run", () => {
  it("a single run is itself", () => {
    const r = run("kitchen_cabinetry");
    expect(pickMedianRun([r])).toBe(r);
  });

  it("picks the run with the median total, ignoring the outliers either way", () => {
    const low = run("crockery_unit");
    const mid = run("crockery_unit", "kitchen_cabinetry");
    const high = run("crockery_unit", "kitchen_cabinetry", "quartz_counter", "kitchen_cabinetry");
    expect(medianRunIndex([high, low, mid])).toBe(2);
    expect(pickMedianRun([high, low, mid])).toBe(mid);
  });

  it("with two runs takes the fuller one (runs fail by omission)", () => {
    const less = run("crockery_unit");
    const more = run("crockery_unit", "quartz_counter");
    expect(pickMedianRun([more, less])).toBe(more);
  });

  it("is deterministic on ties", () => {
    const a = run("crockery_unit");
    const b = run("crockery_unit");
    expect(medianRunIndex([a, b, run("crockery_unit")])).toBe(medianRunIndex([a, b, run("crockery_unit")]));
  });
});
