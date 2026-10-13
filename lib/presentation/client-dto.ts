import "server-only";
import type { ConceptGenerationStatus, EstimateDisplayStatus, Id, RoomType } from "@/lib/types";

/**
 * The allowlisted shape of everything `/present/[token]` can ever render.
 * Deliberately has no field for base cost, supplier rate, margin, gross
 * profit, internal notes, client phone/email, or any other project's data —
 * `buildClientLinkProject` (below) is the only place that constructs one of
 * these, directly from validated rows, field by field. There's no object
 * spread anywhere in that path that could leak an unlisted field.
 */
export interface ClientLinkConcept {
  id: Id;
  title: string;
  style: string;
  description: string;
  keyChanges: string[];
  imageUrl: string;
  status: ConceptGenerationStatus;
  isSelected: boolean;
  isApproved: boolean;
}

export interface ClientLinkEstimate {
  id: Id;
  versionNumber: number;
  title: string;
  displayStatus: EstimateDisplayStatus;
  lineItems: { name: string; unit: string; quantity: number }[];
  subtotalBeforeGst: number;
  gstPercent: number;
  gstAmount: number;
  totalClientEstimate: number;
  inclusions?: string;
  exclusions?: string;
  assumptions?: string;
  validityDays: number;
  publishedAt: string;
  isAccepted: boolean;
}

export interface ClientLinkRoom {
  roomId: Id;
  roomName: string;
  roomType: RoomType;
  dimensions: { length?: number; width?: number; ceilingHeight?: number; unit: "ft" | "m" };
  originalPhotoUrl?: string;
  concepts: ClientLinkConcept[];
  estimate?: ClientLinkEstimate;
}

export interface ClientLinkProject {
  projectTitle: string;
  clientFirstName?: string;
  location?: string;
  rooms: ClientLinkRoom[];
}
