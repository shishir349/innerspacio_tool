import { quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";
import { summarizeBoq } from "@/lib/boq/build";
import type { PackageTier } from "@/lib/quote/constants";
import type { RateSheet } from "@/lib/rates/sheets";

export interface ScopeLike {
  rooms: PlanRoom[];
  items: BriefItem[];
  assumptions: string[];
  unpriced: { requirement: string; reason: string }[];
  questions: string[];
  dropped: string[];
}

/** What the BOQ page receives once a plan analysis is finished (any AI provider). */
export function briefResponse(scope: ScopeLike, tier: PackageTier, city: string, sheet: RateSheet = "spazay") {
  const { lines, warnings, coverage } = quantify(scope.items, scope.rooms, { tier, city, sheet });
  // A requirement that produced no line and wasn't reported as unpriced is a silent gap.
  const reported = new Set(scope.unpriced.map((u) => u.requirement));
  const gaps = coverage
    .filter((c) => c.lines === 0 && !reported.has(c.requirement))
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
    unpriced: scope.unpriced,
    questions: scope.questions,
    coverage,
  };
}
