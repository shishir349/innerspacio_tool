import { quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";
import { summarizeBoq } from "@/lib/boq/build";
import type { PackageTier } from "@/lib/quote/constants";

/**
 * Self-consistency for the plan-analysis step. One model run drops or invents items at random
 * (a run once skipped the whole-home paint, another read the kitchen as 29 ft deep). Several
 * independent runs are priced by the same deterministic engine and the run whose total is the
 * MEDIAN is used, whole. Merging item-by-item was tried and is worse: the model names the same
 * unit differently run to run, so a vote either drops real items (-5%) or double-counts them
 * (+20%), while the median run is a coherent BOQ a person could have written.
 */

export interface ScopeShape {
  rooms: PlanRoom[];
  items: BriefItem[];
}

/** Index of the median-total run (upper median for an even count: runs fail by omission, not invention). */
export function medianRunIndex(runs: ScopeShape[], tier: PackageTier = "premium"): number {
  if (runs.length <= 1) return 0;
  const totals = runs.map((r, i) => ({
    i,
    total: summarizeBoq(quantify(r.items, r.rooms, { tier, city: "Delhi" }).lines).total,
  }));
  totals.sort((a, b) => a.total - b.total || a.i - b.i);
  return totals[Math.floor(runs.length / 2)].i;
}

export function pickMedianRun<T extends ScopeShape>(runs: T[], tier?: PackageTier): T {
  return runs[medianRunIndex(runs, tier)];
}
