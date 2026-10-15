// Core domain types shared across the server (data layer, AI, pricing) and the UI.
// Kept framework-agnostic so the pricing engine and AI schemas can be unit tested in isolation.

export type Id = string;

export type LengthUnit = "ft" | "m";

export type ProjectStatus =
  | "new"
  | "in_progress"
  | "concept_review"
  | "estimate_ready"
  | "completed"
  | "on_hold";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "concept_review", label: "Concept Review" },
  { value: "estimate_ready", label: "Estimate Ready" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
];

export type RoomType =
  | "living_room"
  | "dining_room"
  | "master_bedroom"
  | "bedroom"
  | "kids_bedroom"
  | "kitchen"
  | "bathroom"
  | "study"
  | "balcony"
  | "entryway"
  | "other";

export const ROOM_TYPES: { value: RoomType; label: string }[] = [
  { value: "living_room", label: "Living Room" },
  { value: "dining_room", label: "Dining Room" },
  { value: "master_bedroom", label: "Master Bedroom" },
  { value: "bedroom", label: "Bedroom" },
  { value: "kids_bedroom", label: "Kids' Bedroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "study", label: "Study / Home Office" },
  { value: "balcony", label: "Balcony" },
  { value: "entryway", label: "Entryway / Foyer" },
  { value: "other", label: "Other" },
];

/** Common starting points for the design-brief style field — not exhaustive; the UI also accepts free-text custom styles. */
export const DESIGN_STYLES = [
  "Warm Minimal",
  "Contemporary",
  "Scandinavian",
  "Industrial",
  "Mid-Century Modern",
  "Traditional Indian",
  "Boho",
  "Japandi",
  "Art Deco",
  "Coastal",
] as const;

/**
 * Extra free-text fields the design brief asks for, varying by room type —
 * keyed into `RoomDesignBrief.roomTypeDetails`. Rooms not listed here (e.g.
 * "other") just get the common fields with no room-specific additions.
 */
export const ROOM_TYPE_BRIEF_FIELDS: Record<string, { key: string; label: string; placeholder?: string }[]> = {
  kids_bedroom: [
    { key: "ageAndGender", label: "Child's age (and any gender preference for the room)" },
    { key: "growthFlexibility", label: "Should the design adapt as the child grows?", placeholder: "e.g. convertible crib-to-bed, adjustable study desk" },
    { key: "studyPlayBalance", label: "Study area vs. play area balance" },
  ],
  bathroom: [
    { key: "fixturesToKeep", label: "Fixtures that must stay (sanitaryware, geyser, etc.)" },
    { key: "waterproofingConcerns", label: "Any known leakage, seepage or waterproofing concerns", placeholder: "Observed issues only — do not guess" },
    { key: "ventilationType", label: "Ventilation type", placeholder: "e.g. exhaust fan, window, none" },
  ],
  kitchen: [
    { key: "layoutPreference", label: "Preferred layout", placeholder: "e.g. L-shape, parallel, island" },
    { key: "applianceList", label: "Appliances to accommodate" },
    { key: "cookingStyle", label: "Cooking style / cuisine", placeholder: "affects ventilation and counter needs" },
  ],
  master_bedroom: [
    { key: "wardrobeCapacity", label: "Wardrobe capacity needs" },
    { key: "seatingOrWorkCorner", label: "Seating or work corner needed?" },
  ],
};

export interface RoomPhoto {
  id: Id;
  roomId: Id;
  /** Public or signed URL the UI can render. In demo mode this may be a local object URL / data URL. */
  url: string;
  /** Storage path within Supabase Storage, absent in demo mode. */
  storagePath?: string;
  caption?: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface RoomDimensions {
  length?: number;
  width?: number;
  ceilingHeight?: number;
  unit: LengthUnit;
}

/**
 * Validated, Claude-produced analysis of a room's uploaded photographs.
 * Advisory only — never treated as verified fact. Fields are split to keep
 * *observed* facts (what's visible in the photo) separate from *inferred*
 * ones (style/opportunities/suggestions) and from explicit *uncertainty*
 * (what a site visit is still needed for) — the UI renders these three
 * categories differently so a designer never mistakes a guess for a fact.
 */
export interface RoomAnalysis {
  observedRoomType: string;
  visibleArchitecturalFeatures: string[];
  visibleDoorsWindowsFixtures: string[];
  existingFurnitureAndStorage: string[];
  approximateVisualStyle: string;
  colorPalette: string[];
  lightingConditions: string;
  visibleMaterialsAndFinishes: string[];
  existingLayoutDescription: string;
  designOpportunities: string[];
  potentialConstraints: string[];
  uncertaintiesRequiringSiteVisit: string[];
  recommendedDesignDirection: string;
  suggestedChanges: string[];
  questionsForClient: string[];
  designBrief: string;
  draftRenovationWorkItems: string[];
  /** Model/provider metadata, for the "AI suggestions — verify on site" audit trail. */
  generatedAt: string;
  model: string;
}

export interface RoomAnalysisRecord {
  id: Id;
  roomId: Id;
  analysis: RoomAnalysis;
  /** Designer's edited copy of the brief/notes, if they adjusted the AI output. */
  designerNotes?: string;
  reviewedByDesigner: boolean;
  createdAt: string;
}

export type ConceptGenerationStatus =
  | "demo"
  | "generated"
  | "failed"
  | "pending";

export interface DesignConcept {
  id: Id;
  roomId: Id;
  title: string;
  style: string;
  description: string;
  keyChanges: string[];
  imageUrl: string;
  /** Private Supabase Storage path for a real provider-generated image. Absent for demo placeholders (inline data URI, nothing to store). */
  storagePath?: string;
  provider: string;
  status: ConceptGenerationStatus;
  isSelected: boolean;
  createdAt: string;
}

/**
 * Room-type-adaptive design brief, built by the designer after reviewing
 * the AI analysis. `roomTypeDetails` holds the fields specific to this
 * room's type (e.g. kids' bedroom vs. bathroom) keyed by field id, since
 * the set of relevant questions genuinely differs by room type rather than
 * being optional variations on one fixed form.
 */
export interface RoomDesignBrief {
  mood?: string;
  mustKeepFeatures?: string;
  itemsToRemain?: string;
  itemsToReplace?: string;
  clientSpecificPreferences?: string;
  freeTextInstructions?: string;
  roomTypeDetails?: Record<string, string>;
}

export interface Room {
  id: Id;
  projectId: Id;
  name: string;
  type: RoomType;
  dimensions: RoomDimensions;
  photos: RoomPhoto[];
  existingConditionNotes?: string;
  preferredStyle?: string;
  preferredColorPalette?: string;
  storageRequirements?: string;
  materialPreferences?: string;
  budget?: number;
  constraints?: string;
  designBrief?: RoomDesignBrief;
  analysis?: RoomAnalysisRecord;
  concepts: DesignConcept[];
  selectedConceptId?: Id;
  estimate?: Estimate;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: Id;
  title: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  location: string;
  status: ProjectStatus;
  budgetRangeMin?: number;
  budgetRangeMax?: number;
  designPreferences?: string;
  notes?: string;
  rooms: Room[];
  createdAt: string;
  updatedAt: string;
}

export type CatalogueCategory =
  | "civil_demolition"
  | "waterproofing"
  | "plumbing"
  | "electrical"
  | "tiling_stone"
  | "sanitaryware"
  | "carpentry_modular"
  | "wardrobes_storage"
  | "painting_finishes"
  | "lighting"
  | "false_ceiling"
  | "hardware"
  | "glass_mirrors"
  | "labour"
  | "design_pm"
  | "miscellaneous";

export const CATALOGUE_CATEGORIES: { value: CatalogueCategory; label: string }[] = [
  { value: "civil_demolition", label: "Civil & Demolition Work" },
  { value: "waterproofing", label: "Waterproofing" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical Work" },
  { value: "tiling_stone", label: "Tiling & Stone" },
  { value: "sanitaryware", label: "Sanitaryware & Bathroom Fittings" },
  { value: "carpentry_modular", label: "Carpentry & Modular Furniture" },
  { value: "wardrobes_storage", label: "Wardrobes & Storage" },
  { value: "painting_finishes", label: "Painting & Wall Finishes" },
  { value: "lighting", label: "Lighting" },
  { value: "false_ceiling", label: "False Ceiling" },
  { value: "hardware", label: "Hardware" },
  { value: "glass_mirrors", label: "Glass & Mirrors" },
  { value: "labour", label: "Labour" },
  { value: "design_pm", label: "Design & Project Management" },
  { value: "miscellaneous", label: "Miscellaneous Costs" },
];

export interface CatalogueItem {
  id: Id;
  name: string;
  category: CatalogueCategory;
  unit: string;
  baseCostPerUnit: number;
  defaultQuantity?: number;
  sellingDescription?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EstimateLineItemInput {
  catalogueItemId: Id;
  name: string;
  unit: string;
  baseCostPerUnit: number;
  quantity: number;
}

export interface EstimateLineItem extends EstimateLineItemInput {
  id: Id;
  lineDirectCost: number;
}

export interface AdditionalCost {
  id: Id;
  label: string;
  amount: number;
}

export interface EstimateCalculationInput {
  lineItems: EstimateLineItemInput[];
  additionalCosts: AdditionalCost[];
  contingencyPercent: number;
  targetGrossMarginPercent: number;
  gstPercent: number;
}

export interface EstimateCalculationResult {
  lineItems: EstimateLineItem[];
  additionalCosts: AdditionalCost[];
  directCost: number;
  contingencyPercent: number;
  contingencyAmount: number;
  costBasis: number;
  targetGrossMarginPercent: number;
  targetSellingSubtotal: number;
  grossProfit: number;
  actualGrossMarginPercent: number;
  gstPercent: number;
  gstAmount: number;
  totalClientEstimate: number;
}

export interface Estimate {
  id: Id;
  roomId: Id;
  projectId: Id;
  conceptId?: Id;
  calculation: EstimateCalculationResult;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  targetGrossMarginPercent: number;
  defaultContingencyPercent: number;
  gstPercent: number;
  currency: "INR";
  imageGenerationProvider: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  targetGrossMarginPercent: 40,
  defaultContingencyPercent: 8,
  gstPercent: 18,
  currency: "INR",
  imageGenerationProvider: "demo",
};

/** Allowlisted, client-safe view of a room — never exposes cost, margin or internal notes. */
export interface ClientPresentationRoom {
  roomId: Id;
  roomName: string;
  roomType: RoomType;
  dimensions: RoomDimensions;
  primaryPhotoUrl?: string;
  photos: { id: Id; url: string; caption?: string }[];
  concepts: {
    id: Id;
    title: string;
    style: string;
    description: string;
    keyChanges: string[];
    imageUrl: string;
    status: ConceptGenerationStatus;
    isSelected: boolean;
  }[];
  selectedConceptId?: Id;
  estimateSummary?: {
    lineItems: { id: Id; name: string; unit: string; quantity: number }[];
    contingencyLabel: string;
    subtotalBeforeGst: number;
    gstPercent: number;
    gstAmount: number;
    totalClientEstimate: number;
  };
}

export interface ClientPresentationProject {
  projectId: Id;
  projectTitle: string;
  clientName: string;
  location: string;
  rooms: ClientPresentationRoom[];
}

// ─────────────────────── Phase 3: client presentation links ───────────────────────
// Entities behind the token-gated /present/[token] flow. Distinct from
// ClientPresentation{Room,Project} above, which back the designer's own
// internal (session-authenticated) /presentation preview — these back a
// link actually handed to the client, with no Supabase session involved.

/**
 * A designer-issued, token-gated link to one project. The raw token is
 * shown to the designer exactly once (at creation) and never persisted —
 * only `tokenHash` (SHA-256 of the token) is stored, so a database leak
 * alone can't be used to impersonate a live link.
 */
export interface PresentationLink {
  id: Id;
  projectId: Id;
  tokenHash: string;
  createdByUserId: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  lastAccessedAt?: string;
  /** Room ids visible to the client. Empty/undefined means "all rooms in the project". */
  visibleRoomIds?: Id[];
  /** Concept ids explicitly hidden from the client, even if their room is visible. */
  hiddenConceptIds?: Id[];
  showLocation: boolean;
}

export type ClientDecisionType = "concept_selected" | "concept_approved" | "estimate_accepted";

export interface ClientDecision {
  id: Id;
  presentationLinkId: Id;
  projectId: Id;
  roomId?: Id;
  conceptId?: Id;
  estimateVersionId?: Id;
  decisionType: ClientDecisionType;
  createdAt: string;
}

export interface ClientFeedback {
  id: Id;
  presentationLinkId: Id;
  projectId: Id;
  roomId?: Id;
  conceptId?: Id;
  feedbackType: "comment" | "change_request";
  message: string;
  createdAt: string;
}

export type EstimateVersionStatus = "published" | "superseded";
export type EstimateDisplayStatus = "preliminary" | "final";

/**
 * A frozen, designer-published snapshot of an estimate. The live, editable
 * `Estimate`/`EstimateCalculationResult` (lib/types.ts above) is the
 * designer's working draft; publishing copies its client-safe shape here.
 * The client-facing page only ever reads from this table — never the live
 * estimate — so editing a draft can never silently change what a client
 * already saw or accepted.
 */
export interface EstimateVersion {
  id: Id;
  roomId: Id;
  projectId: Id;
  versionNumber: number;
  status: EstimateVersionStatus;
  displayStatus: EstimateDisplayStatus;
  title: string;
  lineItems: { name: string; unit: string; quantity: number }[];
  subtotalBeforeGst: number;
  gstPercent: number;
  gstAmount: number;
  totalClientEstimate: number;
  inclusions?: string;
  exclusions?: string;
  assumptions?: string;
  validityDays: number;
  publishedAt: string;
  publishedByUserId: string;
}

export interface PresentationAuditEvent {
  id: Id;
  presentationLinkId: Id;
  projectId: Id;
  eventType: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** A saved bill of quantities, always under a project. `payload` is the BOQ workbench state (lines, coverage, plan rooms). */
export interface BoqRecord {
  id: Id;
  projectId: Id;
  leadId?: Id;
  title: string;
  tier: string;
  city: string;
  sheet: string;
  total: number;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
