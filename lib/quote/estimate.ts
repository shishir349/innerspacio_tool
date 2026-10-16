import { buildBoq, carpetArea, summarizeBoq, type BoqInput, type BoqLine } from "@/lib/boq/build";
import {
  PACKAGE_TIERS,
  QUOTE_ROOM_TYPES,
  TIER_INFO,
  type Bhk,
  type HomeSize,
  type PackageTier,
  type QuoteRoomType,
} from "@/lib/quote/constants";

export { formatLakh, formatRange } from "@/lib/quote/format";

/**
 * The estimate IS the sum of a generated BOQ (qty × published rate), widened to a
 * range for site conditions and final selections. Nothing here is a made-up score.
 */
const RANGE_LOW = 0.92;
const RANGE_HIGH = 1.12;

export interface QuoteEstimateInput {
  bhk: Bhk;
  homeSize?: HomeSize;
  city: string;
  rooms: Partial<Record<QuoteRoomType, number>>;
}

export interface TierEstimate {
  tier: PackageTier;
  lowLakh: number;
  highLakh: number;
}

const roundHalf = (n: number) => Math.round(n * 2) / 2;

export function toBoqInput(input: QuoteEstimateInput, tier: PackageTier): BoqInput {
  const rooms: BoqInput["rooms"] = [];
  for (const t of QUOTE_ROOM_TYPES) {
    const raw = input.rooms[t.value];
    const n = Number.isFinite(raw) ? Math.min(Math.max(0, Math.floor(raw as number)), t.max) : 0;
    for (let i = 0; i < n; i++) rooms.push({ roomType: t.value });
  }
  return { bhk: input.bhk, homeSize: input.homeSize, city: input.city, tier, rooms };
}

function rangeFor(total: number, tier: PackageTier): TierEstimate {
  const lowLakh = roundHalf((total * RANGE_LOW) / 1e5);
  const highLakh = Math.max(roundHalf((total * RANGE_HIGH) / 1e5), lowLakh + 0.5);
  return { tier, lowLakh, highLakh };
}

export function estimateForTier(input: QuoteEstimateInput, tier: PackageTier): TierEstimate {
  return rangeFor(summarizeBoq(buildBoq(toBoqInput(input, tier))).total, tier);
}

export function estimateAllTiers(input: QuoteEstimateInput): TierEstimate[] {
  return PACKAGE_TIERS.map((t) => estimateForTier(input, t));
}

export interface QuoteBreakdown {
  carpetSqFt: number;
  specification: string;
  totalLakh: number;
  byTrade: { label: string; lakh: number; pct: number }[];
  byRoom: { label: string; lakh: number; pct: number }[];
  /** Largest line items, so the customer can see what the money buys. */
  highlights: { room: string; text: string; lakh: number }[];
  assumptions: string[];
}

const SPEC_TEXT: Record<PackageTier, string> = {
  essential: "Prelaminated particle-board carcass, 1 mm laminate shutters, EBCO hardware, gypsum ceiling, premium-basic emulsion paint, steel-grey granite counters.",
  premium: "HDHMR carcass, Royal Touch laminate shutters, Hettich hardware, perimeter gypsum ceiling, premium emulsion, quartz counters, SPC / vitrified flooring.",
  luxury: "BWP plywood carcass, acrylic shutters, Hettich hardware, stepped ceilings with LED profiles, luxury emulsion, premium quartz, Italian marble / engineered wood.",
};

const lakh1 = (n: number) => Math.round((n / 1e5) * 10) / 10;

function highlight(l: BoqLine) {
  const q = Number.isInteger(l.qty) ? l.qty : l.qty.toFixed(1);
  const rate = `₹${l.rate.toLocaleString("en-IN")}`;
  return `${l.item} — ${q} ${l.uom} × ${rate}`;
}

/** Customer-safe explanation of an estimate: published rates, quantities, no margins or costs. */
export function explainEstimate(input: QuoteEstimateInput, tier: PackageTier): QuoteBreakdown {
  const boq = toBoqInput(input, tier);
  const lines = buildBoq(boq);
  const s = summarizeBoq(lines);
  const pct = (n: number) => (s.total > 0 ? Math.round((n / s.total) * 100) : 0);
  const carpet = carpetArea(input.bhk, input.homeSize);
  const roomCount = boq.rooms.length;

  // Merge identical (room, item) rows so a modular unit's three lines read as one highlight.
  const merged = new Map<string, { room: string; text: string; amount: number }>();
  for (const l of lines) {
    if (l.item === "Cleaning / Protection") continue;
    const key = `${l.room}|${l.item}`;
    const cur = merged.get(key);
    if (cur) cur.amount += l.amount;
    else merged.set(key, { room: l.room, text: highlight(l), amount: l.amount });
  }

  return {
    carpetSqFt: carpet,
    specification: SPEC_TEXT[tier],
    totalLakh: lakh1(s.total),
    byTrade: s.byTrade.slice(0, 8).map((t) => ({ label: t.trade, lakh: lakh1(t.amount), pct: pct(t.amount) })),
    byRoom: s.byRoom.map((r) => ({ label: r.room, lakh: lakh1(r.amount), pct: pct(r.amount) })),
    highlights: [...merged.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
      .map((h) => ({ room: h.room, text: h.text, lakh: lakh1(h.amount) })),
    assumptions: [
      `Typical ${input.bhk} BHK of about ${carpet.toLocaleString("en-IN")} sq ft carpet area, ${roomCount} room${roomCount === 1 ? "" : "s"} in scope.`,
      `${TIER_INFO[tier].label} specification: ${SPEC_TEXT[tier]}`,
      "Quantities use standard room sizes — your designer replaces them with site measurements.",
      "Package pricing for a typical home of this size; final scope and rates are confirmed after a site visit. GST as applicable.",
      "Excludes structural / major civil changes, appliances, and any item you add later.",
    ],
  };
}
