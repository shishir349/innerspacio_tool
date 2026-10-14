import { SPAZAY_RATES, type SpazayRate } from "@/lib/rates/spazay-data";

export type { SpazayRate };

const BY_ID = new Map<string, SpazayRate>(SPAZAY_RATES.map((r) => [r.id, r]));

/** Every selling rate we can bill, in sheet order. */
export const RATE_CARD: readonly SpazayRate[] = SPAZAY_RATES;

export function findRate(id: string): SpazayRate | undefined {
  return BY_ID.get(id);
}

/** Throws on an unknown id so a typo in a scope template fails a test, not a quote. */
export function getRate(id: string): SpazayRate {
  const r = BY_ID.get(id);
  if (!r) throw new Error(`Unknown rate id: ${id}`);
  return r;
}
