import { describe, expect, it } from "vitest";
import { autoQty } from "@/lib/boq/measure";

describe("autoQty", () => {
  it("sq ft = L×B for floor/ceiling, L×H for elevations", () => {
    expect(autoQty("Sq.Ft.", 10, 12, null)).toBe(120);
    expect(autoQty("Sq.Ft.", 8, null, 7)).toBe(56);
  });
  it("rft is the length; cu ft needs all three", () => {
    expect(autoQty("Rft", 14, null, null)).toBe(14);
    expect(autoQty("Cu.Ft.", 2, 3, 4)).toBe(24);
  });
  it("returns null when it cannot be derived (counts keep their typed qty)", () => {
    expect(autoQty("Nos", 2, 3, 4)).toBeNull();
    expect(autoQty("Sq.Ft.", null, null, null)).toBeNull();
  });
});
