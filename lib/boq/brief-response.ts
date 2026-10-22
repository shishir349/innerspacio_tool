import { HELD_STATUSES, quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";
import { summarizeBoq } from "@/lib/boq/build";
import type { PackageTier } from "@/lib/quote/constants";
import type { RateSheet } from "@/lib/rates/sheets";
import { pricingVersion } from "@/lib/boq/provenance";

export interface ScopeLike {
  rooms: PlanRoom[];
  items: BriefItem[];
  assumptions: string[];
  unpriced: { requirement: string; reason: string }[];
  questions: string[];
  dropped: string[];
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2));

/**
 * The model's "unpriced" list is advisory and often names a requirement that its own items did
 * price (it mis-pairs reasons with requirements). A requirement counts as unpriced only if no
 * produced line covers it.
 */
export function reconcileUnpriced(
  unpriced: { requirement: string; reason: string }[],
  coverage: { requirement: string; lines: number }[]
) {
  const done = coverage.filter((c) => c.lines > 0).map((c) => words(c.requirement));
  return unpriced.filter((u) => {
    if (/\b(is|are|was|were|been)\s+priced\b|priced (using|as|with|under)|covered by/i.test(u.reason)) return false;
    const w = words(u.requirement);
    if (w.size === 0) return true;
    return !done.some((d) => {
      let hit = 0;
      for (const x of w) if (d.has(x)) hit++;
      return hit / Math.min(w.size, d.size || 1) >= 0.6;
    });
  });
}

/** What the BOQ page receives once a plan analysis is finished (any AI provider). */
export function briefResponse(scope: ScopeLike, tier: PackageTier, city: string, sheet: RateSheet = "spazay", readingHash?: string) {
  const q = quantify(scope.items, scope.rooms, { tier, city, sheet });
  // A read that found no scope items must not become a BOQ of whole-home extras (deep clean) alone.
  const empty = scope.items.length === 0;
  const lines = empty ? [] : q.lines;
  const warnings = empty ? [...q.warnings, "No scope items were extracted from the requirements, so nothing was priced."] : q.warnings;
  const coverage = q.coverage;
  const unpriced = reconcileUnpriced(scope.unpriced, coverage);
  // A requirement that produced no line and wasn't reported as unpriced is a silent gap.
  const reported = new Set(unpriced.map((u) => u.requirement));
  const gaps = coverage
    .filter((c) => c.lines === 0 && !reported.has(c.requirement) && !HELD_STATUSES.includes(c.status ?? "NEW"))
    .map((c) => `No BOQ line was produced for: “${c.requirement.slice(0, 80)}” (${c.room}). Add it manually.`);
  return {
    tier,
    city,
    sheet,
    rooms: scope.rooms,
    items: scope.items,
    lines,
    summary: summarizeBoq(lines),
    warnings: [...warnings, ...gaps, ...scope.dropped],
    assumptions: scope.assumptions,
    unpriced,
    questions: scope.questions,
    coverage,
    pricingVersion: pricingVersion(),
    // The reading as the AI produced it, so the client can store it untouched and a later identical run can reuse it.
    reading: readingHash ? { hash: readingHash, scope } : undefined,
  };
}
