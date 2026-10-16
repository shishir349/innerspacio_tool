import { describe, expect, it } from "vitest";
import { buildBoq, type BoqInput } from "@/lib/boq/build";
import { sanityChecks, validateBoq, type CheckLine } from "@/lib/boq/validate";
import { BHK_ROOM_DEFAULTS, PACKAGE_TIERS, type Bhk, type QuoteRoomType } from "@/lib/quote/constants";

const line = (p: Partial<CheckLine> = {}): CheckLine => ({
  room: "Living", trade: "False Ceiling", item: "False Ceiling", rateId: "fc:FC02", uom: "Sq.Ft.", l: 10, b: 10, qty: 100, rate: 167, ...p,
});
const msgs = (l: CheckLine[]) => validateBoq(l).map((i) => i.message);

describe("validateBoq", () => {
  it("a clean line has no issues", () => {
    expect(validateBoq([line({ rate: 200 })]).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("flags bad units, zero / negative / NaN quantity and rate as errors", () => {
    const issues = validateBoq([line({ uom: "yards" }), line({ qty: 0 }), line({ rate: -1 }), line({ qty: NaN })]);
    expect(issues.filter((i) => i.severity === "error").length).toBeGreaterThanOrEqual(4);
  });

  it("flags implausible dimensions and quantities", () => {
    expect(msgs([line({ l: 400, b: 10, qty: 4000 })]).some((m) => /implausible/.test(m))).toBe(true);
    expect(msgs([line({ qty: 9000, l: null, b: null })]).some((m) => /very large/.test(m))).toBe(true);
  });

  it("flags a quantity that does not fit its dimensions, but allows deductions for openings", () => {
    expect(msgs([line({ qty: 150 })]).some((m) => /does not fit/.test(m))).toBe(true);
    expect(msgs([line({ qty: 85 })]).some((m) => /does not fit/.test(m))).toBe(false);
  });

  it("flags full-wall paint with no opening deduction", () => {
    const paint = line({ trade: "Paint & Polish", item: "Paint", rateId: "pt:PT03", l: 50, b: null, h: 10, qty: 500, rate: 56 });
    expect(msgs([paint]).some((m) => /no deduction/.test(m))).toBe(true);
    expect(msgs([{ ...paint, qty: 425 }]).some((m) => /no deduction/.test(m))).toBe(false);
  });

  it("flags duplicate lines, a rate far from the card, provisional lines and rate notes", () => {
    expect(msgs([line(), line()]).some((m) => /duplicate of line 1/.test(m))).toBe(true);
    expect(msgs([line({ rate: 900 })]).some((m) => /differs from the card/.test(m))).toBe(true);
    expect(msgs([line({ provisional: true })]).some((m) => /provisional/.test(m))).toBe(true);
    expect(msgs([line({ rateNote: "No verified Livspace rate" })])).toContain("False Ceiling (Living): No verified Livspace rate");
  });

  it("counts estimated quantities", () => {
    expect(msgs([line({ qtySource: "estimated" })]).some((m) => /standard-size estimates/.test(m))).toBe(true);
    expect(msgs([line({ qtySource: "measured" })]).some((m) => /standard-size estimates/.test(m))).toBe(false);
  });

  it("never reports an error or duplicate on a generated spec-mode BOQ, and tags every line estimated", () => {
    for (const bhk of ["1", "2", "3", "4", "5+"] as Bhk[]) {
      for (const tier of PACKAGE_TIERS) {
        const rooms = Object.entries(BHK_ROOM_DEFAULTS[bhk]).flatMap(([roomType, n]) =>
          Array.from({ length: n ?? 0 }, () => ({ roomType: roomType as QuoteRoomType }))
        );
        const lines = buildBoq({ bhk, tier, city: "Delhi", rooms } as BoqInput);
        const issues = validateBoq(lines);
        expect(issues.filter((i) => i.severity === "error" || /duplicate|does not fit|implausible|very large|no deduction/.test(i.message)), `${bhk} ${tier}`).toEqual([]);
        expect(lines.every((l) => l.qtySource === "estimated")).toBe(true);
      }
    }
  });
});

describe("sanityChecks (warnings only)", () => {
  it("passes inside both reference ranges", () => {
    expect(sanityChecks({ total: 2_000_000, area: 1250, bhk: "3", tier: "premium" })).toEqual([]);
  });
  it("warns per sq ft and per tier band without changing anything", () => {
    const w = sanityChecks({ total: 9_000_000, area: 1250, bhk: "3", tier: "premium" });
    expect(w.length).toBe(2);
    expect(w.every((i) => i.severity === "warn" && /unverified/.test(i.message))).toBe(true);
  });
  it("is silent without an area or total", () => {
    expect(sanityChecks({ total: 0, area: 1250, bhk: "3", tier: "premium" })).toEqual([]);
    expect(sanityChecks({ total: 1, area: 0, bhk: "3", tier: "premium" })).toEqual([]);
  });
});
