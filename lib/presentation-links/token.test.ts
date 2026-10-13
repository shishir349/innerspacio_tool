import { describe, expect, it, vi, beforeEach } from "vitest";
import { hashToken } from "./crypto";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  resolvePresentationLink,
  recordClientDecision,
  recordClientFeedback,
  getClientPresentationData,
} from "./token";
import type { PresentationLink } from "@/lib/types";

type TableResponses = Record<string, { data: unknown; error: unknown }>;

function makeFakeAdminClient(tableResponses: TableResponses, inserts: Record<string, unknown>[] = []) {
  function chainFor(table: string) {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => tableResponses[table] ?? { data: null, error: null },
      insert: async (payload: Record<string, unknown>) => {
        inserts.push({ table, payload });
        return { error: null };
      },
      update: () => chain,
    };
    return chain;
  }
  return { from: (table: string) => chainFor(table) };
}

function setAdminClient(tableResponses: TableResponses, inserts: Record<string, unknown>[] = []) {
  (createSupabaseAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    makeFakeAdminClient(tableResponses, inserts)
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

const NOW = Date.now();
const future = (days: number) => new Date(NOW + days * 86_400_000).toISOString();
const past = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

describe("resolvePresentationLink", () => {
  const token = "a-token-value-that-is-long-enough-to-pass-the-length-check";
  const tokenHash = hashToken(token);

  it("resolves a valid, unexpired, unrevoked link", async () => {
    setAdminClient({
      presentation_links: {
        data: {
          id: "link-1",
          project_id: "project-1",
          token_hash: tokenHash,
          created_by: "user-1",
          created_at: past(1),
          expires_at: future(10),
          revoked_at: null,
          last_accessed_at: null,
          visible_room_ids: null,
          hidden_concept_ids: [],
          show_location: true,
        },
        error: null,
      },
    });

    const result = await resolvePresentationLink(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.link.id).toBe("link-1");
      expect(result.link.projectId).toBe("project-1");
    }
  });

  it("rejects an unknown token as not_found", async () => {
    setAdminClient({ presentation_links: { data: null, error: null } });
    const result = await resolvePresentationLink(token);
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects a revoked link", async () => {
    setAdminClient({
      presentation_links: {
        data: {
          id: "link-1",
          project_id: "project-1",
          token_hash: tokenHash,
          created_by: "user-1",
          created_at: past(5),
          expires_at: future(10),
          revoked_at: past(1),
          hidden_concept_ids: [],
          show_location: true,
        },
        error: null,
      },
    });
    const result = await resolvePresentationLink(token);
    expect(result).toEqual({ ok: false, reason: "revoked" });
  });

  it("rejects an expired link", async () => {
    setAdminClient({
      presentation_links: {
        data: {
          id: "link-1",
          project_id: "project-1",
          token_hash: tokenHash,
          created_by: "user-1",
          created_at: past(40),
          expires_at: past(5),
          revoked_at: null,
          hidden_concept_ids: [],
          show_location: true,
        },
        error: null,
      },
    });
    const result = await resolvePresentationLink(token);
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a token that's too short without querying the database", async () => {
    const result = await resolvePresentationLink("short");
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a missing token", async () => {
    expect(await resolvePresentationLink(undefined)).toEqual({ ok: false, reason: "not_found" });
    expect(await resolvePresentationLink(null)).toEqual({ ok: false, reason: "not_found" });
    expect(await resolvePresentationLink("")).toEqual({ ok: false, reason: "not_found" });
  });
});

function baseLink(overrides: Partial<PresentationLink> = {}): PresentationLink {
  return {
    id: "link-1",
    projectId: "project-1",
    tokenHash: "irrelevant",
    createdByUserId: "user-1",
    createdAt: past(1),
    expiresAt: future(10),
    hiddenConceptIds: [],
    showLocation: true,
    ...overrides,
  };
}

describe("recordClientDecision — token-to-project isolation", () => {
  it("rejects a roomId that doesn't belong to the link's project", async () => {
    setAdminClient({ rooms: { data: null, error: null } });

    await expect(
      recordClientDecision(baseLink(), {
        decisionType: "concept_selected",
        roomId: "room-from-another-project",
        conceptId: "concept-1",
      })
    ).rejects.toThrow(/not part of this presentation/);
  });

  it("rejects a conceptId that doesn't belong to the given room", async () => {
    setAdminClient({
      rooms: { data: { id: "room-1" }, error: null },
      design_concepts: { data: null, error: null },
    });

    await expect(
      recordClientDecision(baseLink(), {
        decisionType: "concept_selected",
        roomId: "room-1",
        conceptId: "concept-from-another-room",
      })
    ).rejects.toThrow(/not part of this room/);
  });

  it("rejects accepting an estimate version that isn't the currently published one for that room", async () => {
    setAdminClient({
      rooms: { data: { id: "room-1" }, error: null },
      estimate_versions: { data: null, error: null },
    });

    await expect(
      recordClientDecision(baseLink(), {
        decisionType: "estimate_accepted",
        roomId: "room-1",
        estimateVersionId: "stale-or-foreign-version",
      })
    ).rejects.toThrow(/currently published/);
  });

  it("records a valid, fully-scoped decision", async () => {
    const inserts: Record<string, unknown>[] = [];
    setAdminClient(
      {
        rooms: { data: { id: "room-1" }, error: null },
        design_concepts: { data: { id: "concept-1" }, error: null },
      },
      inserts
    );

    await recordClientDecision(baseLink(), {
      decisionType: "concept_approved",
      roomId: "room-1",
      conceptId: "concept-1",
    });

    const decisionInsert = inserts.find((i) => i.table === "client_decisions");
    expect(decisionInsert).toBeDefined();
    expect((decisionInsert!.payload as Record<string, unknown>).decision_type).toBe(
      "concept_approved"
    );
  });
});

describe("getClientPresentationData — structural leak prevention", () => {
  /**
   * A chain that works both as `.select().eq().order().maybeSingle()` /
   * `.single()` AND as a plain thenable — `await query` without calling an
   * explicit terminal, matching how token.ts actually issues list queries.
   */
  function makeListableChain(data: unknown, error: unknown = null) {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      single: async () => ({ data, error }),
      maybeSingle: async () => ({ data, error }),
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve({ data, error }),
    };
    return chain;
  }

  it("never queries the internal estimates/cost_catalogue_items tables, and the estimate it returns has no cost/margin fields", async () => {
    const SECRET_MARGIN = 61.61;
    const SECRET_COST = 919191;

    const tableData: Record<string, unknown> = {
      projects: { title: "Sharma Residence", client_name: "Rohit Sharma", location: "Noida" },
      rooms: [
        {
          id: "room-1",
          name: "Kids' Bedroom",
          type: "kids_bedroom",
          dimension_length: 10,
          dimension_width: 10,
          dimension_ceiling_height: 9,
          dimension_unit: "ft",
        },
      ],
      room_photos: [{ id: "photo-1", room_id: "room-1", url: "https://x/photo.jpg", storage_path: null, is_primary: true }],
      design_concepts: [
        {
          id: "concept-1",
          room_id: "room-1",
          title: "Warm Minimal",
          style: "Warm Minimal",
          description: "desc",
          key_changes: ["New paint"],
          image_url: "data:image/svg+xml;base64,AAAA",
          provider: "demo",
          status: "demo",
        },
      ],
      estimate_versions: [
        {
          id: "ev-1",
          room_id: "room-1",
          version_number: 1,
          title: "Preliminary Estimate",
          display_status: "preliminary",
          line_items: [{ name: "Tiling", unit: "sqft", quantity: 10 }],
          subtotal_before_gst: 2000,
          gst_percent: 18,
          gst_amount: 360,
          total_client_estimate: 2360,
          published_at: new Date().toISOString(),
        },
      ],
      client_decisions: [],
    };

    const fromCalls: string[] = [];
    const fakeClient = {
      from: (table: string) => {
        fromCalls.push(table);
        return makeListableChain(tableData[table]);
      },
    };
    (createSupabaseAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fakeClient);

    const result = await getClientPresentationData(baseLink());
    const serialized = JSON.stringify(result);

    // The internal, cost-bearing tables must never be touched by this path.
    expect(fromCalls).not.toContain("estimates");
    expect(fromCalls).not.toContain("estimate_line_items");
    expect(fromCalls).not.toContain("cost_catalogue_items");

    // And even though the fake data doesn't include these values anywhere
    // (by construction, since estimate_versions has no such columns), assert
    // directly against the real client-facing field set too.
    expect(result.rooms[0].estimate).toEqual({
      id: "ev-1",
      versionNumber: 1,
      title: "Preliminary Estimate",
      displayStatus: "preliminary",
      lineItems: [{ name: "Tiling", unit: "sqft", quantity: 10 }],
      subtotalBeforeGst: 2000,
      gstPercent: 18,
      gstAmount: 360,
      totalClientEstimate: 2360,
      inclusions: undefined,
      exclusions: undefined,
      assumptions: undefined,
      validityDays: undefined,
      publishedAt: expect.any(String),
      isAccepted: false,
    });
    expect(serialized).not.toContain(String(SECRET_MARGIN));
    expect(serialized).not.toContain(String(SECRET_COST));
  });
});

describe("recordClientFeedback — scope and validation", () => {
  it("rejects feedback scoped to a room outside the link's project", async () => {
    setAdminClient({ rooms: { data: null, error: null } });

    await expect(
      recordClientFeedback(baseLink(), {
        message: "Please make it warmer",
        roomId: "room-from-another-project",
      })
    ).rejects.toThrow(/not part of this presentation/);
  });

  it("rejects an empty message", async () => {
    await expect(recordClientFeedback(baseLink(), { message: "   " })).rejects.toThrow(
      /cannot be empty/
    );
  });

  it("accepts project-level feedback with no roomId", async () => {
    const inserts: Record<string, unknown>[] = [];
    setAdminClient({}, inserts);

    await recordClientFeedback(baseLink(), { message: "Loving the direction so far!" });

    expect(inserts.find((i) => i.table === "client_feedback")).toBeDefined();
  });
});
