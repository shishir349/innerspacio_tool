import { describe, expect, it } from "vitest";
import { buildBoq, cityFactor, cityNote, summarizeBoq, type BoqInput } from "@/lib/boq/build";
import { tierScale } from "@/lib/boq/classes";
import { BOQ_ITEMS, BOQ_ROOMS, BOQ_TRADES, BOQ_UOMS } from "@/lib/boq/lists";
import { RATE_CARD, getRate } from "@/lib/rates/catalog";
import { LIVSPACE_NCR } from "@/lib/rates/livspace-benchmarks";
import { BHK_ROOM_DEFAULTS, PACKAGE_TIERS, type Bhk, type QuoteRoomType } from "@/lib/quote/constants";

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

  const fullHome = (bhk: Bhk, tier: (typeof PACKAGE_TIERS)[number], homeSize?: "small" | "large", city = "Delhi"): BoqInput => ({
    bhk,
    homeSize,
    city,
    tier,
    rooms: Object.entries(BHK_ROOM_DEFAULTS[bhk]).flatMap(([roomType, n]) =>
      Array.from({ length: n ?? 0 }, () => ({ roomType: roomType as QuoteRoomType }))
    ),
  });
  const total = (i: BoqInput) => summarizeBoq(buildBoq(i)).total;
  const BHKS = ["1", "2", "3", "4", "5+"] as const;

  it("prices at the Spazay card: a modular line is the card's carcass + shutter + hardware, no multiplier", () => {
    const wardrobe = (tier: (typeof PACKAGE_TIERS)[number]) => buildBoq({ ...threeBhk, city: "Delhi", tier }).find((l) => l.item === "Wardrobe")!;
    expect(wardrobe("premium").rate).toBe(getRate("mod:C06").rate + getRate("mod:S04").rate + getRate("mod:H02").rate);
    expect(wardrobe("essential").rate).toBe(getRate("mod:C01").rate + getRate("mod:S01").rate + getRate("mod:H01").rate);
    expect(wardrobe("luxury").rate).toBe(getRate("mod:C09").rate + getRate("mod:S05").rate + getRate("mod:H02").rate);
  });

  it("every non-modular line carries exactly the card rate", () => {
    for (const l of buildBoq({ ...threeBhk, city: "Delhi" })) {
      if (l.rateId === "mod:unit") continue;
      expect(l.rate, l.rateId).toBe(getRate(l.rateId).rate);
    }
  });

  it("spec mode and plan mode agree on the same item: modular wardrobe within 5% at every tier", () => {
    for (const tier of PACKAGE_TIERS) {
      const spec = buildBoq({ ...threeBhk, city: "Delhi", tier }).find((l) => l.item === "Wardrobe")!.rate;
      const plan = getRate("pr:WARDROBE").rate * tierScale(tier);
      expect(Math.abs(spec - plan) / spec, `${tier} spec ${spec} vs plan ${Math.round(plan)}`).toBeLessThan(0.05);
    }
  });

  it("tier changes specification and scope, not a price multiplier", () => {
    const ids = (tier: (typeof PACKAGE_TIERS)[number]) => new Set(buildBoq({ ...threeBhk, tier }).map((l) => l.rateId));
    expect(ids("premium")).not.toEqual(ids("essential"));
    const paint = (tier: (typeof PACKAGE_TIERS)[number]) => buildBoq({ ...threeBhk, tier }).find((l) => l.trade === "Paint & Polish" && l.item === "Paint")!.rateId;
    expect(new Set(PACKAGE_TIERS.map(paint)).size).toBe(3);
  });

  it("tiers and BHKs are strictly ordered", () => {
    for (const bhk of BHKS) {
      const [e, p, l] = PACKAGE_TIERS.map((t) => total(fullHome(bhk, t)));
      expect(e).toBeLessThan(p);
      expect(p).toBeLessThan(l);
    }
    for (const tier of PACKAGE_TIERS) {
      const t = BHKS.map((b) => total(fullHome(b, tier)));
      for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    }
  });

  it("fewer rooms cost less, extra rooms cost more", () => {
    const full = fullHome("3", "premium");
    expect(total({ ...full, rooms: full.rooms.slice(0, 4) })).toBeLessThan(total(full));
    expect(total({ ...full, rooms: [...full.rooms, { roomType: "bedroom" }] })).toBeGreaterThan(total(full));
  });

  it("no city factor without a verified policy; non-NCR cities are flagged, not silently scaled", () => {
    const full = fullHome("3", "premium");
    expect(total({ ...full, city: "Indore" })).toBe(total(full));
    expect(cityFactor("Mumbai")).toBe(1);
    expect(cityNote("Indore")).toMatch(/NCR card/);
    expect(cityNote("Delhi")).toBeNull();
  });

  it("every line is still qty x rate after calibration", () => {
    for (const l of buildBoq(fullHome("4", "luxury"))) expect(l.amount).toBeCloseTo(l.qty * l.rate, 0);
  });

  it("assigns rooms to the reference room list in order (master first)", () => {
    const rooms = new Set(buildBoq(threeBhk).map((l) => l.room));
    expect(rooms).toContain("Master Bedroom");
    expect(rooms).toContain("Kids Room");
    expect(rooms).toContain("Guest / Parents Bedroom");
    expect(rooms).toContain("Master Bathroom");
    expect(rooms).toContain("Others / Whole Home Civil");
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
