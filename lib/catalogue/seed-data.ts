import type { CatalogueCategory, CatalogueItem } from "@/lib/types";

/**
 * Illustrative starting rates (INR) for local development and demos only.
 * These are NOT verified vendor quotations or current market prices — every
 * rate must be reviewed and edited by the studio before it is relied upon.
 */
type SeedItem = {
  name: string;
  category: CatalogueCategory;
  unit: string;
  baseCostPerUnit: number;
  defaultQuantity?: number;
  sellingDescription?: string;
};

const SEED_ITEMS: SeedItem[] = [
  // Civil & demolition
  { name: "Demolition of existing tiling", category: "civil_demolition", unit: "sqft", baseCostPerUnit: 35, sellingDescription: "Careful removal and disposal of existing floor/wall tiles" },
  { name: "Brick wall partition (4\")", category: "civil_demolition", unit: "sqft", baseCostPerUnit: 180, sellingDescription: "New partition wall in brick masonry" },
  { name: "Debris removal & disposal", category: "civil_demolition", unit: "trip", baseCostPerUnit: 2500, defaultQuantity: 1 },

  // Waterproofing
  { name: "Bathroom waterproofing (chemical)", category: "waterproofing", unit: "sqft", baseCostPerUnit: 60, sellingDescription: "Two-coat chemical waterproofing with treatment at joints" },
  { name: "Terrace / balcony waterproofing", category: "waterproofing", unit: "sqft", baseCostPerUnit: 85 },

  // Plumbing
  { name: "CPVC water line re-routing", category: "plumbing", unit: "point", baseCostPerUnit: 1800, sellingDescription: "Per fixture point, concealed piping" },
  { name: "Drainage line relocation", category: "plumbing", unit: "point", baseCostPerUnit: 2800 },
  { name: "Geyser point plumbing", category: "plumbing", unit: "point", baseCostPerUnit: 1500, defaultQuantity: 1 },

  // Electrical
  { name: "Light point wiring (concealed)", category: "electrical", unit: "point", baseCostPerUnit: 950 },
  { name: "Switchboard & modular switches", category: "electrical", unit: "point", baseCostPerUnit: 1200 },
  { name: "AC point wiring with dedicated MCB", category: "electrical", unit: "point", baseCostPerUnit: 3200 },
  { name: "Exhaust fan point", category: "electrical", unit: "point", baseCostPerUnit: 850 },

  // Tiling & stone
  { name: "Vitrified floor tiling (2x2 ft)", category: "tiling_stone", unit: "sqft", baseCostPerUnit: 110, sellingDescription: "Branded vitrified tile, mid-range" },
  { name: "Anti-skid bathroom floor tiling", category: "tiling_stone", unit: "sqft", baseCostPerUnit: 95 },
  { name: "Wall tiling (ceramic, up to 7 ft)", category: "tiling_stone", unit: "sqft", baseCostPerUnit: 105 },
  { name: "Kitchen countertop — quartz", category: "tiling_stone", unit: "sqft", baseCostPerUnit: 420, sellingDescription: "Engineered quartz, mid-range finish" },

  // Sanitaryware & bathroom fittings
  { name: "Wall-hung WC with concealed tank", category: "sanitaryware", unit: "set", baseCostPerUnit: 22000, defaultQuantity: 1 },
  { name: "Wash basin with counter", category: "sanitaryware", unit: "set", baseCostPerUnit: 14000, defaultQuantity: 1 },
  { name: "Shower partition (glass)", category: "sanitaryware", unit: "sqft", baseCostPerUnit: 650 },
  { name: "Health faucet & bib cock set", category: "sanitaryware", unit: "set", baseCostPerUnit: 3200, defaultQuantity: 1 },

  // Carpentry & modular furniture
  { name: "Bed with storage (queen, laminate)", category: "carpentry_modular", unit: "unit", baseCostPerUnit: 48000, defaultQuantity: 1 },
  { name: "Modular kitchen base + wall units", category: "carpentry_modular", unit: "running ft", baseCostPerUnit: 2800 },
  { name: "Study table with drawers", category: "carpentry_modular", unit: "unit", baseCostPerUnit: 18000 },
  { name: "TV unit with storage", category: "carpentry_modular", unit: "running ft", baseCostPerUnit: 3200 },

  // Wardrobes & storage
  { name: "Sliding-door wardrobe (laminate finish)", category: "wardrobes_storage", unit: "sqft", baseCostPerUnit: 1650, sellingDescription: "Shutter + internal organisers, laminate finish" },
  { name: "Loft storage above wardrobe", category: "wardrobes_storage", unit: "sqft", baseCostPerUnit: 950 },
  { name: "Open bookshelf / display unit", category: "wardrobes_storage", unit: "sqft", baseCostPerUnit: 1100 },

  // Painting & wall finishes
  { name: "Wall putty + premium emulsion paint", category: "painting_finishes", unit: "sqft", baseCostPerUnit: 28 },
  { name: "Textured accent wall finish", category: "painting_finishes", unit: "sqft", baseCostPerUnit: 65 },
  { name: "Wallpaper (imported, mid-range)", category: "painting_finishes", unit: "sqft", baseCostPerUnit: 140 },

  // Lighting
  { name: "Cove lighting (LED strip, concealed)", category: "lighting", unit: "running ft", baseCostPerUnit: 420 },
  { name: "Decorative pendant light", category: "lighting", unit: "unit", baseCostPerUnit: 6500 },
  { name: "Recessed spotlight (COB LED)", category: "lighting", unit: "unit", baseCostPerUnit: 950 },

  // False ceiling
  { name: "Gypsum false ceiling (plain)", category: "false_ceiling", unit: "sqft", baseCostPerUnit: 85 },
  { name: "Gypsum false ceiling with cove detail", category: "false_ceiling", unit: "sqft", baseCostPerUnit: 120 },

  // Hardware
  { name: "Soft-close hinges & channels (per door)", category: "hardware", unit: "door", baseCostPerUnit: 850 },
  { name: "Cabinet handles & knobs (per unit)", category: "hardware", unit: "unit", baseCostPerUnit: 180 },

  // Glass & mirrors
  { name: "Mirror with LED backlight", category: "glass_mirrors", unit: "sqft", baseCostPerUnit: 480 },
  { name: "Toughened glass partition", category: "glass_mirrors", unit: "sqft", baseCostPerUnit: 720 },

  // Labour
  { name: "Mason & helper labour (daily)", category: "labour", unit: "day", baseCostPerUnit: 1800 },
  { name: "Carpenter labour (daily)", category: "labour", unit: "day", baseCostPerUnit: 2200 },
  { name: "Painter labour (daily)", category: "labour", unit: "day", baseCostPerUnit: 1500 },

  // Design & project management
  { name: "Design consultation & 3D visualisation", category: "design_pm", unit: "room", baseCostPerUnit: 15000, sellingDescription: "Covers concept design, revisions and 3D views" },
  { name: "Site supervision & project management", category: "design_pm", unit: "project", baseCostPerUnit: 35000, defaultQuantity: 1 },

  // Miscellaneous
  { name: "Transport & logistics", category: "miscellaneous", unit: "trip", baseCostPerUnit: 2000 },
  { name: "Site protection & cleaning", category: "miscellaneous", unit: "project", baseCostPerUnit: 5000, defaultQuantity: 1 },
];

export function buildSeedCatalogue(now: string = new Date().toISOString()): CatalogueItem[] {
  return SEED_ITEMS.map((item, index) => ({
    id: `seed-${index + 1}`,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...item,
  }));
}
