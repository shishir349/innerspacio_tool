import { rateBasis } from "@/lib/rates/catalog";

/**
 * Open PROFESSIONAL / COMMERCIAL decisions in a BOQ. Pure and client-safe. Nothing here changes a quantity, a rate or a
 * total: each rule only FLAGS a line so a designer can confirm it. A line is
 *   confirmed — card rate on a measured / entered quantity, nothing open;
 *   assumed   — a default quantity or an automatically added line;
 *   awaiting  — rests on an unverified rate or an open professional decision.
 */
export type LineState = "confirmed" | "assumed" | "awaiting";

export interface DecisionLine {
  room: string;
  trade: string;
  item: string;
  title?: string;
  rateId?: string;
  uom: string;
  qty: number;
  qtySource?: "measured" | "entered" | "estimated";
  provisional?: boolean;
  /** Added by the engine, not by a scope item (deep clean, wallpaper primer). */
  autoAdded?: boolean;
}

interface Rule {
  id: string;
  /** "decision" waits on a professional; "assumption" is a default the designer can accept. */
  kind: "decision" | "assumption";
  message: string;
  applies: (l: DecisionLine, all: DecisionLine[]) => boolean;
}

const bathroom = (room: string) => /bathroom/i.test(room);
const VANITY = ["pr:VANITY", "pr:VANITYM"];

export const DECISIONS: readonly Rule[] = [
  {
    id: "kitchen-size",
    kind: "decision",
    message: "Kitchen cabinetry size is a code default (L-run × height). Confirm the layout and the base / wall / tall runs and heights.",
    applies: (l) => l.room === "Kitchen" && l.trade === "Modular Woodwork" && l.qtySource === "estimated",
  },
  {
    id: "paint-rate",
    kind: "decision",
    message: "Whole-home paint is priced as fresh Asian Royale Luxury Emulsion at the paint-sheet rate. Confirm repaint vs fresh, the emulsion grade and the area basis.",
    applies: (l) => l.rateId === "pr:PAINT",
  },
  {
    id: "tile-height",
    kind: "decision",
    message: "Bathroom wall tiling runs to the full room height. Confirm the tile height (the spec-mode standard is 8 ft).",
    applies: (l) => l.trade === "Wall Tiling" && bathroom(l.room),
  },
  {
    id: "vanity-fittings",
    kind: "decision",
    message: "A vanity unit (with granite counter) sits beside a sanitaryware / fittings package. Confirm the basin, taps and counter are not in both.",
    applies: (l, all) => {
      const room = (x: DecisionLine) => x.room === l.room;
      const isVanity = (x: DecisionLine) => !!x.rateId && VANITY.includes(x.rateId);
      const isFittings = (x: DecisionLine) => x.trade === "Bathroom Sanitaryware & CP Fittings";
      return (isVanity(l) && all.some((x) => room(x) && isFittings(x))) || (isFittings(l) && all.some((x) => room(x) && isVanity(x)));
    },
  },
  {
    id: "waterproofing",
    kind: "decision",
    message: "Waterproofing is priced. Confirm it is in scope (new wet area or existing membrane replaced).",
    applies: (l) => l.trade === "Waterproofing",
  },
  {
    id: "custom-rate",
    kind: "decision",
    message: "No rate-card item is selected for this line. Confirm the material grade and where the rate comes from.",
    applies: (l) => l.rateId === "",
  },
  {
    id: "auto-added",
    kind: "assumption",
    message: "Added by the system, not by a scope item (e.g. deep cleaning, wallpaper primer). Keep or delete.",
    applies: (l) => !!l.autoAdded,
  },
  {
    id: "electrical-count",
    kind: "assumption",
    message: "Electrical point count was not stated and defaulted to 1. Confirm the points required.",
    applies: (l) => l.trade === "Electrical & AC Works" && l.qtySource === "estimated" && ["Point", "Nos", "Set"].includes(l.uom),
  },
];

export interface Reason {
  /** Decision id, or "unverified-rate" / "assumed-quantity". */
  id: string;
  text: string;
}

export function lineAssessment(l: DecisionLine, all: DecisionLine[]): { state: LineState; reasons: Reason[] } {
  const reasons: Reason[] = [];
  let awaiting = false;
  let assumed = false;
  const basis = l.rateId ? rateBasis(l.rateId) : "unit";
  if (l.provisional || basis === "provisional" || (l.rateId?.startsWith("pr:") ?? false)) {
    awaiting = true;
    reasons.push({ id: "unverified-rate", text: l.provisional || basis === "provisional" ? "Provisional allowance — no sourced rate." : "Estimator rate, not yet verified against a current quote." });
  }
  for (const d of DECISIONS) {
    if (!d.applies(l, all)) continue;
    reasons.push({ id: d.id, text: d.message });
    if (d.kind === "decision") awaiting = true;
    else assumed = true;
  }
  if (l.qtySource === "estimated") {
    assumed = true;
    reasons.push({ id: "assumed-quantity", text: "Quantity is a default or estimate — confirm on site." });
  }
  return { state: awaiting ? "awaiting" : assumed ? "assumed" : "confirmed", reasons };
}

/** The open decisions across a BOQ, each with how many lines it touches. */
export function openDecisions(lines: DecisionLine[]) {
  return DECISIONS.map((d) => {
    const hit = lines.filter((l) => d.applies(l, lines));
    return { id: d.id, kind: d.kind, message: d.message, count: hit.length, lines: hit.map((l) => `${l.room} · ${l.title ?? l.item}`) };
  }).filter((d) => d.count > 0);
}
