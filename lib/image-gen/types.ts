import type { ConceptGenerationStatus } from "@/lib/types";

/** Hard ceiling on variants per request, independent of what a given provider's API allows — keeps cost/latency predictable regardless of provider. */
export const MAX_VARIANTS_PER_REQUEST = 4;

export interface ConceptGenerationRequest {
  /** URL of the client's actual uploaded room photograph — the required reference image. */
  referencePhotoUrl: string;
  /** Extra photos of the same room (designer flow). Sent after the reference, in order. */
  additionalImageUrls?: string[];
  /** The home's floor plan / blueprint (designer flow). Always sent last. */
  floorPlanUrl?: string;
  roomName: string;
  roomType: string;
  style: string;
  /** Free-text styling brief: furniture direction, finishes, mood. */
  brief: string;
  /** Optional colour palette, kept separate from the free-text brief so providers can weight it explicitly in the prompt. */
  palette?: string;
  /** How many variants to generate in this request. Clamped to [1, MAX_VARIANTS_PER_REQUEST] by the caller. */
  variantCount: number;
}

/** Normalized result shape every provider must return, regardless of backing API. */
export interface GeneratedConceptResult {
  /** Data URL (demo placeholders) or a temporary URL the caller must persist before it expires (real providers' raw bytes are passed back as a data URL too, for a uniform upload step). */
  imageUrl: string;
  title: string;
  style: string;
  description: string;
  keyChanges: string[];
  provider: string;
  status: ConceptGenerationStatus;
}

export interface ImageGenerationProvider {
  readonly name: string;
  readonly isDemo: boolean;
  /** Generates between 1 and request.variantCount concepts. A provider that can only produce one at a time should loop internally — callers always get an array. */
  generateConcepts(request: ConceptGenerationRequest): Promise<GeneratedConceptResult[]>;
}
