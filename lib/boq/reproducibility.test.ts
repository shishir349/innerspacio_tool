import { describe, expect, it } from "vitest";
import { quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";
import { summarizeBoq } from "@/lib/boq/build";
import { cleoItems, CLEO_ROOMS } from "@/lib/boq/fixtures/cleo-county";
import { pricingVersion, readingHash, LOGIC_VERSION } from "@/lib/boq/provenance";
import { briefResponse } from "@/lib/boq/brief-response";
import { readingSchema } from "@/lib/boq/schema";
import { prepareSave } from "@/lib/boq/revisions";

/** The comparable shape of a BOQ: what a person would diff. Order-insensitive. */
const normalize = (lines: { room: string; trade: string; rateId: string; title?: string; item: string; uom: string; qty: number; rate: number }[]) =>
  lines.map((l) => [l.room, l.trade, l.rateId, l.title ?? l.item, l.uom, l.qty, l.rate].join("|")).sort();

const opts = { tier: "premium" as const, city: "Noida" };
const room = (p: Partial<PlanRoom>): PlanRoom => ({ id: "r", name: "Bath", boqRoom: "Kids Bathroom", l: 8, b: 5, h: 10, source: "labelled", ...p });
const wallTile = (area: string): BriefItem => ({
  room: "Kids Bathroom", requirement: `${area} wall tiling`, area, kind: "rate", basis: "wall_area", rateId: "cv:CV03", status: "REPLACE",
});

describe("deterministic calculation (same reading → same BOQ)", () => {
  it("quantify is repeatable: identical lines and total on every run", () => {
    const a = quantify(cleoItems("premium"), CLEO_ROOMS, opts);
    const b = quantify(cleoItems("premium"), CLEO_ROOMS, opts);
    expect(normalize(a.lines)).toEqual(normalize(b.lines));
    expect(summarizeBoq(a.lines).total).toBe(summarizeBoq(b.lines).total);
    expect(a.warnings).toEqual(b.warnings);
  });

  it("does not depend on the order the plan rooms arrive in", () => {
    const a = quantify(cleoItems("premium"), CLEO_ROOMS, opts);
    const b = quantify(cleoItems("premium"), [...CLEO_ROOMS].reverse(), opts);
    expect(summarizeBoq(b.lines).total).toBe(summarizeBoq(a.lines).total);
  });
});

describe("AI reading variability is detectable, not silent", () => {
  it("warns when one BOQ room merges plan rooms and the same measured quantity is billed repeatedly", () => {
    const rooms = [room({ id: "a", name: "Toilet 1" }), room({ id: "b", name: "Toilet 2", l: 5, b: 8.58 })];
    const items = [wallTile("Bedroom 1 washroom"), wallTile("Common washroom"), wallTile("Bedroom 3 washroom")];
    const r = quantify(items, rooms, opts);
    expect(r.warnings.join("\n")).toMatch(/Kids Bathroom: 2 plan rooms are merged/);
    expect(r.warnings.join("\n")).toMatch(/3 times/);
  });

  it("stays quiet when each bathroom has its own BOQ room", () => {
    const rooms = [room({ id: "a", boqRoom: "Kids Bathroom" }), room({ id: "b", boqRoom: "Bathroom - 4" })];
    const items: BriefItem[] = [wallTile("Washroom 1"), { ...wallTile("Washroom 2"), room: "Bathroom - 4" }];
    expect(quantify(items, rooms, opts).warnings.join("\n")).not.toMatch(/merged/);
  });

  it("the price of the same scope moves with the room assignment (documents why the reading must be frozen)", () => {
    const merged = quantify(
      [wallTile("A"), wallTile("B")],
      [room({ id: "a" }), room({ id: "b", l: 5, b: 8.58 })],
      opts
    );
    const split = quantify(
      [wallTile("A"), { ...wallTile("B"), room: "Bathroom - 4" }],
      [room({ id: "a" }), room({ id: "b", boqRoom: "Bathroom - 4", l: 5, b: 8.58 })],
      opts
    );
    expect(summarizeBoq(merged.lines).total).toBeGreaterThan(summarizeBoq(split.lines).total);
  });
});

describe("readingHash: the key under which an AI reading is reused", () => {
  const base = { plan: "AAAA", photos: ["BBBB"], requirements: "1. Entrance\n- paint the door", tier: "premium" };

  it("is stable for identical inputs and ignores whitespace-only differences in the text", () => {
    expect(readingHash(base)).toBe(readingHash({ ...base }));
    expect(readingHash({ ...base, requirements: "  1. Entrance   \n\n- paint   the door " })).toBe(readingHash(base));
  });

  it("changes when the plan, a photo, the words or the tier change", () => {
    const h = readingHash(base);
    expect(readingHash({ ...base, plan: "AAAB" })).not.toBe(h);
    expect(readingHash({ ...base, photos: [] })).not.toBe(h);
    expect(readingHash({ ...base, requirements: "1. Entrance\n- paint the wall" })).not.toBe(h);
    expect(readingHash({ ...base, tier: "luxury" })).not.toBe(h);
  });
});

describe("pricingVersion: rates or rules changed since a BOQ was priced", () => {
  it("is a stable short id", () => {
    expect(pricingVersion()).toMatch(/^[0-9a-f]{12}$/);
    expect(pricingVersion()).toBe(pricingVersion());
  });

  it("bumping the logic version changes it", () => {
    expect(pricingVersion(LOGIC_VERSION + "x")).not.toBe(pricingVersion());
  });
});

describe("a stored reading reproduces the BOQ", () => {
  const scope = { rooms: CLEO_ROOMS, items: cleoItems("premium"), assumptions: ["a"], unpriced: [], questions: [], dropped: [] };
  const hash = readingHash({ plan: "P", photos: [], requirements: "same words", tier: "premium" });

  it("pricing a stored reading gives the same lines and total as the original response", () => {
    const first = briefResponse(scope, "premium", "Noida", "spazay", hash);
    // What the client stores, the server validates, and a later identical run feeds back in.
    const stored = readingSchema.parse({ hash, source: "ai", at: "2026-10-22T00:00:00Z", scope: JSON.parse(JSON.stringify(first.reading!.scope)) });
    const again = briefResponse(stored.scope, "premium", "Noida", "spazay", hash);
    expect(normalize(again.lines)).toEqual(normalize(first.lines));
    expect(again.summary.total).toBe(first.summary.total);
    expect(again.pricingVersion).toBe(first.pricingVersion);
  });

  it("the save keeps the reading and the pricing version, and a client cannot overwrite server-owned fields", () => {
    const first = briefResponse(scope, "premium", "Noida", "spazay", hash);
    const saved = prepareSave(
      undefined,
      { lines: [], reading: first.reading, pricingVersion: first.pricingVersion, finalApproved: { at: "x", by: "attacker" } } as never,
      { now: "2026-10-22T00:00:00Z", userId: "u1" }
    );
    expect(saved.reading).toEqual(first.reading);
    expect(saved.pricingVersion).toBe(first.pricingVersion);
    expect(saved.finalApproved).toBeUndefined();
  });
});
