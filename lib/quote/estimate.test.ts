import { describe, expect, it } from "vitest";
import { estimateAllTiers, estimateForTier, formatRange, quoteScore } from "@/lib/quote/estimate";
import { PACKAGE_TIERS, TIER_RANGE_LAKH } from "@/lib/quote/constants";

const base = {
  bhk: "2" as const,
  city: "Pune",
  rooms: { living_room: 1, kitchen: 1, bedroom: 2, bathroom: 2 },
};

describe("quote estimate", () => {
  it("stays inside each tier range and low < high", () => {
    for (const bhk of ["1", "2", "3", "4", "5+"] as const) {
      for (const tier of PACKAGE_TIERS) {
        const e = estimateForTier({ ...base, bhk }, tier);
        const { min, max } = TIER_RANGE_LAKH[tier];
        expect(e.lowLakh).toBeGreaterThanOrEqual(min);
        expect(e.highLakh).toBeLessThanOrEqual(max);
        expect(e.lowLakh).toBeLessThan(e.highLakh);
      }
    }
  });

  it("is monotonic: more rooms / bigger BHK never lowers the estimate", () => {
    const small = estimateForTier(base, "premium");
    const moreRooms = estimateForTier({ ...base, rooms: { ...base.rooms, bedroom: 4 } }, "premium");
    const bigger = estimateForTier({ ...base, bhk: "4" }, "premium");
    expect(moreRooms.highLakh).toBeGreaterThanOrEqual(small.highLakh);
    expect(bigger.highLakh).toBeGreaterThanOrEqual(small.highLakh);
  });

  it("score is clamped 0..1 and never NaN on odd input", () => {
    const s = quoteScore({
      bhk: "5+",
      homeSize: "large",
      city: "Mumbai",
      rooms: { kitchen: 99, bedroom: NaN },
    });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(1);
    expect(Number.isNaN(quoteScore({ bhk: "1", city: "", rooms: {} }))).toBe(false);
  });

  it("covers all three tiers and formats a range", () => {
    expect(estimateAllTiers(base)).toHaveLength(3);
    expect(formatRange({ lowLakh: 17.5, highLakh: 20 })).toBe("₹17.5L – ₹20L");
  });

  it("no dead zone: luxury starts exactly where premium ends", () => {
    expect(TIER_RANGE_LAKH.premium.max).toBe(TIER_RANGE_LAKH.luxury.min);
  });
});
