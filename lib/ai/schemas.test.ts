import { describe, expect, it } from "vitest";
import { roomAnalysisContentSchema } from "./schemas";

const validBase = {
  observedRoomType: "Bedroom",
  approximateVisualStyle: "Contemporary",
  lightingConditions: "Bright, north-facing window",
  existingLayoutDescription: "Bed against the far wall, wardrobe to the left.",
  recommendedDesignDirection: "Lean into warm minimal with concealed storage.",
  designBrief: "Warm minimal bedroom refresh with better storage.",
};

describe("roomAnalysisContentSchema", () => {
  it("accepts a fully populated, valid payload", () => {
    const parsed = roomAnalysisContentSchema.parse({
      ...validBase,
      visibleArchitecturalFeatures: ["Exposed beam"],
      visibleDoorsWindowsFixtures: ["One sliding window"],
      existingFurnitureAndStorage: ["Queen bed", "Two-door wardrobe"],
      colorPalette: ["Off-white", "Walnut brown"],
      visibleMaterialsAndFinishes: ["Laminate flooring"],
      designOpportunities: ["Add a reading nook"],
      potentialConstraints: ["Window is off-center, visible in photo"],
      uncertaintiesRequiringSiteVisit: ["Exact wall-to-wall width"],
      suggestedChanges: ["Swap wardrobe for a sliding-door unit"],
      questionsForClient: ["Any preference for wardrobe finish?"],
      draftRenovationWorkItems: ["Repaint walls", "Replace wardrobe"],
    });
    expect(parsed.observedRoomType).toBe("Bedroom");
    expect(parsed.visibleArchitecturalFeatures).toEqual(["Exposed beam"]);
  });

  it("defaults every array field to [] when omitted", () => {
    const parsed = roomAnalysisContentSchema.parse(validBase);
    expect(parsed.visibleArchitecturalFeatures).toEqual([]);
    expect(parsed.visibleDoorsWindowsFixtures).toEqual([]);
    expect(parsed.existingFurnitureAndStorage).toEqual([]);
    expect(parsed.colorPalette).toEqual([]);
    expect(parsed.visibleMaterialsAndFinishes).toEqual([]);
    expect(parsed.designOpportunities).toEqual([]);
    expect(parsed.potentialConstraints).toEqual([]);
    expect(parsed.uncertaintiesRequiringSiteVisit).toEqual([]);
    expect(parsed.suggestedChanges).toEqual([]);
    expect(parsed.questionsForClient).toEqual([]);
    expect(parsed.draftRenovationWorkItems).toEqual([]);
  });

  it("rejects a payload missing a required narrative field", () => {
    const { designBrief, ...withoutDesignBrief } = validBase;
    void designBrief;
    expect(() => roomAnalysisContentSchema.parse(withoutDesignBrief)).toThrow();
  });

  it("rejects a required string field that's present but empty", () => {
    expect(() =>
      roomAnalysisContentSchema.parse({ ...validBase, observedRoomType: "" })
    ).toThrow();
  });

  it("rejects a non-string entry inside an array field", () => {
    expect(() =>
      roomAnalysisContentSchema.parse({
        ...validBase,
        visibleArchitecturalFeatures: ["fine", 42],
      })
    ).toThrow();
  });
});
