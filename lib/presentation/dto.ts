import type {
  ClientPresentationProject,
  ClientPresentationRoom,
  Project,
  Room,
} from "@/lib/types";

/**
 * The only path from internal domain data to anything shown in Client
 * Presentation Mode. Internal base costs, supplier rates, margin, gross
 * profit and internal notes are never read here — fields that aren't on
 * `ClientPresentationRoom`/`ClientPresentationProject` simply cannot leak,
 * regardless of what the rest of the app knows about a room.
 */
export function toPresentationRoom(room: Room): ClientPresentationRoom {
  const primaryPhoto = room.photos.find((p) => p.isPrimary) ?? room.photos[0];

  return {
    roomId: room.id,
    roomName: room.name,
    roomType: room.type,
    dimensions: room.dimensions,
    primaryPhotoUrl: primaryPhoto?.url,
    photos: room.photos.map((p) => ({ id: p.id, url: p.url, caption: p.caption })),
    concepts: room.concepts.map((c) => ({
      id: c.id,
      title: c.title,
      style: c.style,
      description: c.description,
      keyChanges: c.keyChanges,
      imageUrl: c.imageUrl,
      status: c.status,
      isSelected: c.isSelected,
    })),
    selectedConceptId: room.selectedConceptId,
    estimateSummary: room.estimate
      ? {
          lineItems: room.estimate.calculation.lineItems.map((li) => ({
            id: li.id,
            name: li.name,
            unit: li.unit,
            quantity: li.quantity,
          })),
          contingencyLabel: "Contingency included",
          subtotalBeforeGst: room.estimate.calculation.targetSellingSubtotal,
          gstPercent: room.estimate.calculation.gstPercent,
          gstAmount: room.estimate.calculation.gstAmount,
          totalClientEstimate: room.estimate.calculation.totalClientEstimate,
        }
      : undefined,
  };
}

export function toPresentationProject(project: Project): ClientPresentationProject {
  return {
    projectId: project.id,
    projectTitle: project.title,
    clientName: project.clientName,
    location: project.location,
    rooms: project.rooms.map(toPresentationRoom),
  };
}
