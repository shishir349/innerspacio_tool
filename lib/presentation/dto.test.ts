import { describe, expect, it } from "vitest";
import { toPresentationProject, toPresentationRoom } from "./dto";
import type { Project, Room } from "@/lib/types";

// Deliberately distinctive, never-otherwise-used numbers so a leak via an
// accidental object spread (e.g. `...room` or `...room.estimate`) is easy
// to catch in the serialized output, not just by checking key names.
const SECRET_BASE_COST = 919191;
const SECRET_MARGIN = 61.61;
const SECRET_GROSS_PROFIT = 737373;
const SECRET_SUPPLIER_NOTE = "Supplier X offers 15% kickback — do not mention to client";
const SECRET_INTERNAL_CONSTRAINT = "Budget is actually flexible by 30%, don't reveal to client";

function buildRoomWithSensitiveData(): Room {
  const now = new Date().toISOString();
  return {
    id: "room-1",
    projectId: "project-1",
    name: "Test Room",
    type: "bedroom",
    dimensions: { length: 10, width: 10, unit: "ft" },
    photos: [
      { id: "photo-1", roomId: "room-1", url: "https://example.com/photo.jpg", isPrimary: true, createdAt: now },
    ],
    existingConditionNotes: "fine",
    constraints: SECRET_INTERNAL_CONSTRAINT,
    concepts: [
      {
        id: "concept-1",
        roomId: "room-1",
        title: "Warm Minimal",
        style: "Warm Minimal",
        description: "A nice concept",
        keyChanges: ["New paint"],
        imageUrl: "data:image/svg+xml;base64,AAAA",
        provider: "demo",
        status: "demo",
        isSelected: true,
        createdAt: now,
      },
    ],
    selectedConceptId: "concept-1",
    estimate: {
      id: "estimate-1",
      roomId: "room-1",
      projectId: "project-1",
      calculation: {
        lineItems: [
          {
            id: "line-1",
            catalogueItemId: "cat-1",
            name: "Tiling",
            unit: "sqft",
            baseCostPerUnit: SECRET_BASE_COST,
            quantity: 10,
            lineDirectCost: SECRET_BASE_COST * 10,
          },
        ],
        additionalCosts: [{ id: "extra-1", label: SECRET_SUPPLIER_NOTE, amount: 500 }],
        directCost: 1000,
        contingencyPercent: 8,
        contingencyAmount: 80,
        costBasis: 1080,
        targetGrossMarginPercent: SECRET_MARGIN,
        targetSellingSubtotal: 2000,
        grossProfit: SECRET_GROSS_PROFIT,
        actualGrossMarginPercent: SECRET_MARGIN,
        gstPercent: 18,
        gstAmount: 360,
        totalClientEstimate: 2360,
      },
      createdAt: now,
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function buildProjectWithSensitiveData(): Project {
  const now = new Date().toISOString();
  return {
    id: "project-1",
    title: "Test Project",
    clientName: "Test Client",
    clientPhone: "+91 90000 00000",
    clientEmail: "client@example.com",
    location: "Test City",
    status: "in_progress",
    notes: SECRET_INTERNAL_CONSTRAINT,
    rooms: [buildRoomWithSensitiveData()],
    createdAt: now,
    updatedAt: now,
  };
}

describe("toPresentationRoom", () => {
  it("never includes cost, margin, profit or supplier-rate fields", () => {
    const presented = toPresentationRoom(buildRoomWithSensitiveData());
    const serialized = JSON.stringify(presented);

    // Key-name check: the DTO type itself shouldn't carry these fields.
    expect(presented).not.toHaveProperty("estimate");
    expect(presented.estimateSummary).not.toHaveProperty("lineItems.0.baseCostPerUnit");
    expect((presented as unknown as Record<string, unknown>).constraints).toBeUndefined();

    // Value-level check: catches a leak even if it arrived under an
    // unexpected key (e.g. via a careless object spread).
    expect(serialized).not.toContain(String(SECRET_BASE_COST));
    expect(serialized).not.toContain(String(SECRET_MARGIN));
    expect(serialized).not.toContain(String(SECRET_GROSS_PROFIT));
    expect(serialized).not.toContain(SECRET_SUPPLIER_NOTE);
    expect(serialized).not.toContain(SECRET_INTERNAL_CONSTRAINT);

    // What *should* be present: itemized lines without pricing, and the total.
    expect(presented.estimateSummary?.lineItems).toEqual([
      { id: "line-1", name: "Tiling", unit: "sqft", quantity: 10 },
    ]);
    expect(presented.estimateSummary?.totalClientEstimate).toBe(2360);
  });

  it("only exposes an allowlisted set of top-level keys", () => {
    const presented = toPresentationRoom(buildRoomWithSensitiveData());
    expect(Object.keys(presented).sort()).toEqual(
      [
        "roomId",
        "roomName",
        "roomType",
        "dimensions",
        "primaryPhotoUrl",
        "photos",
        "concepts",
        "selectedConceptId",
        "estimateSummary",
      ].sort()
    );
  });
});

describe("toPresentationProject", () => {
  it("never includes client phone/email or internal project notes", () => {
    const presented = toPresentationProject(buildProjectWithSensitiveData());
    const serialized = JSON.stringify(presented);

    expect(presented).not.toHaveProperty("clientPhone");
    expect(presented).not.toHaveProperty("clientEmail");
    expect(presented).not.toHaveProperty("notes");
    expect(serialized).not.toContain("client@example.com");
    expect(serialized).not.toContain("+91 90000 00000");
    expect(serialized).not.toContain(SECRET_INTERNAL_CONSTRAINT);
  });
});
