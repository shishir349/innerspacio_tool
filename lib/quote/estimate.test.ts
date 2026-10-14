import { describe, expect, it } from "vitest";
import { estimateAllTiers, estimateForTier, explainEstimate, formatRange } from "@/lib/quote/estimate";
import { PACKAGE_TIERS, TIER_RANGE_LAKH } from "@/lib/quote/constants";

const base = {
  bhk: "2" as const,
  city: "Pune",
  rooms: { living_room: 1, kitchen: 1, bedroom: 2, bathroom: 2 },
};

describe("quote estimate (BOQ-backed)", () => {
  it("low < high, positive, half-lakh rounded", () => {
    for (const bhk of ["1", "2", "3", "4", "5+"] as const) {
      for (const tier of PACKAGE_TIERS) {
        const e = estimateForTier({ ...base, bhk }, tier);
        expect(e.lowLakh).toBeGreaterThan(0);
        expect(e.lowLakh).toBeLessThan(e.highLakh);
        expect(e.lowLakh * 2).toBe(Math.round(e.lowLakh * 2));
      }
    }
  });

  it("tiers are ordered essential < premium < luxury", () => {
    const [e, p, l] = estimateAllTiers(base);
    expect(e.highLakh).toBeLessThan(p.highLakh);
    expect(p.highLakh).toBeLessThan(l.highLakh);
  });

  it("is monotonic: more rooms never lowers the estimate", () => {
    const small = estimateForTier(base, "premium");
    const more = estimateForTier({ ...base, rooms: { ...base.rooms, bedroom: 4 } }, "premium");
    expect(more.highLakh).toBeGreaterThan(small.highLakh);
  });

  it("never NaN on odd input, empty rooms are free", () => {
    const e = estimateForTier(
      { bhk: "5+", homeSize: "large", city: "Mumbai", rooms: { kitchen: 99, bedroom: NaN } },
      "luxury"
    );
    expect(Number.isFinite(e.lowLakh)).toBe(true);
    expect(Number.isFinite(e.highLakh)).toBe(true);
    expect(estimateForTier({ bhk: "1", city: "", rooms: {} }, "essential").lowLakh).toBeGreaterThanOrEqual(0);
  });

  it("a 2 BHK essential lands in the published essential band", () => {
    const e = estimateForTier({ ...base, rooms: { ...base.rooms, dining_room: 1 } }, "essential");
    const mid = (e.lowLakh + e.highLakh) / 2;
    expect(mid).toBeGreaterThanOrEqual(TIER_RANGE_LAKH.essential.min);
    expect(mid).toBeLessThanOrEqual(TIER_RANGE_LAKH.essential.max);
  });

  it("formats a range", () => {
    expect(formatRange({ lowLakh: 17.5, highLakh: 20 })).toBe("₹17.5L – ₹20L");
  });
});

describe("explainEstimate", () => {
  const ex = explainEstimate(base, "premium");

  it("shares add up to ~100% and nothing internal leaks", () => {
    const sum = ex.byTrade.reduce((n, t) => n + t.pct, 0);
    expect(sum).toBeGreaterThan(85);
    expect(sum).toBeLessThanOrEqual(101);
    expect(ex.byRoom.length).toBeGreaterThan(0);
    expect(ex.highlights.length).toBeGreaterThan(0);
    const json = JSON.stringify(ex).toLowerCase();
    for (const bad of ["margin", "supplier", "cost_price", "markup"]) expect(json).not.toContain(bad);
  });

  it("states its assumptions", () => {
    expect(ex.assumptions.join(" ")).toMatch(/carpet area/);
    expect(ex.carpetSqFt).toBe(950);
  });
});
