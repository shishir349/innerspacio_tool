import {
  METRO_CITIES,
  PACKAGE_TIERS,
  SIZED_BHKS,
  TIER_RANGE_LAKH,
  type Bhk,
  type HomeSize,
  type PackageTier,
  type QuoteRoomType,
} from "@/lib/quote/constants";

// ponytail: placeholder weights — back-test against real jobs before promoting.
const BHK_BASE: Record<Bhk, number> = { "1": 1.0, "2": 1.5, "3": 2.0, "4": 2.5, "5+": 3.0 };
const ROOM_WEIGHT: Record<QuoteRoomType, number> = {
  kitchen: 1.5,
  living_room: 1.0,
  bedroom: 0.8,
  bathroom: 0.7,
  dining_room: 0.5,
  other: 0.5,
};
const SCORE_MIN = 1.4; // 1 BHK, small, non-metro, one room
const SCORE_MAX = 12.8; // 5+ BHK, large, metro, six rooms

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
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** 0..1 position of this home inside any tier's range. Never NaN. */
export function quoteScore(input: QuoteEstimateInput): number {
  const sizeFactor = SIZED_BHKS.includes(input.bhk) && input.homeSize === "large" ? 1.15 : 0.9;
  const cityFactor = METRO_CITIES.includes(input.city) ? 1.1 : 1.0;
  let roomPoints = 0;
  for (const [type, count] of Object.entries(input.rooms)) {
    const w = ROOM_WEIGHT[type as QuoteRoomType] ?? 0;
    const n = Number.isFinite(count) ? Math.max(0, Math.floor(count as number)) : 0;
    roomPoints += w * n;
  }
  const score = (BHK_BASE[input.bhk] ?? 1) * sizeFactor * cityFactor + roomPoints;
  return clamp((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN), 0, 1);
}

export function estimateForTier(input: QuoteEstimateInput, tier: PackageTier): TierEstimate {
  const { min, max } = TIER_RANGE_LAKH[tier];
  const span = max - min;
  const center = min + quoteScore(input) * span;
  const half = span * 0.125;
  let lowLakh = clamp(roundHalf(center - half), min, max);
  const highLakh = clamp(roundHalf(center + half), min, max);
  if (lowLakh >= highLakh) lowLakh = Math.max(min, highLakh - 0.5);
  return { tier, lowLakh, highLakh: Math.max(highLakh, lowLakh + 0.5) };
}

export function estimateAllTiers(input: QuoteEstimateInput): TierEstimate[] {
  return PACKAGE_TIERS.map((t) => estimateForTier(input, t));
}

export function formatLakh(n: number): string {
  return `₹${Number.isInteger(n) ? n : n.toFixed(1)}L`;
}

export function formatRange(e: Pick<TierEstimate, "lowLakh" | "highLakh">): string {
  return `${formatLakh(e.lowLakh)} – ${formatLakh(e.highLakh)}`;
}
