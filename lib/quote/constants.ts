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
export const MAX_QUOTE_ROOMS = 6;
export const MAX_PHOTOS_PER_ROOM = 2;
export const MAX_IDEAS_LENGTH = 800;

export const PACKAGE_TIERS = ["essential", "premium", "luxury"] as const;
export type PackageTier = (typeof PACKAGE_TIERS)[number];

/** ₹ lakh. Premium stretched to 55L so there is no dead zone (decision: plan). */
export const TIER_RANGE_LAKH: Record<PackageTier, { min: number; max: number }> = {
  essential: { min: 15, max: 20 },
  premium: { min: 20, max: 55 },
  luxury: { min: 55, max: 90 },
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
