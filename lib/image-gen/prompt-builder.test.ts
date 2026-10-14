import { describe, expect, it } from "vitest";
import { buildConceptEditInstruction } from "@/lib/image-gen/prompt-builder";

const base = {
  roomType: "bedroom" as const,
  style: "Modern",
  userBrief: "Soft greens, lots of storage",
};

describe("buildConceptEditInstruction", () => {
  it("public (client) prompt carries no admin-only sections", () => {
    const p = buildConceptEditInstruction(base);
    expect(p).toContain("Soft greens, lots of storage");
    expect(p).not.toMatch(/floor plan/i);
    expect(p).not.toMatch(/additional photo/i);
    expect(p).not.toMatch(/Client's description/);
    expect(p).not.toMatch(/dimensions/i);
  });

  it("adds the client's own description, tagged as such", () => {
    const p = buildConceptEditInstruction({ ...base, clientDescription: "Wants a reading nook by the window" });
    expect(p).toContain("Client's description of the space: Wants a reading nook by the window");
  });

  it("explains extra photos and the floor plan without asking to draw it", () => {
    const p = buildConceptEditInstruction({ ...base, extraPhotoCount: 2, hasFloorPlan: true });
    expect(p).toMatch(/2 additional photos/);
    expect(p).toMatch(/floor plan/i);
    expect(p).toMatch(/never reproduce/i);
  });

  it("states room dimensions when given", () => {
    const p = buildConceptEditInstruction({ ...base, dimensions: "12 ft × 14 ft, ceiling 10 ft" });
    expect(p).toContain("Room dimensions: 12 ft × 14 ft, ceiling 10 ft.");
  });

  it("designer's description is kept verbatim", () => {
    const p = buildConceptEditInstruction({ ...base, userBrief: "Walnut wardrobe, brass handles" });
    expect(p).toContain("Walnut wardrobe, brass handles");
  });
});
