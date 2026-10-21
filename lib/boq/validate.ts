import { BOQ_UOMS } from "@/lib/boq/lists";
import { findRate } from "@/lib/rates/catalog";
import { openDecisions } from "@/lib/boq/decisions";
import { PACKAGE_BANDS, type Bhk, type PackageTier } from "@/lib/quote/constants";

/**
 * BOQ checks. Pure and client-safe. Everything here is a WARNING for a human to look at: nothing
 * changes a price, a quantity or the export. `error` marks a line that cannot be priced correctly
 * (missing/zero/invalid numbers); `warn` marks something that is probably wrong or unverified.
 */

export interface CheckLine {
  room: string;
  trade: string;
  item: string;
  title?: string;
  rateId?: string;
  uom: string;
  l?: number | null;
  b?: number | null;
  h?: number | null;
  qty: number;
  rate: number;
  provisional?: boolean;
  rateNote?: string;
  qtySource?: "measured" | "entered" | "estimated";
  autoAdded?: boolean;
}

export interface Issue {
  severity: "error" | "warn";
  /** Index into the checked lines; absent for whole-BOQ issues. */
  line?: number;
  message: string;
}

/** Plausibility ceilings per unit for ONE line of a home interior. Beyond these a typo is likelier than a real job. */
const MAX_QTY: Record<string, number> = { "Sq.Ft.": 6000, Rft: 1500, Rmt: 500, "Cu.Ft.": 2000, Nos: 300, "L.S.": 1, "Sq.Mt.": 600 };
const MAX_DIM = { l: 150, b: 150, h: 40 } as const;
const AREA_UOMS = ["Sq.Ft."];
/** Custom rates this far from the card rate are flagged. */
const RATE_DRIFT = 0.25;
const EPS = 0.06;

const label = (l: CheckLine) => (l.title || l.item).slice(0, 60);

/** `cardRates: false` for spec-mode BOQs, whose rates are package rates, so a drift from the card is expected. */
export function validateBoq(lines: CheckLine[], opts: { cardRates?: boolean } = {}): Issue[] {
  const cardRates = opts.cardRates ?? true;
  const out: Issue[] = [];
  const seen = new Map<string, number>();

  lines.forEach((l, i) => {
    const at = (severity: Issue["severity"], message: string) => out.push({ severity, line: i, message: `${label(l)} (${l.room}): ${message}` });

    if (!(BOQ_UOMS as readonly string[]).includes(l.uom)) at("error", `unit “${l.uom}” is not a BOQ unit.`);
    if (!Number.isFinite(l.qty) || l.qty <= 0) at("error", "quantity must be above zero.");
    if (!Number.isFinite(l.rate) || l.rate <= 0) at("error", "rate must be above zero.");

    for (const k of ["l", "b", "h"] as const) {
      const v = l[k];
      if (v == null) continue;
      if (!Number.isFinite(v) || v < 0) at("error", `${k.toUpperCase()} must be a positive number.`);
      else if (v > MAX_DIM[k]) at("warn", `${k.toUpperCase()} of ${v} ft is implausible for a home.`);
    }

    const cap = MAX_QTY[l.uom];
    if (cap && l.qty > cap) at("warn", `${l.qty} ${l.uom} is very large for one line. Check for a typo.`);

    // Quantity must follow the dimensions it displays.
    if (AREA_UOMS.includes(l.uom) && l.qty > 0) {
      const area = l.l && l.b ? l.l * l.b : l.l && l.h ? l.l * l.h : null;
      // Less than the dimensions is normal (openings, panelled features are deducted); more is not.
      if (area && (l.qty > area * (1 + EPS) || l.qty < area * 0.5)) {
        at("warn", `quantity ${l.qty} does not fit its dimensions (${Math.round(area * 100) / 100} sq ft).`);
      }
    }
    if ((l.uom === "Rft" || l.uom === "Rmt") && l.l && Math.abs(l.qty - l.l) / l.l > EPS) {
      at("warn", `quantity ${l.qty} does not match its length ${l.l}.`);
    }

    // Wall paint measured as full perimeter × height with no deduction for doors and windows.
    if (l.trade === "Paint & Polish" && l.l && l.h && l.qty >= l.l * l.h * 0.99) {
      at("warn", "wall paint covers the full wall area; no deduction for doors, windows or panelled features.");
    }

    // A rate edited far away from its card rate.
    const card = l.rateId && l.rateId !== "mod:unit" ? findRate(l.rateId) : undefined;
    if (cardRates && card && l.rate > 0 && Math.abs(l.rate - card.rate) / card.rate > RATE_DRIFT && !l.rateNote) {
      at("warn", `rate ₹${l.rate} differs from the card rate ₹${card.rate} by more than ${RATE_DRIFT * 100}%.`);
    }
    // Measurement rules: area work in Sq.Ft., linear in Rft, countables in Nos, packages L.S. — the card unit is the rule.
    if (card && card.uom !== l.uom) at("warn", `unit ${l.uom} differs from the card unit ${card.uom} for this rate.`);
    if (l.provisional) at("warn", "provisional allowance with no card rate; confirm before issue.");
    if (l.rateNote) at("warn", l.rateNote);

    // Same item twice in one room (identical rate id/title and dimensions) is usually a double entry.
    const key = [l.room, l.rateId ?? l.item, (l.title ?? "").toLowerCase(), l.l ?? "", l.b ?? "", l.h ?? "", l.qty].join("|");
    if (seen.has(key)) at("warn", `duplicate of line ${seen.get(key)! + 1}.`);
    else seen.set(key, i);
  });

  const est = lines.filter((l) => l.qtySource === "estimated").length;
  if (est > 0) {
    out.push({ severity: "warn", message: `${est} of ${lines.length} quantities are standard-size estimates, not measurements. Confirm on site before issue.` });
  }
  // Open professional / commercial decisions: flagged for a human, never resolved here.
  for (const d of openDecisions(lines)) out.push({ severity: "warn", message: `${d.message} (${d.count} line${d.count === 1 ? "" : "s"})` });

  return out;
}

export interface SanityInput {
  total: number;
  /** Carpet or plan floor area, sq ft. */
  area: number;
  bhk: Bhk;
  tier: PackageTier;
}

/**
 * Reasonableness of a total against the reference sheet. The sheet's per-sq-ft baseline and its tier
 * bands disagree with each other and neither has been verified, so these are prompts to look, never an
 * adjustment: the BOQ total is not changed by anything here.
 */
export function sanityChecks({ total, area, bhk, tier }: SanityInput): Issue[] {
  const out: Issue[] = [];
  const ref = PACKAGE_BANDS[bhk];
  if (!ref || !(area > 0) || !(total > 0)) return out;
  const perSqFt = total / area;
  const { min, max } = ref.perSqFt;
  const unverified = "The reference sheet is unverified.";
  if (perSqFt < min || perSqFt > max) {
    out.push({
      severity: "warn",
      message: `₹${Math.round(perSqFt).toLocaleString("en-IN")} per sq ft is outside the reference range ₹${min.toLocaleString("en-IN")}–${max.toLocaleString("en-IN")} for a ${bhk} BHK. ${unverified}`,
    });
  }
  const band = ref[tier];
  if (total < band.min || total > band.max) {
    out.push({
      severity: "warn",
      message: `Total is outside the reference ${tier} band for a ${bhk} BHK (₹${(band.min / 1e5).toFixed(1)}L–${(band.max / 1e5).toFixed(1)}L). ${unverified}`,
    });
  }
  return out;
}
