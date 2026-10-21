import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PAINT_ROWS } from "@/lib/rates/paint-data";
import { RATE_CARD, SUPERSEDED_PAINT, findRate, getRate } from "@/lib/rates/catalog";
import { catalogText } from "@/lib/ai/boq-brief";
import { REPAINT, buildBoq, tierHints } from "@/lib/boq/build";

/** Minimal CSV reader (quoted fields, doubled quotes). */
function parse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

const csv = parse(fs.readFileSync(path.join(__dirname, "paint-rates.csv"), "utf8").replace(/^﻿/, ""));
const [, ...body] = csv;

describe("paint sheet data matches the CSV exactly", () => {
  it("has one entry per CSV row, same product, coats, rate and notes", () => {
    expect(PAINT_ROWS).toHaveLength(body.length);
    body.forEach((r, i) => {
      const p = PAINT_ROWS[i];
      expect(p.product).toBe(r[3].trim());
      expect(p.coats).toBe(r[4].trim());
      expect(p.notes).toBe(r[5].trim());
      expect(p.brand).toBe(r[6].trim());
      expect(p.rate).toBe(Number(r[10]));
    });
  });
  it("every sheet row is internally consistent: Amount = Area × Rate, 18% GST", () => {
    for (const r of body) {
      expect(Number(r[8]) * Number(r[10]), `row ${r[0]}`).toBe(Number(r[9]));
      expect(r[11].trim()).toBe("18.00%");
    }
  });
  it("ids are unique and every repaint is cheaper than the fresh paint of the same product", () => {
    expect(new Set(PAINT_ROWS.map((p) => p.id)).size).toBe(PAINT_ROWS.length);
    const fresh = new Map(PAINT_ROWS.filter((p) => p.stage === "fresh").map((p) => [p.product, p.rate]));
    const dearer = PAINT_ROWS.filter((p) => p.stage === "repaint" && fresh.has(p.product) && p.rate >= fresh.get(p.product)!).map((p) => p.product);
    // KNOWN SHEET ANOMALY: Tractor repaint is ₹26 against ₹25 fresh. Billed as written; confirm with the sheet's owner.
    expect(dearer).toEqual(["Asian Tractor Emulsion"]);
  });
});

describe("paint sheet is the go-to paint price", () => {
  it("every sheet row is on the rate card at the sheet rate, Sq.Ft., Paint & Polish", () => {
    for (const p of PAINT_ROWS) {
      const r = getRate(p.id);
      expect([r.rate, r.uom, r.trade]).toEqual([p.rate, "Sq.Ft.", "Paint & Polish"]);
    }
  });
  it("the old emulsion / ceiling / wallpaper-primer rows still resolve (saved BOQs) but are not offered", () => {
    for (const id of SUPERSEDED_PAINT) {
      expect(findRate(id), id).toBeDefined();
      expect(RATE_CARD.some((r) => r.id === id), id).toBe(false);
      expect(catalogText()).not.toContain(`${id} |`);
    }
    // texture, distemper, enamel and polish are not in the sheet, so they stay
    for (const id of ["pt:PT01", "pt:PT05", "pt:PT10", "pt:PT13", "pt:PT26"]) expect(RATE_CARD.some((r) => r.id === id), id).toBe(true);
  });
  it("whole-home paint (pr:PAINT) is the sheet's Royale Luxury Emulsion", () => {
    expect(getRate("pr:PAINT").rate).toBe(getRate("ps:F06").rate);
  });
  it("every tier paints with a sheet rate, fresh and repaint", () => {
    for (const tier of ["essential", "premium", "luxury"] as const) {
      expect(tierHints(tier).wallPaint, tier).toMatch(/^ps:F/);
      expect(REPAINT[tier], tier).toMatch(/^ps:R/);
      expect(findRate(tierHints(tier).wallPaint)).toBeDefined();
      expect(findRate(REPAINT[tier])).toBeDefined();
    }
  });
  it("a built BOQ bills wall and ceiling paint at sheet rates only", () => {
    for (const tier of ["essential", "premium", "luxury"] as const) {
      const lines = buildBoq({ bhk: "3", tier, city: "Delhi", rooms: [{ roomType: "living_room" }, { roomType: "bedroom" }, { roomType: "kitchen" }] });
      const paint = lines.filter((l) => l.trade === "Paint & Polish");
      expect(paint.length, tier).toBeGreaterThan(0);
      for (const l of paint) expect(l.rateId, `${tier} ${l.title ?? l.item}`).toMatch(/^ps:/);
    }
  });
});
