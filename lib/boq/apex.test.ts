import { describe, expect, it as test } from "vitest";
import { quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";
import { summarizeBoq } from "@/lib/boq/build";

/**
 * Regression against the professional BOQ for the same brief (expected_BOQ/, Apex Alphabet 4BHK).
 * The items below are what a correct scope step returns for that brief; this pins that the
 * deterministic pipeline turns them into the professional's lines — same rooms, same rate
 * ids, same quantities — and flags the allowances the card has no rate for.
 */

const room = (id: string, boqRoom: PlanRoom["boqRoom"], l: number, b: number): PlanRoom => ({
  id, name: id, boqRoom, l, b, h: 9, source: "assumed",
});
const rooms: PlanRoom[] = [
  room("e", "Entrance", 10, 8),
  room("f", "Foyer / Entryway", 10, 6),
  room("l", "Living", 16, 14),
  room("d", "Dining", 12, 10),
  room("m", "Master Bedroom", 14, 12),
];

const it = (p: Partial<BriefItem> & Pick<BriefItem, "room" | "requirement">): BriefItem => ({
  kind: "rate",
  basis: "area",
  ...p,
});

const items: BriefItem[] = [
  // Entrance
  it({ room: "Entrance", requirement: "Entrance feature wall in fluted panelling", rateId: "wp:WP11", width: 5, height: 2 }),
  it({ room: "Entrance", requirement: "Repaint entrance walls", rateId: "pt:PT08", width: 100, height: 1 }),
  it({ room: "Entrance", requirement: "Three LED lights", rateId: "el:EL05", basis: "count", count: 2 }),
  it({ room: "Entrance", requirement: "Main door painted", rateId: "pt:PT13", width: 5, height: 8, sides: 2 }),
  it({ room: "Entrance", requirement: "New nameplate", rateId: "al:NAMEPLATE", basis: "count", count: 1 }),
  // Foyer
  it({ room: "Foyer / Entryway", requirement: "L-shaped mirror wall", rateId: "wp:WP14", width: 10, height: 6 }),
  // Living
  it({ room: "Living", requirement: "Wallpaper feature wall", rateId: "wp:WP53", width: 12, height: 10 }),
  it({ room: "Living", requirement: "New curtains", rateId: "al:CURTAIN", basis: "length", width: 45 }),
  it({ room: "Living", requirement: "Two LED lights", rateId: "el:EL05", basis: "count", count: 2 }),
  it({ room: "Living", requirement: "Five wall points relocated", rateId: "el:EL02", basis: "count", count: 5 }),
  // Balconies
  it({ room: "Balcony 1", requirement: "WPC ceiling", rateId: "fc:FC15", width: 10, height: 7 }),
  it({ room: "Balcony 2", requirement: "Vertical garden", rateId: "al:VGARDEN", width: 8, height: 5 }),
  // Dining
  it({ room: "Dining", requirement: "Wallpaper feature wall", rateId: "wp:WP53", width: 10, height: 10 }),
  it({ room: "Dining", requirement: "Repaint dining walls", rateId: "pt:PT08", width: 15, height: 10 }),
  // Utility
  it({ room: "Utility", requirement: "Partition panel", rateId: "wp:WP11", width: 6, height: 5 }),
  // Master bedroom
  it({ room: "Master Bedroom", requirement: "Dismantle study unit", rateId: "cv:CV22", width: 6, height: 2 }),
  it({ room: "Master Bedroom", requirement: "Close dresser opening", rateId: "cv:CV30", width: 4, height: 6 }),
  it({ room: "Master Bedroom", requirement: "Bed back wall panelling", rateId: "wp:WP11", width: 10, height: 8 }),
  it({ room: "Master Bedroom", requirement: "Aluminium trim", rateId: "wp:WP19", basis: "length", width: 18 }),
  it({ room: "Master Bedroom", requirement: "Dresser unit", kind: "modular", item: "Console/Chest Of Drawers", basis: "elevation", width: 9, height: 3 }),
  it({ room: "Master Bedroom", requirement: "Dresser LED profile lighting", rateId: "mod:K12", basis: "count", count: 1 }),
  it({ room: "Master Bedroom", requirement: "Dresser extra drawer", rateId: "mod:A02", basis: "count", count: 1 }),
  it({ room: "Master Bedroom", requirement: "Full-length mirror", rateId: "wp:WP14", width: 4, height: 5 }),
  it({ room: "Master Bedroom", requirement: "Repaint bedroom", rateId: "pt:PT08", width: 560, height: 1 }),
  it({ room: "Master Bedroom", requirement: "Six wall points relocated", rateId: "el:EL02", basis: "count", count: 6 }),
  it({ room: "Master Bedroom", requirement: "Six new light points", rateId: "el:EL30", basis: "count", count: 6 }),
  it({ room: "Master Bedroom", requirement: "Two lounge chairs", rateId: "lf:LFE02", basis: "count", count: 2 }),
  it({ room: "Master Bedroom", requirement: "Side table", rateId: "lf:LFE04", basis: "count", count: 1 }),
  it({ room: "Master Bedroom", requirement: "New curtains", rateId: "al:CURTAIN", basis: "length", width: 30 }),
];

/** [room, rate id, qty] the professional's Master BOQ has for this brief. */
const EXPECTED: [string, string, number][] = [
  ["Entrance", "wp:WP11", 10],
  ["Entrance", "pt:PT08", 100],
  ["Entrance", "el:EL05", 2],
  ["Entrance", "pt:PT13", 80],
  ["Entrance", "al:NAMEPLATE", 1],
  ["Foyer / Entryway", "wp:WP14", 60],
  ["Living", "wp:WP53", 120],
  ["Living", "pt:PT12", 120],
  ["Living", "al:CURTAIN", 45],
  ["Living", "el:EL05", 2],
  ["Living", "el:EL02", 5],
  ["Balcony 1", "fc:FC15", 70],
  ["Balcony 2", "al:VGARDEN", 40],
  ["Dining", "wp:WP53", 100],
  ["Dining", "pt:PT08", 150],
  ["Utility", "wp:WP11", 30],
  ["Master Bedroom", "cv:CV22", 1], // lump-sum minimum
  ["Master Bedroom", "cv:CV30", 24],
  ["Master Bedroom", "wp:WP11", 80],
  ["Master Bedroom", "wp:WP19", 18],
  ["Master Bedroom", "mod:K12", 1],
  ["Master Bedroom", "mod:A02", 1],
  ["Master Bedroom", "wp:WP14", 20],
  ["Master Bedroom", "pt:PT08", 560],
  ["Master Bedroom", "el:EL02", 6],
  ["Master Bedroom", "el:EL30", 6],
  ["Master Bedroom", "lf:LFE02", 2],
  ["Master Bedroom", "lf:LFE04", 1],
  ["Master Bedroom", "al:CURTAIN", 30],
];

describe("Apex Alphabet brief vs the professional BOQ", () => {
  const out = quantify(items, rooms, { tier: "premium", city: "Noida" });

  test("every professional line is present with the same room, rate and quantity", () => {
    const missing = EXPECTED.filter(
      ([r, id, q]) => !out.lines.some((l) => l.room === r && l.rateId === id && Math.abs(l.qty - q) < 0.01)
    );
    expect(missing).toEqual([]);
  });

  test("has an Entrance section separate from the Foyer", () => {
    const names = new Set(out.lines.map((l) => l.room));
    expect(names.has("Entrance")).toBe(true);
    expect(names.has("Foyer / Entryway")).toBe(true);
  });

  test("flags the three no-rate items as provisional allowances", () => {
    const prov = out.lines.filter((l) => l.provisional).map((l) => l.rateId);
    expect(new Set(prov)).toEqual(new Set(["al:NAMEPLATE", "al:CURTAIN", "al:VGARDEN"]));
    expect(out.lines.find((l) => l.rateId === "al:VGARDEN")!.trade).toBe("Market Supply");
  });

  test("is not over-scoped: no demolition of the whole room, no false ceiling, no floor protection", () => {
    expect(out.lines.some((l) => l.trade === "False Ceiling" && l.room === "Master Bedroom")).toBe(false);
    expect(out.lines.some((l) => l.code === "SC04")).toBe(false);
    const demo = out.lines.filter((l) => l.room === "Master Bedroom" && l.trade.startsWith("Demolition"));
    expect(demo).toHaveLength(1);
    expect(demo[0].uom).toBe("L.S.");
    expect(demo[0].amount).toBe(2500);
  });

  test("every line carries a specific title and amount = qty × rate", () => {
    for (const l of out.lines) {
      expect(l.title && l.title.length > 3).toBe(true);
      expect(l.amount).toBeCloseTo(l.qty * l.rate, 2);
    }
  });

  test("lands within 20% of the professional's total (658,216)", () => {
    const { total } = summarizeBoq(out.lines);
    expect(total).toBeGreaterThan(658_216 * 0.8);
    expect(total).toBeLessThan(658_216 * 1.2);
  });
});
