/**
 * Internal cost structure (staff only; never part of a client export or DTO).
 *
 * The Spazay card holds SELLING rates only. It has no material / labour / hardware / installation
 * split, and a split cannot be derived from an all-in selling rate without inventing numbers. So
 * `COST_COMPONENTS` starts EMPTY: add a row only from a verified source (vendor quote, BOQ costing
 * sheet). Until a rate id has a row, its breakdown is reported as unavailable, never estimated.
 *
 * Client-facing rates stay consolidated: when a rate id has cost components AND a margin policy is
 * chosen, `sellingRate()` derives the one consolidated rate. With no policy or no components the card
 * rate is used unchanged.
 */

export const COST_KEYS = ["material", "labour", "hardware", "installation"] as const;
export type CostKey = (typeof COST_KEYS)[number];
/** ₹ per card unit, ex-margin, ex-GST. Any subset may be present; a missing key means "not known", not zero. */
export type CostComponents = Partial<Record<CostKey, number>>;

/** Verified cost rows by rate id. Empty by design. */
export const COST_COMPONENTS: Readonly<Record<string, CostComponents>> = {};

/**
 * How cost becomes a selling rate. `margin`: price = cost ÷ (1 − m), so a 40% margin is NOT a 40% markup
 * (matches lib/pricing/engine.ts). `markup`: price = cost × (1 + m). Percent is of ex-GST price.
 */
export interface MarginPolicy {
  basis: "margin" | "markup";
  percent: number;
}
/** No default policy: the margin is a business decision that has not been given. */
export const DEFAULT_MARGIN_POLICY: MarginPolicy | null = null;

export class CostPolicyError extends Error {}

export function sellingFromCost(cost: number, policy: MarginPolicy): number {
  if (!Number.isFinite(cost) || cost < 0) throw new CostPolicyError("Cost must be a non-negative number.");
  const p = policy.percent;
  if (!Number.isFinite(p) || p < 0) throw new CostPolicyError("Policy percent must be a non-negative number.");
  if (policy.basis === "margin") {
    if (p >= 100) throw new CostPolicyError("A margin must be below 100%.");
    return Math.round((cost / (1 - p / 100)) * 100) / 100;
  }
  return Math.round(cost * (1 + p / 100) * 100) / 100;
}

export type CostBreakdown =
  | { available: true; components: CostComponents; cost: number; missing: CostKey[] }
  | { available: false; missing: readonly CostKey[]; reason: string };

/** Internal cost of one card unit, or an explicit "unavailable". Never derived from the selling rate. */
export function costBreakdown(rateId: string, table: Readonly<Record<string, CostComponents>> = COST_COMPONENTS): CostBreakdown {
  const c = table[rateId];
  const known = c ? COST_KEYS.filter((k) => typeof c[k] === "number" && Number.isFinite(c[k])) : [];
  if (!c || known.length === 0) {
    return { available: false, missing: COST_KEYS, reason: "No verified cost components for this rate; cost cannot be broken down." };
  }
  return {
    available: true,
    components: c,
    cost: Math.round(known.reduce((n, k) => n + (c[k] as number), 0) * 100) / 100,
    missing: COST_KEYS.filter((k) => !known.includes(k)),
  };
}

/**
 * Consolidated selling rate for a rate id: derived from its cost and the policy when both exist and
 * every component is known; otherwise the card rate. `derived` says which one you got.
 */
export function sellingRate(
  rateId: string,
  cardRate: number,
  policy: MarginPolicy | null = DEFAULT_MARGIN_POLICY,
  table: Readonly<Record<string, CostComponents>> = COST_COMPONENTS
): { rate: number; derived: boolean } {
  const b = costBreakdown(rateId, table);
  if (!policy || !b.available || b.missing.length > 0) return { rate: cardRate, derived: false };
  return { rate: Math.round(sellingFromCost(b.cost, policy)), derived: true };
}

/** How a derived rate compares with the card, for reconciliation; null when it cannot be derived. */
export function reconcileWithCard(
  rateId: string,
  cardRate: number,
  policy: MarginPolicy,
  table: Readonly<Record<string, CostComponents>> = COST_COMPONENTS
) {
  const s = sellingRate(rateId, cardRate, policy, table);
  if (!s.derived) return null;
  return { derived: s.rate, card: cardRate, delta: s.rate - cardRate, deltaPct: (s.rate - cardRate) / cardRate };
}

/** Internal cost of a BOQ where it is known, and how much of it is not. */
export function internalCost(
  lines: { rateId?: string; qty: number }[],
  table: Readonly<Record<string, CostComponents>> = COST_COMPONENTS
) {
  let known = 0;
  let withBreakdown = 0;
  for (const l of lines) {
    const b = l.rateId ? costBreakdown(l.rateId, table) : null;
    if (b?.available) {
      known += b.cost * l.qty;
      withBreakdown++;
    }
  }
  return { cost: Math.round(known * 100) / 100, linesWithBreakdown: withBreakdown, linesWithout: lines.length - withBreakdown };
}
