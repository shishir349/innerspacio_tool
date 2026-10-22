import { createHash } from "node:crypto";
import { RATE_CARD } from "@/lib/rates/catalog";
import { UNIT_CLASSES } from "@/lib/boq/classes";

/**
 * Two ids that make a BOQ reproducible and its changes traceable. Neither changes a number.
 *
 * - readingHash: the AI's reading of a plan is the only non-deterministic step (the rest is pure code). The same
 *   plan + photos + words + tier always get the same stored reading back instead of a fresh, different one.
 * - pricingVersion: identifies the rate card and the class→rate mapping a BOQ was priced with, so a re-price after
 *   a rate or rule change is announced instead of silently moving the total.
 */

/** Bump when the plan-reading prompt or the scope schema changes: old readings must not be reused for new prompts. */
export const READING_VERSION = "1";
/** Bump when a sizing, guard or pricing RULE changes (rate-card edits are picked up automatically). */
export const LOGIC_VERSION = "2026-10-22.1";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function readingHash(i: { plan: string; photos: string[]; requirements: string; tier: string }): string {
  const words = i.requirements.replace(/\s+/g, " ").trim();
  return sha(JSON.stringify([READING_VERSION, i.tier, words, i.plan, i.photos]));
}

export function pricingVersion(logic: string = LOGIC_VERSION): string {
  return sha(
    JSON.stringify([logic, RATE_CARD.map((r) => [r.id, r.rate, r.uom]), Object.entries(UNIT_CLASSES).map(([k, c]) => [k, c.rateId])])
  ).slice(0, 12);
}
