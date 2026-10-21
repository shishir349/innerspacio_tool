import { describe, expect, it } from "vitest";
import { briefItemSchema, quantify, type BriefItem } from "@/lib/boq/brief";
import { briefResponse } from "@/lib/boq/brief-response";
import { summarizeBoq } from "@/lib/boq/build";
import { CLEO_ROOMS } from "@/lib/boq/fixtures/cleo-county";

const opts = { tier: "premium" as const, city: "Noida", homeCare: false };
const mk = (room: BriefItem["room"], requirement: string, o: Partial<BriefItem> = {}): BriefItem =>
  ({ room, requirement, kind: "rate", basis: "area", status: "NEW", ...o }) as BriefItem;
const run = (items: BriefItem[]) => quantify(items, CLEO_ROOMS, opts);
const total = (items: BriefItem[]) => summarizeBoq(run(items).lines).total;

const newBed = mk("Master Bedroom", "king bed", { rateId: "lf:LFE08", count: 1 });
const dining = mk("Dining", "dining table", { rateId: "lf:LFE06", count: 1 });
const shower = mk("Master Bathroom", "shower partition", { unit: "shower_partition", basis: "elevation" });

describe("scope status", () => {
  it("defaults to NEW and rejects unknown statuses to NEW", () => {
    expect(briefItemSchema.parse({ room: "Dining", requirement: "x", kind: "rate", basis: "area" }).status ?? "NEW").toBe("NEW");
    expect(briefItemSchema.parse({ room: "Dining", requirement: "x", kind: "rate", basis: "area", status: "maybe" }).status).toBe("NEW");
  });

  it("an EXCLUDED dining table never reaches the BOQ or the total", () => {
    const base = total([]);
    const r = run([{ ...dining, status: "EXCLUDED" }]);
    expect(r.lines).toHaveLength(0);
    expect(summarizeBoq(r.lines).total).toBe(base);
    expect(r.coverage[0]).toMatchObject({ status: "EXCLUDED", lines: 0 });
  });

  it("a RETAINED master bed is not charged as a new bed", () => {
    expect(run([{ ...newBed, status: "RETAIN" }]).lines).toHaveLength(0);
    expect(run([newBed]).lines[0].scopeStatus).toBe("NEW");
    expect(total([newBed])).toBeGreaterThan(0);
  });

  it("a REFURBISH with a card rate is priced and tagged; without one it is a manual line, never a new bed", () => {
    const priced = run([{ ...newBed, status: "REFURBISH", rateId: "wp:WP32", basis: "area", count: undefined, width: 6, height: 4 }]);
    expect(priced.lines[0]).toMatchObject({ scopeStatus: "REFURBISH", code: "WP32" });
    const unrated = run([{ ...mk("Master Bedroom", "bed upholstery refresh"), status: "REFURBISH" }]);
    expect(unrated.lines).toHaveLength(0);
    expect(unrated.warnings.join("|")).toMatch(/REFURBISH.*no refurbishment rate/i);
  });

  it("a RETAINED shower partition is not charged; a NEW one is", () => {
    expect(run([{ ...shower, status: "RETAIN" }]).lines).toHaveLength(0);
    const common = { ...shower, room: "Kids Bathroom" as const };
    expect(run([common]).lines.some((l) => l.title?.toLowerCase().includes("shower"))).toBe(true);
  });

  it("an UNCONFIRMED item is held out of the total and flagged", () => {
    const r = run([mk("Kitchen", "necessary civil modifications", { status: "UNCONFIRMED", rateId: "cv:CV13", basis: "floor_area" })]);
    expect(r.lines).toHaveLength(0);
    expect(r.warnings.join("|")).toMatch(/UNCONFIRMED/);
    expect(r.coverage[0].status).toBe("UNCONFIRMED");
  });

  it("excluded / retained / unconfirmed items do not inflate the total of a mixed scope", () => {
    const live = [mk("Kitchen", "countertop", { unit: "quartz_counter", basis: "area" })];
    const noise = [{ ...dining, status: "EXCLUDED" as const }, { ...newBed, status: "RETAIN" as const }, { ...shower, status: "RETAIN" as const }];
    expect(total([...live, ...noise])).toBe(total(live));
  });

  it("the response does not call intentional exclusions 'missing lines'", () => {
    const r = briefResponse({ rooms: CLEO_ROOMS, items: [{ ...dining, status: "EXCLUDED" }], assumptions: [], unpriced: [], questions: [], dropped: [] }, "premium", "Noida");
    expect(r.warnings.join("|")).not.toMatch(/No BOQ line was produced/);
  });

  it("every line's amount is qty x rate", () => {
    for (const l of run([mk("Kitchen", "kitchen", { unit: "kitchen_cabinetry" }), mk("Living", "tv", { unit: "tv_unit" })]).lines) {
      expect(l.amount).toBeCloseTo(l.qty * l.rate, 1);
    }
  });
});

import { cleoItems } from "@/lib/boq/fixtures/cleo-county";

describe("editing, tiers and unverified rates", () => {
  it("flipping an item's status re-prices exactly that item", () => {
    const tv = mk("Living", "TV unit", { unit: "tv_unit" });
    const withTv = total([tv]);
    expect(withTv).toBeGreaterThan(0);
    expect(total([{ ...tv, status: "EXCLUDED" }])).toBe(0);
    expect(total([{ ...tv, status: "UNCONFIRMED" }, { ...tv, status: "NEW" }])).toBe(withTv);
    expect(total([{ ...tv, width: 6, height: 7, sizeBy: "designer" }])).toBeLessThan(withTv);
  });

  it("the three tiers price the same scope with the same mappings, only the grade differs", () => {
    const ids = (tier: "essential" | "premium" | "luxury") =>
      quantify(cleoItems(tier), CLEO_ROOMS, { tier, city: "Noida", homeCare: false }).lines.map((l) => l.room + "|" + l.trade + "|" + l.qty);
    const [e, p, l] = [ids("essential"), ids("premium"), ids("luxury")];
    expect(e).toEqual(p);
    expect(l).toEqual(p);
    const t = (tier: "essential" | "premium" | "luxury") => summarizeBoq(quantify(cleoItems(tier), CLEO_ROOMS, { tier, city: "Noida", homeCare: false }).lines).total;
    expect(t("essential")).toBeLessThan(t("premium"));
    expect(t("premium")).toBeLessThan(t("luxury"));
  });

  it("an unknown rate is skipped with a warning, never silently priced", () => {
    const r = run([mk("Living", "mystery work", { rateId: "zz:NOPE", count: 1 })]);
    expect(r.lines).toHaveLength(0);
    expect(r.warnings.join("|")).toMatch(/unknown rate item/i);
  });

  it("a provisional allowance is flagged on the line", () => {
    const l = run([mk("Others / Whole Home Civil", "jacuzzi", { rateId: "al:JACUZZI", count: 1 })]).lines[0];
    expect(l.provisional).toBe(true);
  });

  it("a wardrobe-shutter replacement priced as a shutter does not add a carcass or an all-in wardrobe", () => {
    const r = run([mk("Master Bedroom", "replace wardrobe shutters 6 ft x 8 ft", { status: "REPLACE", rateId: "mod:S04", basis: "elevation", width: 6, height: 8 })]);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].code).toBe("S04");
    expect(r.warnings.join("|")).not.toMatch(/charged twice/);
  });
});
