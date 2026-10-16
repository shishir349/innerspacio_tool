// Shared by client wizard and server. No "server-only": the wizard renders these.

export const BHK_OPTIONS = ["1", "2", "3", "4", "5+"] as const;
export type Bhk = (typeof BHK_OPTIONS)[number];

/** Size split only applies to 3 and 4 BHK (reference step 1). */
export const SIZED_BHKS: readonly Bhk[] = ["3", "4"];
export type HomeSize = "small" | "large";

export const QUOTE_ROOM_TYPES = [
  { value: "living_room", label: "Living Room", max: 2 },
  { value: "kitchen", label: "Kitchen", max: 2 },
  { value: "bedroom", label: "Bedroom", max: 5 },
  { value: "bathroom", label: "Bathroom", max: 5 },
  { value: "dining_room", label: "Dining", max: 1 },
  { value: "other", label: "Other (study, balcony…)", max: 2 },
] as const;
export type QuoteRoomType = (typeof QUOTE_ROOM_TYPES)[number]["value"];

/** Hard cap on rooms per lead — each room costs one AI image. */
export const MAX_QUOTE_ROOMS = 12;
/** Every render costs money: at most this many rooms per lead get a photo + AI image, whatever the home size. */
export const MAX_PHOTO_ROOMS = 6;

/** A typical home for each BHK, used to pre-fill the Rooms step (the visitor edits it). Fits MAX_QUOTE_ROOMS. */
export const BHK_ROOM_DEFAULTS: Record<Bhk, Partial<Record<QuoteRoomType, number>>> = {
  "1": { living_room: 1, kitchen: 1, bedroom: 1, bathroom: 1 },
  "2": { living_room: 1, dining_room: 1, kitchen: 1, bedroom: 2, bathroom: 2 },
  "3": { living_room: 1, dining_room: 1, kitchen: 1, bedroom: 3, bathroom: 3 },
  "4": { living_room: 1, dining_room: 1, kitchen: 1, bedroom: 4, bathroom: 4 },
  "5+": { living_room: 1, dining_room: 1, kitchen: 1, bedroom: 5, bathroom: 4 },
};
export const MAX_PHOTOS_PER_ROOM = 2;
export const MAX_IDEAS_LENGTH = 800;

export const PACKAGE_TIERS = ["essential", "premium", "luxury"] as const;
export type PackageTier = (typeof PACKAGE_TIERS)[number];

/**
 * Package price bands (₹) for a FULL typical home, per BHK and tier. Source: InnerSpacio's pricing sheet.
 * The quote/BOQ builder is calibrated so a full default home lands inside its band (lib/boq/build.ts, packageFactor);
 * fewer or extra rooms move the total from there. Villa / 5BHK is the "5+" option.
 * `perSqFt` is the sheet's whole-home baseline (any tier), kept for reference and sanity checks.
 */
export const PACKAGE_BANDS: Record<Bhk, Record<PackageTier, { min: number; max: number }> & { perSqFt: { min: number; max: number } }> = {
  "1": {
    essential: { min: 550_000, max: 750_000 },
    premium: { min: 750_000, max: 1_050_000 },
    luxury: { min: 1_050_000, max: 1_400_000 },
    perSqFt: { min: 1200, max: 2500 },
  },
  "2": {
    essential: { min: 800_000, max: 1_100_000 },
    premium: { min: 1_100_000, max: 1_800_000 },
    luxury: { min: 1_800_000, max: 2_500_000 },
    perSqFt: { min: 1400, max: 2800 },
  },
  "3": {
    essential: { min: 1_100_000, max: 1_500_000 },
    premium: { min: 1_500_000, max: 2_800_000 },
    luxury: { min: 2_800_000, max: 4_200_000 },
    perSqFt: { min: 1500, max: 3200 },
  },
  "4": {
    essential: { min: 1_500_000, max: 2_000_000 },
    premium: { min: 2_200_000, max: 3_500_000 },
    luxury: { min: 3_500_000, max: 5_500_000 },
    perSqFt: { min: 1600, max: 3800 },
  },
  "5+": {
    essential: { min: 2_200_000, max: 3_200_000 },
    premium: { min: 3_500_000, max: 5_500_000 },
    luxury: { min: 5_500_000, max: 12_000_000 },
    perSqFt: { min: 1800, max: 4500 },
  },
};

export const TIER_INFO: Record<
  PackageTier,
  { label: string; blurb: string; bullets: string[]; style: string }
> = {
  essential: {
    label: "Essential",
    blurb: "Smart, durable interiors for everyday living.",
    bullets: ["Affordable pricing", "Practical, convenient designs", "Core furniture and finishes"],
    style: "Practical, clean and budget-friendly modern interior with durable laminate and simple finishes",
  },
  premium: {
    label: "Premium",
    blurb: "Superior finishes and a more considered look.",
    bullets: ["Mid-range pricing", "Premium designs and materials", "Wide range of accessories"],
    style: "Refined contemporary interior with quality woodwork, layered lighting and premium finishes",
  },
  luxury: {
    label: "Luxury",
    blurb: "High-end, bespoke interiors with lavish detail.",
    bullets: ["Elite pricing", "Bespoke, lavish designs", "Extensive range of accessories"],
    style: "Luxurious bespoke interior with high-end materials, statement lighting, rich textures and custom joinery",
  },
};

export const CITIES = [
  "Ahmedabad", "Bengaluru", "Chennai", "Gurugram", "Hyderabad", "Secunderabad", "Kalyan", "Kolkata",
  "Mumbai", "Thane", "Navi Mumbai", "Noida", "Pune", "Delhi", "Jaipur", "Vadodara", "Nagpur", "Surat",
  "Nashik", "Chandigarh", "Lucknow", "Indore", "Bhopal", "Kochi", "Other",
] as const;

/** Metro cities priced a little higher in the estimate score. */
export const METRO_CITIES: readonly string[] = [
  "Mumbai", "Navi Mumbai", "Thane", "Delhi", "Gurugram", "Noida", "Bengaluru", "Hyderabad", "Secunderabad",
];
