import { describe, expect, it } from "vitest";
import { reviewSummary, type ReviewRow } from "@/lib/boq/review";

const row = (o: Partial<ReviewRow>): ReviewRow => ({ room: "Living", trade: "Wall Panelling", item: "Panel", qty: 10, rate: 100, ...o });

describe("reviewSummary", () => {
  const rows = [
    row({ qty: 100, rate: 1000 }),
    row({ room: "Kitchen", trade: "Modular Woodwork", qty: 50, rate: 3000, qtySource: "estimated" }),
    row({ room: "Kitchen", trade: "Stone & Countertops", qty: 10, rate: 1246, provisional: true }),
    row({ room: "Dining", qty: 1, rate: 500, rateNote: "no Livspace equivalent", scopeStatus: "REFURBISH" }),
  ];
  const s = reviewSummary(rows);

  it("subtotal, room-wise and trade-wise totals agree", () => {
    expect(s.subtotal).toBe(100_000 + 150_000 + 12_460 + 500);
    expect(s.byRoom.reduce((n, [, v]) => n + v, 0)).toBe(s.subtotal);
    expect(s.byTrade.reduce((n, [, v]) => n + v, 0)).toBe(s.subtotal);
    expect(s.rooms).toBe(3);
  });
  it("lists the five biggest lines, largest first", () => {
    expect(s.top.map((r) => r.amount)).toEqual([150_000, 100_000, 12_460, 500]);
  });
  it("reports provisional / unverified rates and estimated quantities", () => {
    expect(s.unverifiedRates).toHaveLength(2);
    expect(s.estimated).toHaveLength(1);
  });
  it("counts lines by scope status (default NEW)", () => {
    expect(s.byStatus).toMatchObject({ NEW: 3, REFURBISH: 1 });
  });
});

import { exportBlocker } from "@/lib/boq/review";
describe("exportBlocker", () => {
  it("spec-mode BOQs (no scope) are never blocked", () => expect(exportBlocker(undefined)).toBeNull());
  it("an unapproved scope blocks export", () => expect(exportBlocker({ approved: false, items: [] })).toMatch(/Approve/));
  it("an UNCONFIRMED item blocks even an approved scope", () =>
    expect(exportBlocker({ approved: true, items: [{ status: "UNCONFIRMED" }] })).toMatch(/UNCONFIRMED/));
  it("an approved, fully confirmed scope exports", () =>
    expect(exportBlocker({ approved: true, items: [{ status: "RETAIN" }, { status: "NEW" }, {}] })).toBeNull());
});

import { budgetView } from "@/lib/boq/review";
describe("budgetView", () => {
  const rows = [
    row({ room: "Kitchen", title: "Kitchen", qty: 100, rate: 3000 }),
    row({ room: "Living", title: "TV", qty: 50, rate: 1000 }),
    row({ room: "Dining", title: "Crockery", qty: 10, rate: 1000, provisional: true }),
    row({ room: "Master Bedroom", title: "Wardrobe", qty: 10, rate: 1000, qtySource: "estimated" }),
  ];
  it("no budget → no comparison", () => expect(budgetView(rows, undefined).over).toBeNull());
  it("reports the gap to the client's budget, never changes a number", () => {
    const v = budgetView(rows, 300_000);
    expect(v.total).toBe(370_000);
    expect(v.difference).toBe(70_000);
    expect(v.over).toBe(true);
    expect(v.pct).toBeCloseTo(23.3, 1);
    expect(budgetView(rows, 500_000)).toMatchObject({ over: false, difference: -130_000 });
  });
  it("lists the biggest drivers and the uncertain money (provisional / assumed)", () => {
    const v = budgetView(rows, 300_000);
    expect(v.drivers[0]).toMatchObject({ title: "Kitchen", amount: 300_000 });
    expect(v.provisionalTotal).toBe(10_000);
    expect(v.assumedTotal).toBe(10_000);
  });
  it("flags a room far above the average room (relative, not a fixed ceiling)", () => {
    expect(budgetView(rows, 300_000).highRooms.map((r) => r.room)).toEqual(["Kitchen"]);
    expect(budgetView([row({ room: "A", qty: 1, rate: 100 }), row({ room: "B", qty: 1, rate: 100 })], 1).highRooms).toEqual([]);
  });
});
