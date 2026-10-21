import { describe, expect, it } from "vitest";
import { printModel } from "@/lib/boq/print";
import { boqStatus } from "@/lib/boq/revisions";

const line = (o: Record<string, unknown> = {}) => ({ room: "Living", trade: "Wall Panelling", item: "Panel", title: "Feature wall", description: "d", uom: "Sq.Ft.", qty: 10, rate: 100, ...o });
const payload = {
  lines: [line(), line({ room: "Kitchen", title: "Kitchen", qty: 2, rate: 1000, qtySource: "estimated" }), line({ room: "Kitchen", title: "Jacuzzi", qty: 1, rate: 500, provisional: true })],
  scope: {
    approved: true,
    items: [
      { room: "Dining", requirement: "dining table", status: "EXCLUDED" },
      { room: "Master Bedroom", requirement: "existing bed", status: "RETAIN" },
      { room: "Master Bedroom", requirement: "bed upholstery", status: "REFURBISH", rateId: "wp:WP32" },
      { room: "Kitchen", requirement: "civil modifications", status: "UNCONFIRMED" },
      { room: "Kitchen", requirement: "modular kitchen", status: "NEW" },
    ],
  },
  revision: 2,
};
const meta = { title: "Karan — BOQ", project: "Cleo County", location: "Noida", tier: "Premium", updatedAt: "2026-10-19T00:00:00Z" };
const m = printModel(payload as never, meta);

describe("printModel", () => {
  it("totals reconcile: line amounts = room subtotals = grand total", () => {
    expect(m.total).toBe(10 * 100 + 2 * 1000 + 500);
    expect(m.rooms.reduce((n, r) => n + r.subtotal, 0)).toBe(m.total);
    expect(m.rooms.flatMap((r) => r.lines).reduce((n, l) => n + l.amount, 0)).toBe(m.total);
  });
  it("lists what is included, excluded, retained, refurbished and unresolved", () => {
    expect(m.excluded).toEqual(["Dining · dining table"]);
    expect(m.retained).toEqual(["Master Bedroom · existing bed"]);
    expect(m.refurbish).toEqual(["Master Bedroom · bed upholstery"]);
    expect(m.included).toEqual(["Kitchen · modular kitchen"]);
    expect(m.unresolved).toEqual(["Kitchen · civil modifications"]);
  });
  it("flags provisional rates and estimated quantities, and states the revision and status", () => {
    expect(m.provisional).toEqual(["Kitchen · Jacuzzi"]);
    expect(m.estimated).toBe(1);
    expect(m.revision).toBe(2);
    expect(m.statusLabel).toBe("Revised — not approved");
    expect(printModel({ ...payload, finalApproved: { at: "2026-10-19T00:00:00Z", by: "u" } } as never, meta).statusLabel).toMatch(/^Approved/);
    expect(boqStatus(payload as never)).toBe("revised");
  });
  it("does not invent a tax: it only says GST is extra", () => {
    expect(m.taxNote).toMatch(/GST/);
    expect(m.finalTotal).toBe(m.total);
  });
});
