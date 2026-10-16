import type { Bhk, HomeSize, QuoteRoomType } from "@/lib/quote/constants";
import { BHK_ROOM_DEFAULTS } from "@/lib/quote/constants";

/**
 * Standard sizes the SPEC-MODE BOQ (BHK + rooms, no plan) rests on. Every number here is an
 * ESTIMATE, not a measurement: the builder tags those lines `qtySource: "estimated"` and prints the
 * assumptions next to the BOQ. Edit this file to match your estimators' real standards; nothing else
 * in the builder hard-codes a size. Plan mode does not use it (it measures the plan).
 */

/** Carpet area (sq ft) by BHK / size. Typical ranges, not site data. */
export const CARPET_SQFT: Record<Bhk, { small: number; large: number }> = {
  "1": { small: 600, large: 600 },
  "2": { small: 950, large: 950 },
  "3": { small: 1250, large: 1600 },
  "4": { small: 1900, large: 2400 },
  "5+": { small: 3000, large: 3000 },
};

/** Standard room size (L × B, ft) before the home's carpet-area scale is applied. */
export const ROOM_STANDARDS: Record<QuoteRoomType, [number, number]> = {
  living_room: [14, 16],
  kitchen: [9, 11],
  bedroom: [12, 14],
  bathroom: [5, 8], // wet rooms are not scaled
  dining_room: [10, 11],
  other: [8, 10],
};

export const CEILING_H = 10; // ft
/** Share of wall area left after doors and windows. */
export const WALL_NET = 0.85;
/** Bedrooms after the master are this much smaller (linear). */
export const SECONDARY_BEDROOM = 0.9;
/** Room scale is kept inside this band so a mis-chosen home never produces absurd rooms. */
export const SCALE_LIMITS = { min: 0.7, max: 1.8 } as const;

/** Furniture and joinery assumptions (width × height ft unless noted). */
export const FURNITURE = {
  wardrobeMaster: { w: 8, h: 7 },
  wardrobeOther: { w: 6, h: 7 },
  /** A wardrobe never takes more than this share of the room's long side. */
  wardrobeMaxShare: 0.65,
  loftH: 2.5,
  bedPanel: { w: 5.5, h: 4 },
  dresser: { w: 4, h: 3 },
  tvBase: { w: 8, h: 2 },
  tvFloat: { w: 4, h: 2 },
  tvPanel: { w: 8, h: 7 },
  crockery: { w: 5, h: 7 },
  kitchenUnitH: 2.5,
  kitchenWallRun: 0.8, // wall units as a share of the base run
  kitchenTall: { w: 2, h: 7 },
  counterDepth: 2,
  vanity: { w: 3, h: 2.5 },
  partition: { w: 3, h: 7 },
  vanityMirror: { w: 2, h: 3 },
  studyDesk: { w: 6, h: 2.5 },
  bathWallTileH: 8,
} as const;

export function carpetArea(bhk: Bhk, size: HomeSize | undefined): number {
  const c = CARPET_SQFT[bhk] ?? CARPET_SQFT["2"];
  return size === "large" ? c.large : c.small;
}

/** Floor area of the BHK's standard room set at scale 1: the budget the carpet area is divided over. */
export function standardSetArea(bhk: Bhk): number {
  const set = BHK_ROOM_DEFAULTS[bhk] ?? BHK_ROOM_DEFAULTS["2"];
  return Object.entries(set).reduce((n, [t, c]) => {
    const [l, b] = ROOM_STANDARDS[t as QuoteRoomType];
    return n + l * b * (c ?? 0);
  }, 0);
}

/** Linear scale applied to dry-room sizes: sqrt(carpet area ÷ the standard set's area). Independent of how many rooms are selected. */
export function roomScale(bhk: Bhk, size: HomeSize | undefined): number {
  const s = Math.sqrt(carpetArea(bhk, size) / standardSetArea(bhk));
  return Math.min(SCALE_LIMITS.max, Math.max(SCALE_LIMITS.min, s));
}
