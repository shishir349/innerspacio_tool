import { SPAZAY_RATES, type SpazayRate } from "@/lib/rates/spazay-data";

export interface RateEntry extends SpazayRate {
  /** No rate in the reference sheet: a provisional allowance to confirm before issue. */
  provisional?: boolean;
  /** Estimator project rate (observed on professional BOQs); not a row of the reference sheet. */
  estimator?: boolean;
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
    id: "al:SOFA2", code: "AL06", trade: "Loose Furniture", item: "Luxury — 2-seater sofa",
    uom: "Nos", unit: "per piece", rate: 107962, provisional: true,
    desc: `Supply of Luxury — 2-seater sofa, complete as per approved dimensions, material, finish, upholstery and selected model. Delivery and standard placement are included; customisation, wall fixing, electrical work and site assembly beyond standard supplier scope are excluded unless separately specified. ${NOT_IN_CARD}`,
  },
  {
    id: "al:SOFAL", code: "AL07", trade: "Loose Furniture", item: "Luxury — L-shaped 8-seater corner sofa",
    uom: "Nos", unit: "per piece", rate: 228000, provisional: true,
    desc: `Supply of Luxury L-shaped sofa — L-shaped corner sofa, complete as per approved dimensions, material, finish, upholstery and selected model. Delivery and standard placement are included; customisation, wall fixing, electrical work and site assembly beyond standard supplier scope are excluded unless separately specified. ${NOT_IN_CARD}`,
  },
  {
    id: "al:RAILING", code: "AL04", trade: "Mirrors, Glass & Metal Works", item: "Toughened glass railing on SS handrail (stairs / balcony / terrace)",
    uom: "Rft", unit: "running ft", rate: 2491, provisional: true,
    desc: `Providing and fixing internal glass railing with toughened safety glass panels on SS 304 handrail/posts, including brackets, clamps, channels, fittings and standard installation. Civil work, structural modification and special hardware are excluded unless separately specified. ${NOT_IN_CARD}`,
  },
  {
    id: "al:JACUZZI", code: "AL05", trade: "Civil Works", item: "Jacuzzi provision — civil, plumbing, electrical and tiling",
    uom: "L.S.", unit: "lump sum", rate: 60000, provisional: true,
    desc: `Civil, plumbing, electrical and tiling work for the jacuzzi provision, complete with installation (jacuzzi unit supply excluded). Tile at base rate as per selection. ${NOT_IN_CARD}`,
  },
];

/**
 * Rates the professional's BOQs (Apex Alphabet, Greenwoods villa) bill that are not rows of the
 * Spazay reference sheet: all-in unit rates and project rates, premium grade (tiers scale modular ones).
 */
const ESTIMATOR: readonly RateEntry[] = [
  { id: "pr:WARDROBE", code: "PR01", trade: "Modular Woodwork", item: "Modular wardrobe — all-in", uom: "Sq.Ft.", unit: "per sq ft", rate: 2491, desc: "Modular wardrobe with Postlam AT HDHMR carcass finished with 0.72mm laminate on both sides, HDHMR shutters with 1.2mm acrylic finish, Hettich hardware package, soft-close drawers, internal shelves and hanging provision, with handle/grooving as per approved design.", estimator: true },
  { id: "pr:LOBBYWARD", code: "PR02", trade: "Modular Woodwork", item: "Storage wardrobe, boilo board — all-in", uom: "Sq.Ft.", unit: "per sq ft", rate: 3114, desc: "Modular storage wardrobe with Boilo Board carcass finished with 0.72mm laminate on both sides, HDHMR shutters with 1.2mm acrylic finish, Hettich hardware package, soft-close drawers, internal shelves and hanging provision, as per approved design.", estimator: true },
  { id: "pr:TVUNIT", code: "PR03", trade: "Modular Woodwork", item: "Modular TV unit — all-in", uom: "Sq.Ft.", unit: "per sq ft", rate: 1869, desc: "Modular TV unit with carcass in 18mm HDHMR, finished with 0.72mm laminate on both sides, shutters/fronts in HDHMR with 1.2mm acrylic finish, including Hettich hardware, drawers, open shelves and cable management provision as per approved design.", estimator: true },
  { id: "pr:STUDY", code: "PR04", trade: "Modular Woodwork", item: "Modular study / office storage — all-in", uom: "Sq.Ft.", unit: "per sq ft", rate: 2180, desc: "Modular study/home-office storage with carcass in Postlam AT HDHMR with both-side 0.72 mm laminate, shutters in HDHMR finished with laminate/acrylic, Hettich hardware package, handles/grooving and provision for drawers, storage compartments and shelves as per approved design.", estimator: true },
  { id: "pr:UTILITY", code: "PR05", trade: "Modular Woodwork", item: "Modular utility counter with storage — all-in", uom: "Sq.Ft.", unit: "per sq ft", rate: 2180, desc: "Modular counter with storage below, carcass in Postlam AT HDHMR with both-side 0.72 mm laminate, shutters in HDHMR finished with 1 mm HGL laminate, Hettich hardware package, handles/grooving, storage compartments and drawers as per approved design.", estimator: true },
  { id: "pr:KIDSSTUDY", code: "PR06", trade: "Modular Woodwork", item: "Modular study unit / dresser, premium finish — all-in", uom: "Sq.Ft.", unit: "per sq ft", rate: 2336, desc: "Modular unit with Postlam AT HDHMR carcass finished with 0.72mm laminate on both sides, premium laminate/acrylic fronts, soft-close drawers with Hettich hardware, internal storage provision, worktop and handle/grooving as per approved design. Mirror is a separate item.", estimator: true },
  { id: "pr:NOOK", code: "PR07", trade: "Modular Woodwork", item: "Reading nook with seating and shelving — all-in", uom: "Sq.Ft.", unit: "per sq ft", rate: 2725, desc: "Custom reading nook comprising upholstered lounge seating with high-density foam and fabric upholstery, integrated open shelving/storage, soft ambient warm-white LED lighting and side table, with premium veneer/painted finish and concealed electrical provision, as per approved design.", estimator: true },
  { id: "pr:KITCHEN", code: "PR08", trade: "Modular Woodwork", item: "Modular kitchen (base, wall, tall, island) — all-in", uom: "Sq.Ft.", unit: "per sq ft", rate: 3348, desc: "Modular kitchen comprising base and wall units in 18mm HDHMR/BWP, finished with 1.5mm acrylic on shutters/fronts, internal storage divisions, shelves, drawers and cabinets, Hettich InnoTech soft-close drawers and Hettich soft-close hinges, standard hardware, edge finishing and fixing as per approved design. Countertop and dado tile are separate.", estimator: true },
  { id: "pr:CROCKERY", code: "PR09", trade: "Modular Woodwork", item: "Modular crockery unit — all-in", uom: "Sq.Ft.", unit: "per sq ft", rate: 2803, desc: "Modular crockery unit with carcass in 18mm HDHMR, finished with 1.2mm acrylic on shutters/fronts, Hettich InnoTech soft-close drawers and hinges, internal shelves, standard partitions, edge banding and hardware as per approved design.", estimator: true },
  { id: "pr:VANITY", code: "PR10", trade: "Modular Woodwork", item: "Bathroom vanity unit with granite counter", uom: "Nos", unit: "per unit", rate: 46714, desc: "Supply and installation of modular washroom vanity with Boilo Board carcass finished with 0.72mm laminate on both sides, HDHMR shutters with 1.2mm acrylic finish, Hettich hardware, soft-close drawers, internal storage and handle/grooving, including granite counter of base rate Rs. 250 per sq ft.", estimator: true },
  { id: "pr:VANITYM", code: "PR11", trade: "Modular Woodwork", item: "Master bathroom vanity unit with granite counter", uom: "Nos", unit: "per unit", rate: 54500, desc: "Supply and installation of modular master-washroom vanity with Boilo Board carcass finished with 0.72mm laminate on both sides, HDHMR shutters with 1.2mm acrylic finish, Hettich hardware, soft-close drawers, internal storage and handle/grooving, including granite counter.", estimator: true },
  { id: "pr:VMIRROR", code: "PR12", trade: "Mirrors, Glass & Metal Works", item: "Vanity mirror with back panel and frame", uom: "Sq.Ft.", unit: "per sq ft", rate: 1100, desc: "Supply and installation of washroom vanity mirror panel with 18mm MR ply back support and frame structure on wall with 4mm mirror fixed with mirror tape or screws, with finishing of exposed areas and edges.", estimator: true },
  { id: "pr:VMIRRORM", code: "PR13", trade: "Mirrors, Glass & Metal Works", item: "Master vanity mirror with back panel and frame", uom: "Sq.Ft.", unit: "per sq ft", rate: 1600, desc: "Supply and installation of master-washroom vanity mirror panel with 18mm MR ply back support and frame structure on wall with 4mm mirror fixed with mirror tape or screws, with finishing of exposed areas and edges.", estimator: true },
  { id: "pr:DMIRROR", code: "PR14", trade: "Mirrors, Glass & Metal Works", item: "Dresser mirror with back panel and frame", uom: "Sq.Ft.", unit: "per sq ft", rate: 1479, desc: "Supply and installation of dresser mirror panel with 18mm MR ply at the back support and frame structure on wall with 4mm mirror on the top fixed with mirror tape or screws, with finishing of exposed areas and edges.", estimator: true },
  { id: "pr:MIRROR", code: "PR15", trade: "Mirrors, Glass & Metal Works", item: "Feature / wall mirror in approved shape", uom: "Sq.Ft.", unit: "per sq ft", rate: 1635, desc: "Providing and fixing feature-wall mirror in approved shape/design/colour with installation.", estimator: true },
  { id: "pr:SHOWER", code: "PR16", trade: "Mirrors, Glass & Metal Works", item: "10mm toughened-glass sliding shower partition", uom: "Sq.Ft.", unit: "per sq ft", rate: 1168, desc: "Providing and fixing 10mm toughened glass sliding shower partition, including standard cutting, polished/finished edges and standard fittings. Special hardware, lighting/driver, civil backing and electrical works are excluded unless separately specified.", estimator: true },
  { id: "pr:FEATURE", code: "PR17", trade: "Wall Panelling", item: "Wall enhancement — laminate / WPC louver / imported panel / PVD inlay / LED", uom: "Sq.Ft.", unit: "per sq ft", rate: 1012, desc: "Providing and fixing feature wall comprising laminate, WPC louver, imported panel, PVD-finished metal inlays, concealed LED profiles and associated substrate/fixing system, with all necessary backing, framing, adhesives, hardware, electrical provisions, edge finishing and installation.", estimator: true },
  { id: "pr:FRENCH", code: "PR18", trade: "Wall Panelling", item: "Premium French moulding with levels in POP and wallpaper", uom: "Sq.Ft.", unit: "per sq ft", rate: 389, desc: "Providing and fixing premium French moulding with levels in POP and wallpaper inside, including wall trims and custom wallpaper.", estimator: true },
  { id: "pr:WAINSCOT", code: "PR19", trade: "Wall Panelling", item: "Wainscoting with wallpaper and wall-light provision", uom: "Rft", unit: "running ft", rate: 467, desc: "Providing and fixing premium wall wainscoting with wallpaper and wall-light provision, including the metal strip and groove in wall using POP.", estimator: true },
  { id: "pr:FOYERPANEL", code: "PR20", trade: "Wall Panelling", item: "12mm ply/HDHMR with WPC louver / laminate panelling", uom: "Sq.Ft.", unit: "per sq ft", rate: 779, desc: "Providing and fixing 12mm ply/HDHMR with WPC louver/laminate in approved pattern/design, with cutting, jointing, fixing and installation as per approved design and sample.", estimator: true },
  { id: "pr:PVCCEIL", code: "PR21", trade: "False Ceiling", item: "PVC ceiling with framework", uom: "Sq.Ft.", unit: "per sq ft", rate: 311, desc: "Providing and fixing PVC ceiling, including approved framework/support system, boards/panels, cutting, joint treatment and finishing. Wiring, fixtures, painting and insulation are excluded; scaffolding extra as per actual.", estimator: true },
  { id: "pr:PAINT", code: "PR22", trade: "Paint & Polish", item: "Fresh paint — luxury emulsion, whole home", uom: "Sq.Ft.", unit: "per sq ft", rate: 62, desc: "Providing and applying fresh paint - luxury emulsion, including surface preparation, crack filling, putty, primer and required finish coats, as per approved shade. Major wall repairs, damp treatment, texture removal and furniture shifting are excluded unless separately specified.", estimator: true },
  { id: "pr:BOOKSHELF", code: "PR24", trade: "Modular Woodwork", item: "Floating shelf with metal rods (MS, powder coated) — bookshelf", uom: "Rft", unit: "running ft", rate: 1168, desc: "Providing and fixing floating shelf with metal rods (MS with powder coating) as book shelf.", estimator: true },
  { id: "pr:QUARTZ", code: "PR23", trade: "Stone & Countertops", item: "Quartz countertop incl. backsplash, fabrication and fixing", uom: "Sq.Ft.", unit: "per sq ft", rate: 1246, desc: "Providing and fixing countertop in 20mm quartz, including backsplash/dado area to match, cutting, fixing and edge polishing.", estimator: true },
];

const ALL: readonly RateEntry[] = [...SPAZAY_RATES, ...ALLOWANCES, ...ESTIMATOR];
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
