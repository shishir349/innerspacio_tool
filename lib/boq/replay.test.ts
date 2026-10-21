import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { quantify } from "@/lib/boq/brief";
import { summarizeBoq } from "@/lib/boq/build";
import { cleoItems, CLEO_ROOMS } from "@/lib/boq/fixtures/cleo-county";
import type { PackageTier } from "@/lib/quote/constants";

const price = (tier: PackageTier) => {
  const { lines } = quantify(cleoItems(tier), CLEO_ROOMS, { tier, city: "Noida" });
  const byTrade = new Map<string, number>();
  for (const l of lines) byTrade.set(l.trade, (byTrade.get(l.trade) ?? 0) + l.amount);
  return { total: summarizeBoq(lines).total, byTrade, lines };
};

describe("Cleo County 3BHK replay (offline, no AI)", () => {
  it("prices the heavy-scope brief and reports the breakdown", () => {
    const out: string[] = [];
    for (const tier of ["essential", "premium", "luxury"] as const) {
      const r = price(tier);
      out.push(`${tier}: total ${(r.total / 1e5).toFixed(1)} L`);
      if (tier === "premium") {
        out.push(...[...r.byTrade].sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${(v / 1e5).toFixed(2)} L`));
        out.push(...[...r.lines].sort((a, b) => b.amount - a.amount).slice(0, 10).map((l) => `  ${l.room} | ${(l.title ?? l.item).slice(0, 44)} | ${l.qty} ${l.uom} @ ${l.rate} = ${Math.round(l.amount)}`));
      }
    }
    if (process.env.REPLAY_OUT) writeFileSync(process.env.REPLAY_OUT, out.join("\n"));
    expect(price("premium").total).toBeGreaterThan(0);
  });

  it("premium stays inside a sane window for this heavy scope (regression pin, not a cap)", () => {
    const t = price("premium").total / 1e5;
    expect(t).toBeGreaterThan(27);
    expect(t).toBeLessThan(32);
  });

  describe("audit of the priced lines (every line traces to a requested item)", () => {
    const { lines, total } = price("premium");
    const has = (room: string, re: RegExp) => lines.some((l) => l.room === room && re.test(`${l.title ?? ""} ${l.item}`.toLowerCase()));
    it("prices nothing the brief did not ask for", () => {
      expect(has("Living", /accent|coffee/)).toBe(false); // chairs + coffee table are a MASTER bedroom item
      expect(has("Master Bedroom", /pvc/)).toBe(false); // balcony furnishing is vague → unconfirmed, not a bedroom-sized ceiling
      expect(has("Balcony 1", /pvc/)).toBe(false);
      expect(lines.some((l) => l.rateId === "cv:WP03")).toBe(false); // "necessary civil modifications" is unconfirmed
      expect(lines.some((l) => l.rateId === "el:EL01")).toBe(false); // "electrical modifications" is not a full rewire
      expect(has("Utility", /quartz/)).toBe(false); // utility storage cabinetry only
      expect(lines.some((l) => l.rateId === "wp:WP32")).toBe(false); // no wall-panel rate stands in for bed upholstery
    });
    it("prices everything it did ask for, once", () => {
      const count = (re: RegExp) => lines.filter((l) => re.test(`${l.room} ${l.title ?? l.item}`.toLowerCase())).length;
      expect(count(/kitchen.*modular kitchen/)).toBe(1);
      expect(lines.filter((l) => l.code === "S04")).toHaveLength(2); // guest + kids shutters, shutters only
      expect(lines.filter((l) => l.rateId === "pr:FEATURE")).toHaveLength(5); // living feature, TV backdrop, guest / master / kids bed-back walls
      expect(lines.filter((l) => l.room === "Kids Bathroom" && /shower/.test(l.title ?? "")).length).toBe(1);
      expect(lines.filter((l) => /vanity/.test(l.title ?? l.item)).length).toBe(2);
    });
    it("the foyer wall is not wider than the foyer", () => {
      const f = lines.find((l) => l.room === "Foyer / Entryway" && l.code === "PR20")!;
      expect(f.qty).toBeLessThanOrEqual(6.58 * 10 + 0.1);
    });
    it("arithmetic reconciles line by line", () => {
      for (const l of lines) expect(l.amount).toBeCloseTo(l.qty * l.rate, 1);
      expect(lines.reduce((n, l) => n + l.amount, 0)).toBeCloseTo(total, 1);
    });
  });
});
