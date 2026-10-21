import { describe, expect, it } from "vitest";
import { roomIssues } from "@/lib/boq/rooms";
import { quantify, type PlanRoom, type BriefItem } from "@/lib/boq/brief";

const R = (id: string, name: string, boqRoom: PlanRoom["boqRoom"], l: number, b: number, source: PlanRoom["source"] = "labelled"): PlanRoom => ({ id, name, boqRoom, l, b, h: 10, source });

describe("roomIssues", () => {
  it("flags missing dimensions, assumed sizes and implausible sizes", () => {
    const out = roomIssues([R("1", "KITCHEN", "Kitchen", 0, 8), R("2", "PASSAGE", "Passage / Lobby", 3.67, 14, "assumed"), R("3", "HALL", "Living", 120, 12)]);
    expect(out.map((i) => i.kind).sort()).toEqual(["assumed", "implausible", "missing"]);
  });
  it("flags duplicate rooms (same name, section and size)", () => {
    const out = roomIssues([R("1", "BED ROOM", "Kids Room", 13, 11), R("2", "Bed Room", "Kids Room", 13, 11)]);
    expect(out.some((i) => i.kind === "duplicate")).toBe(true);
  });
  it("two real bedrooms of different sizes are not duplicates", () => {
    expect(roomIssues([R("1", "BED ROOM", "Kids Room", 13, 11), R("2", "BED ROOM", "Master Bedroom", 16, 11)])).toEqual([]);
  });
  it("a clean plan has no issues", () => expect(roomIssues([R("1", "KITCHEN", "Kitchen", 14, 8)])).toEqual([]));
});

describe("dimension source flows to quantity source", () => {
  const item: BriefItem = { room: "Kitchen", requirement: "tiling", kind: "rate", basis: "floor_area", rateId: "cv:CV04" };
  const opts = { tier: "premium" as const, city: "Noida", homeCare: false };
  it("labelled / scaled = measured; designer-entered = entered; assumed = estimated", () => {
    expect(quantify([item], [R("1", "K", "Kitchen", 14, 8)], opts).lines[0].qtySource).toBe("measured");
    expect(quantify([item], [R("1", "K", "Kitchen", 14, 8, "entered")], opts).lines[0].qtySource).toBe("entered");
    expect(quantify([item], [R("1", "K", "Kitchen", 14, 8, "assumed")], opts).lines[0].qtySource).toBe("estimated");
  });
});
