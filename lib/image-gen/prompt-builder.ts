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
  /** Short list of the photo's fixed elements (doors, windows, ceiling…) from lib/ai/structure.ts. Optional; the generic lock always applies. */
  structureNotes?: string;
}

/**
 * Fixed elements the model must not touch. Stated first and in concrete terms:
 * image-edit models drift toward "a nicer room" (taller ceiling, a door turned
 * into a wardrobe) unless the unchangeable parts are named explicitly.
 */
const STRUCTURE_LOCK = [
  "Edit the supplied room photograph. Do not invent a new room: the result must be the SAME room, from the SAME camera position, with the same lens, angle, framing and perspective, only fitted out and styled.",
  "Keep the room's shell exactly as photographed: wall positions and corners, ceiling height, room width and depth, floor area and every vanishing line. The room must not look taller, shorter, wider, narrower, longer or shallower than the photo.",
  "Every door, window, archway, opening, passage, niche, column, beam, staircase, balcony door, AC unit, vent and electrical point stays in the same place with the same size, shape and type. A door stays a door and a window stays a window, in the open or closed state shown. Never turn a door, window or opening into a wardrobe, cupboard, wall panel, mirror or plain wall, and never hide, shrink, move or block one; keep furniture and joinery clear of them.",
  "Keep the direction and amount of natural light coming through the existing windows.",
].join(" ");

const CHANGE_SCOPE =
  "Change only what an interior fit-out changes: wall paint and wall finishes, panelling, wallpaper, flooring finish, furniture, built-in joinery placed against solid walls, curtains, rugs, decor and light fittings. A false ceiling may add a shallow cove, border or recessed lights but must not visibly lower the ceiling. If the room is empty, bare or unfinished, furnish and finish it completely inside the same shell.";

/**
 * House look distilled from InnerSpacio's delivered projects (Img_Samples):
 * warm ivory/cream base, champagne-brass accents, cove-lit ceilings, fluted and
 * moulded wall panels, glossy light stone floors, layered curtains.
 */
const HOUSE_LOOK =
  "Finish it in InnerSpacio's signature look: a warm ivory, cream and soft-beige base with natural walnut or oak wood and champagne-brass accents, one considered feature wall, warm 2700-3000K cove and recessed lighting, clean tailored joinery with slim handles, soft sheer-plus-drape curtains, a layered rug, and a few styled decor pieces and plants. Elegant and lived-in, never cluttered, no neon or saturated colours.";

const ROOM_LOOK: Partial<Record<RoomType, string>> = {
  living_room:
    "Living room: a TV or feature wall with fluted wood or picture-frame moulding panels and softly backlit niches, a plush sofa set (tufted or curved bouclé) around a round or oval marble-top centre table, a statement chandelier or pendant, and a patterned rug.",
  bedroom:
    "Bedroom: a headboard wall in padded or fluted panelling or a wallpaper accent, an upholstered bed with bedside tables and wall sconces or pendants, a floor-to-ceiling laminate wardrobe with slim handles placed only on a plain solid wall, and a rug under the bed.",
  kitchen:
    "Kitchen: keep the existing layout shape and the sink, window and appliance positions; fit modular two-tone shutters in cream or beige with one accent, backlit glass-fronted wall cabinets with a brass frame, a stone-look backsplash, a quartz or dark stone countertop and under-cabinet LED strips.",
  bathroom:
    "Bathroom: keep the fixtures on their current walls; large-format stone-look wall and floor tiles, a wall-hung WC, a vanity with a stone top and a backlit mirror, matte black or brushed-gold fittings and a clear glass shower partition.",
  dining_room:
    "Dining area: a statement dining table with upholstered chairs, a pendant cluster above it, a backlit crockery or bar unit with glass shutters on a solid wall, and a mirror or panelled accent wall.",
  other:
    "Fit it out for its apparent purpose (study, balcony, utility or pooja): a wall-mounted desk or storage wall with open niches and closed cabinets, task lighting, and the same warm palette.",
};

/**
 * Builds one detailed image-editing instruction. Order matters: structure lock
 * and change scope first (what must not move), then house look, then everything
 * the designer or client supplied, then a short closing reminder. This is the
 * ONLY place that assembles the prompt; providers use it verbatim.
 */
export function buildConceptEditInstruction(input: ConceptPromptInput): string {
  const parts: string[] = [];
  const room = input.roomType.replace(/_/g, " ");

  parts.push(STRUCTURE_LOCK);
  if (input.structureNotes) parts.push(`Fixed elements seen in this photo, to keep exactly as they are: ${input.structureNotes}`);
  parts.push(CHANGE_SCOPE);

  parts.push(`Design brief: a ${input.style} interior for this ${room}.`);
  parts.push(HOUSE_LOOK);
  const look = ROOM_LOOK[input.roomType];
  if (look) parts.push(look);

  if (input.palette) parts.push(`Colour palette focus: ${input.palette}.`);
  if (input.dimensions) parts.push(`Room dimensions: ${input.dimensions}.`);

  if (input.extraPhotoCount && input.extraPhotoCount > 0) {
    const n = input.extraPhotoCount;
    parts.push(
      `${n} additional photo${n === 1 ? "" : "s"} show the same room from other angles — use ${n === 1 ? "it" : "them"} to understand the whole room, not as separate scenes. The first image is the view to edit.`
    );
  }

  if (input.hasFloorPlan) {
    parts.push(
      "The last reference image is the floor plan of the home. Use it only to understand where this room sits, its proportions, openings and circulation; never reproduce it as a drawing, overlay or diagram in the output."
    );
  }

  if (input.clientDescription) parts.push(`Client's description of the space: ${input.clientDescription}`);

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
    parts.push(`Customer's wishes (apply them wherever they do not break the structure rules above): ${input.userBrief}`);
  }

  parts.push(
    "Output a photorealistic interior-design portfolio image: natural light, true-to-life materials, correct scale and perspective, sharp and clean, like a premium delivered project. Do not render any text, labels, signage, watermarks or room names anywhere in the image."
  );
  parts.push("Final check: same camera, same room shape and ceiling height, every door, window and opening still where it was.");

  return parts.join(" ");
}
