import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { RATE_CARD, getRate, rateBasis } from "@/lib/rates/catalog";
import { UNIT_CLASSES } from "@/lib/boq/classes";
import { REPAINT } from "@/lib/boq/build";

const UOMS = new Set(["Sq.Ft.", "Rft", "Rmt", "Nos", "Point", "Set", "L.S."]);
// Measurement basis -> the rate units that can legally carry it.
const BASIS_UOM: Record<string, string[]> = { elevation: ["Sq.Ft."], area: ["Sq.Ft."], length: ["Rft", "Rmt"], count: ["Nos", "Point", "Set", "L.S."] };

describe("rate registry integrity", () => {
  it("ids are unique and well formed", () => {
    const ids = RATE_CARD.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of RATE_CARD) expect(r.id, r.id).toMatch(/^[a-z]+:[A-Za-z0-9]+$/);
  });

  it("every rate has a positive price, a known unit and a description", () => {
    for (const r of RATE_CARD) {
      expect(r.rate, r.id).toBeGreaterThan(0);
      expect(UOMS.has(r.uom), `${r.id} uom ${r.uom}`).toBe(true);
      expect(r.desc.length, r.id).toBeGreaterThan(10);
      expect(r.item.length, r.id).toBeGreaterThan(2);
    }
  });

  it("estimator (pr:) and allowance (al:) rows are flagged so they never pass as card rates", () => {
    for (const r of RATE_CARD) {
      if (r.id.startsWith("pr:")) expect(r.estimator, r.id).toBe(true);
      if (r.id.startsWith("al:")) expect(r.provisional, r.id).toBe(true);
      if (!r.id.startsWith("pr:") && !r.id.startsWith("al:")) expect(!!r.estimator || !!r.provisional, r.id).toBe(false);
    }
  });

  it("every unit class prices with a rate whose unit fits how the class is measured", () => {
    for (const [id, c] of Object.entries(UNIT_CLASSES)) {
      const r = getRate(c.rateId);
      expect(BASIS_UOM[c.basis]?.includes(r.uom), `${id}: basis ${c.basis} vs ${c.rateId} uom ${r.uom}`).toBe(true);
    }
  });

  it("every rate id referenced by the engine resolves, and the three tiers are covered", () => {
    for (const id of Object.values(REPAINT)) expect(() => getRate(id), id).not.toThrow();
    for (const g of ["B", "E", "L"]) for (let n = 1; n <= 10; n++) expect(() => getRate(`lf:LF${g}${String(n).padStart(2, "0")}`)).not.toThrow();
    // every literal getRate("x:Y") in the engine sources
    const src = ["build.ts", "brief.ts", "classes.ts", "standards.ts"].map((f) => readFileSync(`lib/boq/${f}`, "utf8")).join("\n");
    for (const m of src.matchAll(/getRate\("([a-z]+:[A-Za-z0-9]+)"\)/g)) expect(() => getRate(m[1]), m[1]).not.toThrow();
  });

  it("component rates exist only as card rows, never as estimator rows", () => {
    for (const r of RATE_CARD) if (rateBasis(r.id) === "component") expect(r.estimator, r.id).toBeFalsy();
  });
});

describe("sources", () => {
  it("the engine has no hardcoded rupee rates outside the rate files", () => {
    const hits: string[] = [];
    for (const f of readdirSync("lib/boq").filter((n) => n.endsWith(".ts") && !n.includes(".test."))) {
      const t = readFileSync(`lib/boq/${f}`, "utf8");
      if (/\brate:\s*\d{3,}/.test(t)) hits.push(f);
    }
    expect(hits).toEqual([]);
  });
});
