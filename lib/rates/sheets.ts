import type { SpazayRate } from "@/lib/rates/spazay-data";

/**
 * Which rate sheet prices a BOQ.
 *  spazay   – Spazay Client Rates (full card, default).
 *  livspace – Livspace NCR MRC where a verified equivalent exists, else Spazay (flagged per line).
 *  both     – bill Spazay, carry the Livspace rate as a reference column.
 */
export const RATE_SHEETS = ["spazay", "livspace", "both"] as const;
export type RateSheet = (typeof RATE_SHEETS)[number];
export type RateSource = "spazay" | "livspace";

export const RATE_SHEET_LABEL: Record<RateSheet, string> = {
  spazay: "Spazay Client Rates (2026-09-06)",
  livspace: "Livspace NCR MRC (Vesta / Reno+, ex-GST)",
  both: "Spazay billed · Livspace shown for comparison",
};

/** Livspace "Cx Unit Price" is quoted incl. 18% GST; Spazay selling rates are ex-GST. */
export const LIVSPACE_GST = 0.18;

/**
 * Livspace equivalents of Spazay rate ids, hand-verified against
 * `pricing/Livspace Rates - NCR City MRC.pdf` (₹ incl. GST, same unit as the Spazay line).
 * Deliberately a small verified subset, not a bulk parse of the wrapped-cell PDF — an
 * unmapped id falls back to Spazay and says so. Add rows here as estimators confirm them.
 */
const LIVSPACE: Record<string, { price: number; label: string }> = {
  "pt:PT02": { price: 25, label: "Asian Tractor Emulsion — fresh painting" },
  "pt:PT03": { price: 28, label: "Asian Apcolite Premium Emulsion — fresh painting" },
  "pt:PT04": { price: 36, label: "Asian Royale Luxury Emulsion — fresh painting" },
  "pt:PT08": { price: 20, label: "Asian Apcolite Premium Emulsion — re-painting" },
  "pt:PT12": { price: 61, label: "Base preparation for wallpaper" },
  // Same Livspace products, keyed on the paint-sheet ids that replaced the rows above.
  "ps:F07": { price: 25, label: "Asian Tractor Emulsion — fresh painting" },
  "ps:F01": { price: 28, label: "Asian Apcolite Premium Emulsion — fresh painting" },
  "ps:F06": { price: 36, label: "Asian Royale Luxury Emulsion — fresh painting" },
  "ps:R01": { price: 20, label: "Asian Apcolite Premium Emulsion — re-painting" },
  "ps:W01": { price: 61, label: "Base preparation for wallpaper" },
  "fc:FC01": { price: 153, label: "Standard gypsum false ceiling — plain" },
  "fc:FC02": { price: 167, label: "Designer false ceiling — POP / gypsum" },
  "el:EL30": { price: 855, label: "Wall / ceiling primary point — wiring, looping, conduit" },
  "el:EL31": { price: 728, label: "Secondary point — wiring, looping, conduit" },
  "el:EL02": { price: 967, label: "Relocation of existing 2-module switch point" },
  "cv:CV22": { price: 38, label: "Demolition of furniture" },
  "cv:CV07": { price: 398, label: "Kitchen granite platform installation" },
  "wp:WP01": { price: 924, label: "Laminate wall panelling — standard" },
};

/** Livspace all-in modular prices (carcass + shutter + standard hardware), ₹/sq ft incl. GST. */
const LIVSPACE_MODULAR: Record<string, { price: number; label: string }> = {
  Wardrobe: { price: 2500, label: "Swing shutter wardrobe — standard" },
  "Kitchen Base Unit": { price: 3375, label: "Kitchen base unit, shutter — standard" },
  "Kitchen Wall Unit": { price: 2410, label: "Kitchen wall unit, shutter — standard" },
  "Kitchen Tall Unit": { price: 2372, label: "Tall shutter storage — standard" },
};

const exGst = (price: number) => Math.round(price / (1 + LIVSPACE_GST));

export interface Resolved {
  rate: number;
  source: RateSource;
  /** Livspace reference ₹ (sheet = "both" only). */
  alt?: number;
  /** Sheet = "livspace" but no verified Livspace rate exists: billed at the Spazay card rate and must be reviewed. */
  unmapped?: true;
}

/** Rate to bill for `spazayRate` under `sheet`. */
export function resolveRate(id: string, spazayRate: number, sheet: RateSheet): Resolved {
  const ls = LIVSPACE[id];
  if (sheet === "livspace" && ls) return { rate: exGst(ls.price), source: "livspace" };
  if (sheet === "both" && ls) return { rate: spazayRate, source: "spazay", alt: exGst(ls.price) };
  if (sheet === "livspace") return { rate: spazayRate, source: "spazay", unmapped: true };
  return { rate: spazayRate, source: "spazay" };
}

/** Livspace all-in modular unit for `item`, ex-GST ₹/sq ft; null when no verified equivalent exists (never a stand-in price). */
export function livspaceModular(item: string): { rate: number; label: string } | null {
  const m = LIVSPACE_MODULAR[item];
  return m ? { rate: exGst(m.price), label: m.label } : null;
}

export function livspaceCoverage(): number {
  return Object.keys(LIVSPACE).length;
}

export type { SpazayRate };
