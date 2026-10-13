import "server-only";
import type { RoomAnalysis, RoomDesignBrief, RoomType } from "@/lib/types";

export interface ConceptPromptInput {
  roomType: RoomType;
  style: string;
  palette?: string;
  userBrief: string;
  analysis?: RoomAnalysis;
  designBrief?: RoomDesignBrief;
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
