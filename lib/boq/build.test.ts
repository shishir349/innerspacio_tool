import { describe, expect, it } from "vitest";
import { buildBoq, summarizeBoq, type BoqInput } from "@/lib/boq/build";
import { BOQ_ITEMS, BOQ_ROOMS, BOQ_TRADES, BOQ_UOMS } from "@/lib/boq/lists";
import { RATE_CARD, getRate } from "@/lib/rates/catalog";
import { LIVSPACE_NCR } from "@/lib/rates/livspace-benchmarks";
import { PACKAGE_TIERS, TIER_RANGE_LAKH } from "@/lib/quote/constants";

const threeBhk: BoqInput = {
  bhk: "3",
  homeSize: "small",
  city: "Delhi",
  tier: "premium",
  rooms: [
    "living_room",
    "dining_room",
    "kitchen",
    "bedroom",
    "bedroom",
    "bedroom",
    "bathroom",
    "bathroom",
    "bathroom",
  ].map((roomType) => ({ roomType })) as BoqInput["rooms"],
};

describe("rate card", () => {
  it("has unique ids and positive rates", () => {
    const ids = RATE_CARD.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RATE_CARD) expect(r.rate).toBeGreaterThan(0);
  });

  it("only uses units/trades the reference workbook allows", () => {
    for (const r of RATE_CARD) {
      expect(BOQ_UOMS).toContain(r.uom);
      expect(BOQ_TRADES).toContain(r.trade);
    }
  });

  it("throws on an unknown id", () => {
    expect(() => getRate("nope:X00")).toThrow();
  });
});

describe("buildBoq", () => {
  it("amount = qty × rate on every line and uses frozen vocab", () => {
    for (const tier of PACKAGE_TIERS) {
      for (const l of buildBoq({ ...threeBhk, tier })) {
        expect(l.amount).toBeCloseTo(l.qty * l.rate, 2);
        expect(l.qty).toBeGreaterThan(0);
        expect(BOQ_ROOMS).toContain(l.room);
        expect(BOQ_TRADES).toContain(l.trade);
        expect(BOQ_ITEMS).toContain(l.item);
        expect(BOQ_UOMS).toContain(l.uom);
        expect(l.rateId).toBeTruthy();
      }
    }
  });

  it("is deterministic", () => {
    expect(buildBoq(threeBhk)).toEqual(buildBoq(threeBhk));
  });

  it("essential < premium < luxury for the same home", () => {
    const [e, p, l] = PACKAGE_TIERS.map((tier) => summarizeBoq(buildBoq({ ...threeBhk, tier })).total);
    expect(e).toBeLessThan(p);
    expect(p).toBeLessThan(l);
  });

  it("more rooms or a bigger home never lowers the total", () => {
    const base = summarizeBoq(buildBoq(threeBhk)).total;
    const extra = summarizeBoq(
      buildBoq({ ...threeBhk, rooms: [...threeBhk.rooms, { roomType: "bedroom" }] })
    ).total;
    const bigger = summarizeBoq(buildBoq({ ...threeBhk, bhk: "4", homeSize: "large" })).total;
    expect(extra).toBeGreaterThan(base);
    expect(bigger).toBeGreaterThanOrEqual(base);
  });

  it("a typical 2 BHK essential / premium lands inside their bands", () => {
    const twoBhk: BoqInput = {
      ...threeBhk,
      bhk: "2",
      homeSize: undefined,
      rooms: ["living_room", "dining_room", "kitchen", "bedroom", "bedroom", "bathroom", "bathroom"].map(
        (roomType) => ({ roomType })
      ) as BoqInput["rooms"],
    };
    for (const tier of ["essential", "premium"] as const) {
      const lakh = summarizeBoq(buildBoq({ ...twoBhk, tier })).total / 1e5;
      const { min, max } = TIER_RANGE_LAKH[tier];
      expect(lakh, `${tier} = ${lakh.toFixed(1)}L`).toBeGreaterThanOrEqual(min);
      expect(lakh, `${tier} = ${lakh.toFixed(1)}L`).toBeLessThanOrEqual(max);
    }
  });

  it("a full 3 BHK premium / luxury lands inside their bands", () => {
    for (const tier of ["premium", "luxury"] as const) {
      const lakh = summarizeBoq(buildBoq({ ...threeBhk, tier })).total / 1e5;
      const { min, max } = TIER_RANGE_LAKH[tier];
      expect(lakh, `${tier} = ${lakh.toFixed(1)}L`).toBeGreaterThanOrEqual(min);
      expect(lakh, `${tier} = ${lakh.toFixed(1)}L`).toBeLessThanOrEqual(max);
    }
  });

  it("assigns rooms to the reference room list in order (master first)", () => {
    const rooms = new Set(buildBoq(threeBhk).map((l) => l.room));
    expect(rooms).toContain("Master Bedroom");
    expect(rooms).toContain("Kids Room");
    expect(rooms).toContain("Guest / Parents Bedroom");
    expect(rooms).toContain("Master Bathroom");
    expect(rooms).toContain("Others / Whole Home Civil");
  });

  it("applies the city factor to rates, not quantities", () => {
    const ncr = buildBoq({ ...threeBhk, city: "Delhi" });
    const tier2 = buildBoq({ ...threeBhk, city: "Indore" });
    expect(tier2.length).toBe(ncr.length);
    expect(summarizeBoq(tier2).total).toBeLessThan(summarizeBoq(ncr).total);
  });

  it("never throws or yields NaN on odd input", () => {
    const lines = buildBoq({ bhk: "5+", homeSize: "large", city: "", tier: "luxury", rooms: [] });
    for (const l of lines) expect(Number.isFinite(l.amount)).toBe(true);
    expect(Number.isFinite(summarizeBoq(lines).total)).toBe(true);
  });
});

describe("benchmark vs Livspace NCR", () => {
  const modular = (carcass: string, shutter: string, hardware: string) =>
    getRate(carcass).rate + getRate(shutter).rate + getRate(hardware).rate;

  it("Spazay-built modular ₹/sq ft stays within ±30% of Livspace standard (ex-GST)", () => {
    const livExGst = LIVSPACE_NCR.swingWardrobe.price / 1.18;
    // Premium spec: HDHMR (Action Tesa) carcass + Royal Touch shutter + Hettich.
    const premium = modular("mod:C06", "mod:S04", "mod:H02");
    expect(premium / livExGst).toBeGreaterThan(0.7);
    expect(premium / livExGst).toBeLessThan(1.3);
    // Essential spec sits below the Livspace standard.
    expect(modular("mod:C01", "mod:S01", "mod:H01")).toBeLessThan(livExGst * 1.0);
  });

  it("non-modular trades stay within a sane band of Livspace", () => {
    const pairs: [string, number][] = [
      ["fc:FC01", LIVSPACE_NCR.gypsumCeilingPlain.price],
      ["pt:PT03", LIVSPACE_NCR.freshPaintPremium.price],
      ["cv:CV04", LIVSPACE_NCR.vitrifiedFloorTile.price],
      ["wp:WP01", LIVSPACE_NCR.laminateWallPanelling.price],
    ];
    for (const [id, liv] of pairs) {
      const ratio = getRate(id).rate / liv;
      expect(ratio, id).toBeGreaterThan(0.5);
      expect(ratio, id).toBeLessThan(2.2);
    }
  });
});
