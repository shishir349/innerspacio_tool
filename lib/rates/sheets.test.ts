import { describe, expect, it } from "vitest";
import { buildBoq, summarizeBoq } from "@/lib/boq/build";
import { quantify, quantifyRequestSchema, type BriefItem, type PlanRoom } from "@/lib/boq/brief";
import { findRate, RATE_CARD } from "@/lib/rates/catalog";
import { livspaceModular, resolveRate } from "@/lib/rates/sheets";

const room: PlanRoom = { id: "r", name: "Master", boqRoom: "Master Bedroom", l: 12, b: 14, h: 10, source: "labelled" };
const base = { tier: "premium" as const, city: "Delhi", homeCare: false };
const rate = (p: Partial<BriefItem>): BriefItem => ({
  room: "Master Bedroom", requirement: "req", kind: "rate", basis: "count", ...p,
});

describe("rate sheet resolution", () => {
  it("spazay is the card rate; livspace strips 18% GST; both bills Spazay and keeps the reference", () => {
    expect(resolveRate("pt:PT03", 56, "spazay")).toEqual({ rate: 56, source: "spazay" });
    expect(resolveRate("pt:PT03", 56, "livspace")).toEqual({ rate: Math.round(28 / 1.18), source: "livspace" });
    expect(resolveRate("pt:PT03", 56, "both")).toEqual({ rate: 56, source: "spazay", alt: Math.round(28 / 1.18) });
  });

  it("an id with no verified Livspace equivalent falls back to Spazay and says so", () => {
    expect(resolveRate("lf:LFE02", 34413, "livspace")).toEqual({ rate: 34413, source: "spazay" });
    expect(resolveRate("lf:LFE02", 34413, "both").alt).toBeUndefined();
  });

  it("every mapped Livspace id exists on the card in the same unit family", () => {
    for (const id of ["pt:PT02", "pt:PT03", "pt:PT04", "pt:PT08", "pt:PT12", "fc:FC01", "fc:FC02", "el:EL30", "el:EL31", "el:EL02", "cv:CV22", "cv:CV07", "wp:WP01"]) {
      expect(findRate(id), id).toBeDefined();
      expect(resolveRate(id, 100, "livspace").source).toBe("livspace");
    }
  });

  it("allowances are on the card, provisional, and positive", () => {
    const al = RATE_CARD.filter((r) => r.provisional);
    expect(al.map((r) => r.id).sort()).toEqual(["al:CURTAIN", "al:JACUZZI", "al:NAMEPLATE", "al:RAILING", "al:SOFA2", "al:SOFAL", "al:VGARDEN"]);
    for (const r of al) expect(r.rate).toBeGreaterThan(0);
  });

  it("livspace modular uses one all-in rate; unknown units use the wardrobe rate", () => {
    expect(livspaceModular("Kitchen Base Unit").rate).toBe(Math.round(3375 / 1.18));
    expect(livspaceModular("TV Unit").rate).toBe(Math.round(2500 / 1.18));
  });
});

describe("sheet applied to a BOQ", () => {
  const items = [rate({ rateId: "pt:PT03", basis: "wall_area" }), rate({ rateId: "lf:LFE02", count: 1 })];

  it("livspace reprices mapped lines only and tags the source per line", () => {
    const sp = quantify(items, [room], { ...base, sheet: "spazay" }).lines;
    const ls = quantify(items, [room], { ...base, sheet: "livspace" }).lines;
    const paint = (l: typeof sp) => l.find((x) => x.rateId === "pt:PT03")!;
    expect(paint(ls).rate).toBeLessThan(paint(sp).rate);
    expect(paint(ls).rateSource).toBe("livspace");
    expect(ls.find((x) => x.rateId === "lf:LFE02")!.rateSource).toBe("spazay");
    expect(ls.find((x) => x.rateId === "lf:LFE02")!.rate).toBe(sp.find((x) => x.rateId === "lf:LFE02")!.rate);
  });

  it("both bills exactly what spazay bills and adds the reference rate", () => {
    const sp = quantify(items, [room], { ...base, sheet: "spazay" }).lines;
    const both = quantify(items, [room], { ...base, sheet: "both" }).lines;
    expect(summarizeBoq(both).total).toBe(summarizeBoq(sp).total);
    expect(both.find((x) => x.rateId === "pt:PT03")!.altRate).toBeGreaterThan(0);
  });

  it("a modular unit is one all-in line (carcass + shutter + hardware) on every sheet", () => {
    const m = [rate({ kind: "modular", item: "Wardrobe", basis: "elevation", width: 8, height: 7 })];
    const sp = quantify(m, [room], { ...base, sheet: "spazay" }).lines;
    expect(sp).toHaveLength(1);
    expect(sp[0].qty).toBe(56);
    expect(sp[0].rate).toBe(1152 + 950 + 467); // premium: C06 + S04 + H02
    expect(sp[0].description).toMatch(/carcass, .* shutters\/fronts and Hettich/);
    const ls = quantify(m, [room], { ...base, sheet: "livspace" }).lines;
    expect(ls).toHaveLength(1);
    expect(ls[0].qty).toBe(56);
    expect(ls[0].amount).toBeCloseTo(ls[0].qty * ls[0].rate, 2);
  });

  it("the public-quote engine is untouched: no sheet means Spazay", () => {
    const input = { bhk: "3" as const, city: "Delhi", tier: "premium" as const, rooms: [{ roomType: "living_room" as const }] };
    expect(buildBoq(input)).toEqual(buildBoq({ ...input, sheet: "spazay" }));
    for (const l of buildBoq(input)) expect(l.rateSource).toBe("spazay");
  });

  it("request schema defaults to spazay and rejects an unknown sheet", () => {
    const ok = quantifyRequestSchema.safeParse({ tier: "premium", city: "Delhi", rooms: [], items: [] });
    expect(ok.success && ok.data.sheet).toBe("spazay");
    expect(quantifyRequestSchema.safeParse({ tier: "premium", city: "Delhi", sheet: "x", rooms: [], items: [] }).success).toBe(false);
  });
});
