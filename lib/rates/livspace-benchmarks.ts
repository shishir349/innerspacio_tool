/**
 * Livspace NCR "Cx Unit Price (Incl. Tax)" for Vesta / Reno+ design stage, read from
 * `pricing/Livspace Rates - NCR City MRC`. Used ONLY to sanity-check our Spazay-built
 * numbers (see build.test.ts) and to justify them — never billed.
 * Prices include 18% GST; Spazay's GST treatment is unconfirmed, so tests keep a wide margin.
 */
export interface Benchmark {
  label: string;
  uom: "Sq.Ft." | "Rft" | "Nos";
  /** ₹ incl. GST. */
  price: number;
}

export const LIVSPACE_NCR = {
  swingWardrobe: { label: "Swing shutter wardrobe — standard", uom: "Sq.Ft.", price: 2500 },
  slidingWardrobe: { label: "Sliding shutter wardrobe — standard", uom: "Sq.Ft.", price: 3180 },
  kitchenBaseShutter: { label: "Kitchen base unit, shutter — standard", uom: "Sq.Ft.", price: 3375 },
  kitchenWallShutter: { label: "Kitchen wall unit, shutter — standard", uom: "Sq.Ft.", price: 2410 },
  tallShutter: { label: "Tall shutter storage — standard", uom: "Sq.Ft.", price: 2372 },
  laminateWallPanelling: { label: "Laminate wall panelling", uom: "Sq.Ft.", price: 870 },
  laminateTvPanelling: { label: "Laminate TV panelling", uom: "Sq.Ft.", price: 924 },
  gypsumCeilingPlain: { label: "Standard gypsum false ceiling — plain", uom: "Sq.Ft.", price: 153 },
  freshPaintPremium: { label: "Asian Royale Aspira fresh painting", uom: "Sq.Ft.", price: 39 },
  vitrifiedFloorTile: { label: "Vitrified/ceramic floor tile install", uom: "Sq.Ft.", price: 101 },
  graniteInstall: { label: "Kitchen granite platform install", uom: "Sq.Ft.", price: 398 },
  toiletTilePackage: { label: "Toilet floor + wall tiling package", uom: "Sq.Ft.", price: 736 },
  electricalPackage25: { label: "Electrical installation package, 25 points", uom: "Nos", price: 6630 },
} as const satisfies Record<string, Benchmark>;

/** Livspace modular standard → HDHMR core upgrade → HGL shutter upgrade, ₹/sq ft deltas. */
export const LIVSPACE_UPGRADES = { hdhmrCore: 255, hglShutter: 835 } as const;

export const GST = 0.18;
