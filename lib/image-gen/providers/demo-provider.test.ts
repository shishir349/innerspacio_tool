import { describe, expect, it } from "vitest";
import { DemoImageGenerationProvider } from "./demo-provider";
import type { ConceptGenerationRequest } from "@/lib/image-gen/types";

// No network calls in this provider — nothing to mock, but still worth
// covering explicitly since the route relies on it as the zero-cost default
// when no real image-generation provider is configured.

const baseRequest: ConceptGenerationRequest = {
  referencePhotoUrl: "https://example.com/photo.jpg",
  roomName: "Master Bedroom",
  roomType: "Master Bedroom",
  style: "Warm Minimal",
  brief: "Pastel blues, lots of concealed storage",
  variantCount: 1,
};

describe("DemoImageGenerationProvider", () => {
  const provider = new DemoImageGenerationProvider();

  it("is flagged as a demo, non-real provider", () => {
    expect(provider.isDemo).toBe(true);
    expect(provider.name).toBe("demo");
  });

  it("returns exactly `variantCount` results", async () => {
    const results = await provider.generateConcepts({ ...baseRequest, variantCount: 3 });
    expect(results).toHaveLength(3);
  });

  it("clamps variantCount of 0 or negative up to 1 result", async () => {
    const results = await provider.generateConcepts({ ...baseRequest, variantCount: 0 });
    expect(results).toHaveLength(1);
  });

  it("every result is labeled as a demo placeholder, never claimed as real", async () => {
    const results = await provider.generateConcepts(baseRequest);
    for (const result of results) {
      expect(result.status).toBe("demo");
      expect(result.provider).toBe("demo");
      expect(result.imageUrl).toMatch(/^data:image\/svg\+xml;base64,/);
      const decoded = Buffer.from(result.imageUrl.split(",")[1], "base64").toString("utf-8");
      expect(decoded).toContain("DEMO CONCEPT");
    }
  });

  it("incorporates the requested palette into the description when provided", async () => {
    const results = await provider.generateConcepts({ ...baseRequest, palette: "Sage green and ivory" });
    expect(results[0].description).toContain("Sage green and ivory");
  });

  it("gives each variant a distinct title when more than one is requested", async () => {
    const results = await provider.generateConcepts({ ...baseRequest, variantCount: 2 });
    expect(results[0].title).not.toBe(results[1].title);
  });
});
