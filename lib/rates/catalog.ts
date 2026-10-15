import { SPAZAY_RATES, type SpazayRate } from "@/lib/rates/spazay-data";

export interface RateEntry extends SpazayRate {
  /** No rate in the reference sheet: a provisional allowance to confirm before issue. */
  provisional?: boolean;
}
export type { SpazayRate };

const NOT_IN_CARD = "RATE NOT STATED IN THE REFERENCE RATE LIST — provisional allowance, to be confirmed on selection or vendor quote.";

/**
 * Items clients ask for that the Spazay card has no rate for. Allowance values are the
 * professional estimator's (expected_BOQ, Apex Alphabet); replace as real quotes arrive.
 */
const ALLOWANCES: readonly RateEntry[] = [
  {
    id: "al:CURTAIN", code: "AL01", trade: "Furnishings & Décor", item: "Curtains — fabric, lining, stitching and installation",
    uom: "Rft", unit: "running ft", rate: 800, provisional: true,
    desc: `Supply and installation of new curtains in the approved fabric and lining, including stitching, pleating, hooks and hanging, complete as per approved selection. Includes removal of the existing curtains, channels and fittings. ${NOT_IN_CARD}`,
  },
  {
    id: "al:NAMEPLATE", code: "AL02", trade: "Furnishings & Décor", item: "Entrance nameplate — design, supply and installation",
    uom: "Nos", unit: "per piece", rate: 6000, provisional: true,
    desc: `Design, supply and installation of the entrance nameplate in the approved material and finish (brass, acrylic or veneer), including fixings, backing preparation and alignment. ${NOT_IN_CARD}`,
  },
  {
    id: "al:VGARDEN", code: "AL03", trade: "Market Supply", item: "Vertical garden / green wall with irrigation",
    uom: "Sq.Ft.", unit: "sq ft", rate: 1000, provisional: true,
    desc: `Supply and installation of a modular vertical garden to the wall, including growing-medium pockets, selected plants, drip irrigation and drainage arrangement, complete as per approved layout. Plant replacement guarantee, structural support and water point provision are excluded unless separately specified. ${NOT_IN_CARD}`,
  },
  {
    id: "al:RAILING", code: "AL04", trade: "Mirrors, Glass & Metal Works", item: "Toughened glass railing on SS handrail (stairs / balcony / terrace)",
    uom: "Rft", unit: "running ft", rate: 6500, provisional: true,
    desc: `Providing and fixing internal glass railing with toughened safety glass panels on SS 304 handrail/posts, including brackets, clamps, channels, fittings and standard installation. Civil work, structural modification and special hardware are excluded unless separately specified. ${NOT_IN_CARD}`,
  },
  {
    id: "al:JACUZZI", code: "AL05", trade: "Civil Works", item: "Jacuzzi provision — civil, plumbing, electrical and tiling",
    uom: "L.S.", unit: "lump sum", rate: 150000, provisional: true,
    desc: `Civil, plumbing, electrical and tiling work for the jacuzzi provision, complete with installation (jacuzzi unit supply excluded). Tile at base rate as per selection. ${NOT_IN_CARD}`,
  },
];

const ALL: readonly RateEntry[] = [...SPAZAY_RATES, ...ALLOWANCES];
const BY_ID = new Map<string, RateEntry>(ALL.map((r) => [r.id, r]));

/** Every rate we can bill (Spazay card + provisional allowances), in sheet order. */
export const RATE_CARD: readonly RateEntry[] = ALL;

export function findRate(id: string): RateEntry | undefined {
  return BY_ID.get(id);
}

/** Throws on an unknown id so a typo in a scope template fails a test, not a quote. */
export function getRate(id: string): RateEntry {
  const r = BY_ID.get(id);
  if (!r) throw new Error(`Unknown rate id: ${id}`);
  return r;
}
