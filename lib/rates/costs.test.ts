import { describe, expect, it } from "vitest";
import {
  COST_COMPONENTS,
  CostPolicyError,
  costBreakdown,
  internalCost,
  reconcileWithCard,
  sellingFromCost,
  sellingRate,
} from "@/lib/rates/costs";
import { RATE_CARD } from "@/lib/rates/catalog";

const table = { "t:A": { material: 60, labour: 30, hardware: 10 }, "t:B": { material: 50, labour: 20, hardware: 10, installation: 20 } };

describe("margin policy", () => {
  it("margin is not markup: 40% margin on 100 is 166.67, 40% markup is 140", () => {
    expect(sellingFromCost(100, { basis: "margin", percent: 40 })).toBe(166.67);
    expect(sellingFromCost(100, { basis: "markup", percent: 40 })).toBe(140);
  });
  it("0% leaves cost unchanged and bad policies are rejected", () => {
    expect(sellingFromCost(100, { basis: "margin", percent: 0 })).toBe(100);
    expect(() => sellingFromCost(100, { basis: "margin", percent: 100 })).toThrow(CostPolicyError);
    expect(() => sellingFromCost(100, { basis: "markup", percent: -5 })).toThrow(CostPolicyError);
    expect(() => sellingFromCost(-1, { basis: "margin", percent: 10 })).toThrow(CostPolicyError);
    expect(() => sellingFromCost(NaN, { basis: "margin", percent: 10 })).toThrow(CostPolicyError);
  });
});

describe("cost breakdown is never invented", () => {
  it("no card rate has a breakdown until a verified row is added", () => {
    expect(Object.keys(COST_COMPONENTS)).toHaveLength(0);
    for (const r of RATE_CARD) {
      const b = costBreakdown(r.id);
      expect(b.available, r.id).toBe(false);
      if (!b.available) expect(b.missing).toHaveLength(4);
    }
  });
  it("reports which components are unknown instead of treating them as zero", () => {
    const b = costBreakdown("t:A", table);
    expect(b.available && b.cost).toBe(100);
    expect(b.available && b.missing).toEqual(["installation"]);
  });
});

describe("consolidated selling rate", () => {
  const policy = { basis: "margin", percent: 40 } as const;
  it("keeps the card rate with no policy, no row, or an incomplete row", () => {
    expect(sellingRate("t:B", 999, null, table)).toEqual({ rate: 999, derived: false });
    expect(sellingRate("t:none", 999, policy, table)).toEqual({ rate: 999, derived: false });
    expect(sellingRate("t:A", 999, policy, table)).toEqual({ rate: 999, derived: false });
  });
  it("derives one consolidated rate from a complete row and a policy", () => {
    expect(sellingRate("t:B", 999, policy, table)).toEqual({ rate: 167, derived: true });
  });
  it("reconciles a derived rate with the card and returns null when it cannot derive", () => {
    expect(reconcileWithCard("t:B", 150, policy, table)).toMatchObject({ derived: 167, card: 150, delta: 17 });
    expect(reconcileWithCard("t:A", 150, policy, table)).toBeNull();
  });
});

describe("internalCost", () => {
  it("sums only lines with a breakdown and counts the rest", () => {
    const r = internalCost([{ rateId: "t:B", qty: 10 }, { rateId: "t:none", qty: 5 }, { qty: 1 }], table);
    expect(r).toEqual({ cost: 1000, linesWithBreakdown: 1, linesWithout: 2 });
  });
  it("is all-unavailable for the real card today", () => {
    expect(internalCost([{ rateId: "mod:C06", qty: 100 }]).linesWithBreakdown).toBe(0);
  });
});
