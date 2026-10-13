import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseRepository } from "./supabase-store";
import { RepositoryError } from "./types";
import type { EstimateCalculationResult } from "@/lib/types";

/**
 * A minimal stand-in for the subset of the Supabase query-builder chain
 * these tests actually exercise: `.from(table).select(...).eq(...).eq(...).maybeSingle()`.
 * Keyed by table name so different tables can return different rows.
 */
function makeFakeClient(
  responses: Record<string, { data: unknown; error: unknown }>
): SupabaseClient {
  function chainFor(table: string) {
    const terminal = responses[table] ?? { data: null, error: null };
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => terminal,
    };
    return chain;
  }
  return { from: (table: string) => chainFor(table) } as unknown as SupabaseClient;
}

const minimalCalculation: EstimateCalculationResult = {
  lineItems: [],
  additionalCosts: [],
  directCost: 0,
  contingencyPercent: 0,
  contingencyAmount: 0,
  costBasis: 0,
  targetGrossMarginPercent: 40,
  targetSellingSubtotal: 0,
  grossProfit: 0,
  actualGrossMarginPercent: 0,
  gstPercent: 18,
  gstAmount: 0,
  totalClientEstimate: 0,
};

describe("SupabaseRepository — ownership verification", () => {
  it("refuses to save an estimate for a roomId that doesn't belong to the given projectId", async () => {
    // `rooms` lookup finds no row matching (roomId, projectId) together —
    // simulating an authenticated caller who swapped in a room from a
    // different project while reusing a projectId they do have access to.
    const client = makeFakeClient({ rooms: { data: null, error: null } });
    const repo = new SupabaseRepository(client);

    await expect(
      repo.saveEstimate("project-the-caller-has", "room-from-a-different-project", {
        calculation: minimalCalculation,
      })
    ).rejects.toThrow(RepositoryError);
  });

  it("refuses to add a room photo for a roomId outside the given projectId", async () => {
    const client = makeFakeClient({ rooms: { data: null, error: null } });
    const repo = new SupabaseRepository(client);

    await expect(
      repo.addRoomPhoto("project-the-caller-has", "room-from-a-different-project", {
        url: "https://example.com/x.jpg",
        isPrimary: false,
      })
    ).rejects.toThrow(RepositoryError);
  });

  it("refuses to select a concept that doesn't belong to the given room", async () => {
    // The room *does* belong to the project, but the concept belongs to a
    // different room — e.g. a caller guessing/reusing a conceptId they saw
    // elsewhere in the app.
    const client = makeFakeClient({
      rooms: { data: { id: "room-1" }, error: null },
      design_concepts: { data: null, error: null },
    });
    const repo = new SupabaseRepository(client);

    await expect(
      repo.selectConcept("project-1", "room-1", "concept-from-a-different-room")
    ).rejects.toThrow(RepositoryError);
  });

  it("refuses to remove a photo that doesn't belong to the given room", async () => {
    const client = makeFakeClient({
      rooms: { data: { id: "room-1" }, error: null },
      room_photos: { data: null, error: null },
    });
    const repo = new SupabaseRepository(client);

    await expect(
      repo.removeRoomPhoto("project-1", "room-1", "photo-from-a-different-room")
    ).rejects.toThrow(RepositoryError);
  });

  it("refuses to delete a concept for a roomId outside the given projectId", async () => {
    // assertRoomInProject's own rooms lookup fails first — deleteConcept
    // must never reach the design_concepts table at all in this case.
    const client = makeFakeClient({ rooms: { data: null, error: null } });
    const repo = new SupabaseRepository(client);

    await expect(
      repo.deleteConcept("project-the-caller-has", "room-from-a-different-project", "concept-1")
    ).rejects.toThrow(RepositoryError);
  });

  it("refuses to delete a concept that doesn't belong to the given room", async () => {
    // The room belongs to the project, but no design_concepts row matches
    // (conceptId, roomId) together — e.g. a conceptId from another room.
    const client = makeFakeClient({
      rooms: { data: { id: "room-1" }, error: null },
      design_concepts: { data: null, error: null },
    });
    const repo = new SupabaseRepository(client);

    await expect(
      repo.deleteConcept("project-1", "room-1", "concept-from-a-different-room")
    ).rejects.toThrow(RepositoryError);
  });
});
