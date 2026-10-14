import "server-only";
import type { RoomAnalysis, RoomDesignBrief, RoomType } from "@/lib/types";

export interface ConceptPromptInput {
  roomType: RoomType;
  style: string;
  palette?: string;
  userBrief: string;
  analysis?: RoomAnalysis;
  designBrief?: RoomDesignBrief;
  /** Designer-flow only. What the client said about the space (notes, preferences). */
  clientDescription?: string;
  /** Designer-flow only. e.g. "12 ft × 14 ft, ceiling 10 ft". */
  dimensions?: string;
  /** Designer-flow only. Extra photos of the same room beyond the main one. */
  extraPhotoCount?: number;
  /** Designer-flow only. The last reference image is the home's floor plan. */
  hasFloorPlan?: boolean;
}

/**
 * Builds one detailed image-editing instruction from every approved source
 * of truth the designer has at this point — the Claude analysis (if any),
 * the structured design brief (if any), the chosen style/palette, and the
 * designer's own free-text note — plus explicit architectural-preservation
 * constraints and a realistic-photography aesthetic request. This is the
 * ONLY place that assembles the prompt; providers just receive the result
 * as `request.brief` and use it close to verbatim, so every provider gets
 * an equally well-informed instruction regardless of which one is active.
 */
export function buildConceptEditInstruction(input: ConceptPromptInput): string {
  const parts: string[] = [];

  parts.push(`${input.style} interior redesign of a ${input.roomType.replace(/_/g, " ")}.`);

  if (input.palette) {
    parts.push(`Colour palette focus: ${input.palette}.`);
  }

  if (input.dimensions) parts.push(`Room dimensions: ${input.dimensions}.`);

  if (input.extraPhotoCount && input.extraPhotoCount > 0) {
    const n = input.extraPhotoCount;
    parts.push(
      `${n} additional photo${n === 1 ? "" : "s"} show the same room from other angles — use ${n === 1 ? "it" : "them"} to understand the whole room, not as separate scenes.`
    );
  }

  if (input.hasFloorPlan) {
    parts.push(
      "The last reference image is the floor plan of the home. Use it only to understand where this room sits, its proportions, openings and circulation; never reproduce it as a drawing, overlay or diagram in the output."
    );
  }

  if (input.clientDescription) {
    parts.push(`Client's description of the space: ${input.clientDescription}`);
  }

  if (input.analysis) {
    const a = input.analysis;
    if (a.existingLayoutDescription) parts.push(`Current layout: ${a.existingLayoutDescription}`);
    if (a.visibleArchitecturalFeatures.length) {
      parts.push(`Architectural features to work with: ${a.visibleArchitecturalFeatures.join(", ")}.`);
    }
    if (a.visibleDoorsWindowsFixtures.length) {
      parts.push(`Fixed doors/windows/fixtures to keep in their current positions: ${a.visibleDoorsWindowsFixtures.join(", ")}.`);
    }
    if (a.recommendedDesignDirection) parts.push(`Design direction: ${a.recommendedDesignDirection}`);
  }

  if (input.designBrief) {
    const b = input.designBrief;
    if (b.mood) parts.push(`Overall mood: ${b.mood}.`);
    if (b.mustKeepFeatures) parts.push(`Must keep: ${b.mustKeepFeatures}.`);
    if (b.itemsToRemain) parts.push(`These existing items must remain in the redesign: ${b.itemsToRemain}.`);
    if (b.itemsToReplace) parts.push(`Replace or remove: ${b.itemsToReplace}.`);
    if (b.clientSpecificPreferences) parts.push(`Client preferences: ${b.clientSpecificPreferences}.`);
    if (b.roomTypeDetails) {
      const details = Object.entries(b.roomTypeDetails)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `${k}: ${v}`);
      if (details.length) parts.push(`Room-specific requirements — ${details.join("; ")}.`);
    }
    if (b.freeTextInstructions) parts.push(b.freeTextInstructions);
  }

  if (input.userBrief) {
    parts.push(input.userBrief);
  }

  parts.push(
    "Preserve the room's architectural structure exactly: wall positions, window and door locations and proportions, ceiling height and overall room geometry. Transform only finishes, furniture, storage, lighting fixtures and colour palette."
  );
  parts.push(
    "Render as a realistic interior-photography image — natural lighting, true-to-life materials, a real photograph's depth of field and perspective, not an illustration or render-engine look."
  );
  parts.push(
    "Do not render any text, labels, signage, watermarks or room names anywhere in the image — not on walls, floors, rugs, furniture or decor."
  );

  return parts.join(" ");
}
