import { z } from "zod";

/**
 * Shape Claude must return for a room-photo analysis. Kept separate from the
 * `RoomAnalysis` domain type (which adds `generatedAt`/`model` after
 * validation) so the AI boundary is validated independently of storage.
 *
 * Field groups are deliberate, not arbitrary — they mirror the distinction
 * the UI draws between what's *observed* in the photo, what's *inferred*
 * from it, and what's explicitly *uncertain* without a site visit:
 * - Observed: visibleArchitecturalFeatures, visibleDoorsWindowsFixtures,
 *   existingFurnitureAndStorage, colorPalette, visibleMaterialsAndFinishes,
 *   lightingConditions, existingLayoutDescription.
 * - Inferred: approximateVisualStyle, designOpportunities,
 *   recommendedDesignDirection, suggestedChanges.
 * - Uncertainty: potentialConstraints, uncertaintiesRequiringSiteVisit,
 *   questionsForClient.
 */
export const roomAnalysisContentSchema = z.object({
  observedRoomType: z.string().min(1),
  visibleArchitecturalFeatures: z.array(z.string()).default([]),
  visibleDoorsWindowsFixtures: z.array(z.string()).default([]),
  existingFurnitureAndStorage: z.array(z.string()).default([]),
  approximateVisualStyle: z.string().min(1),
  colorPalette: z.array(z.string()).default([]),
  lightingConditions: z.string().min(1),
  visibleMaterialsAndFinishes: z.array(z.string()).default([]),
  existingLayoutDescription: z.string().min(1),
  designOpportunities: z.array(z.string()).default([]),
  potentialConstraints: z.array(z.string()).default([]),
  uncertaintiesRequiringSiteVisit: z.array(z.string()).default([]),
  recommendedDesignDirection: z.string().min(1),
  suggestedChanges: z.array(z.string()).default([]),
  questionsForClient: z.array(z.string()).default([]),
  designBrief: z.string().min(1),
  draftRenovationWorkItems: z.array(z.string()).default([]),
});

export type RoomAnalysisContent = z.infer<typeof roomAnalysisContentSchema>;
