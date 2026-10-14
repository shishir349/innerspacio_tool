import { quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";
import { summarizeBoq } from "@/lib/boq/build";
import type { PackageTier } from "@/lib/quote/constants";

export interface ScopeLike {
  rooms: PlanRoom[];
  items: BriefItem[];
  assumptions: string[];
  unpriced: { requirement: string; reason: string }[];
  questions: string[];
  dropped: string[];
}

/** What the BOQ page receives once a plan analysis is finished (any AI provider). */
export function briefResponse(scope: ScopeLike, tier: PackageTier, city: string) {
  const { lines, warnings } = quantify(scope.items, scope.rooms, { tier, city });
  return {
    tier,
    city,
    rooms: scope.rooms,
    items: scope.items,
    lines,
    summary: summarizeBoq(lines),
    warnings: [...warnings, ...scope.dropped],
    assumptions: scope.assumptions,
    unpriced: scope.unpriced,
    questions: scope.questions,
  };
}
