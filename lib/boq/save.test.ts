import { describe, expect, it } from "vitest";
import { saveRequestSchema } from "@/lib/boq/schema";

const line = { room: "Living", trade: "Paint & Polish", item: "Paint", description: "d", uom: "Sq.Ft.", qty: 10, rate: 50 };

describe("saveRequestSchema", () => {
  it("needs a project and at least one line", () => {
    expect(saveRequestSchema.safeParse({ title: "t", tier: "premium", city: "Delhi", lines: [line] }).success).toBe(false);
    expect(saveRequestSchema.safeParse({ projectId: "p1", title: "t", tier: "premium", city: "Delhi", lines: [] }).success).toBe(false);
  });

  it("accepts a normal save (new and update) and rejects a bad tier or lead id", () => {
    const ok = { projectId: "p1", title: "Living BOQ", tier: "premium", city: "Delhi", lines: [line] };
    expect(saveRequestSchema.safeParse(ok).success).toBe(true);
    expect(saveRequestSchema.safeParse({ ...ok, boqId: "b1" }).success).toBe(true);
    expect(saveRequestSchema.safeParse({ ...ok, tier: "gold" }).success).toBe(false);
    expect(saveRequestSchema.safeParse({ ...ok, leadId: "not-a-uuid" }).success).toBe(false);
  });
});
