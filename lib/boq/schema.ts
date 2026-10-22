import { z } from "zod";
import { briefItemSchema, planRoomSchema } from "@/lib/boq/brief";
import { SCOPE_STATUSES } from "@/lib/boq/build";
import { BHK_OPTIONS, PACKAGE_TIERS, QUOTE_ROOM_TYPES } from "@/lib/quote/constants";
import { RATE_SHEETS } from "@/lib/rates/sheets";

const roomTypes = QUOTE_ROOM_TYPES.map((r) => r.value) as [string, ...string[]];

export const MAX_BOQ_LINES = 600;

export const specSchema = z.object({
  bhk: z.enum(BHK_OPTIONS),
  homeSize: z.enum(["small", "large"]).optional(),
  city: z.string().trim().max(60),
  tier: z.enum(PACKAGE_TIERS),
  sheet: z.enum(RATE_SHEETS).default("spazay"),
  rooms: z.array(z.object({ roomType: z.enum(roomTypes) })).max(20),
});

/** Either build from a stored lead, or from an explicit spec. */
export const buildRequestSchema = z.union([
  z.object({ leadId: z.string().uuid(), sheet: z.enum(RATE_SHEETS).default("spazay") }),
  specSchema,
]);

const num = z.number().finite().min(0).max(100_000_000);

export const lineSchema = z.object({
  room: z.string().trim().min(1).max(60),
  trade: z.string().trim().min(1).max(80),
  item: z.string().trim().max(80),
  title: z.string().trim().max(160).optional(),
  code: z.string().trim().max(20).optional(),
  description: z.string().max(1200),
  remarks: z.string().max(400).optional(),
  area: z.string().trim().max(80).optional(),
  uom: z.string().trim().min(1).max(12),
  l: num.nullish(),
  b: num.nullish(),
  h: num.nullish(),
  qty: num,
  rate: num,
  rateSource: z.enum(["spazay", "livspace"]).optional(),
  altRate: num.nullish(),
  provisional: z.boolean().optional(),
  rateNote: z.string().max(200).optional(),
  qtySource: z.enum(["measured", "entered", "estimated"]).optional(),
  scopeStatus: z.enum(SCOPE_STATUSES).optional(),
  /** Rate-card id the rate came from ("" = a custom rate). */
  rateId: z.string().max(40).optional(),
  autoAdded: z.boolean().optional(),
});

const coverageRow = z.object({
  requirement: z.string().max(300),
  room: z.string().max(60),
  lines: z.number().int().min(0).max(1000),
  codes: z.array(z.string().max(20)).max(50),
  titles: z.array(z.string().max(200)).max(50).default([]),
  status: z.enum(SCOPE_STATUSES).optional(),
});

const planRoomRow = z.object({
  id: z.string().max(40).optional(),
  name: z.string().max(80),
  boqRoom: z.string().max(60),
  l: z.number().min(0).max(300),
  b: z.number().min(0).max(300),
  h: z.number().min(0).max(40),
  source: z.enum(["labelled", "scaled", "assumed", "entered"]),
});

/** The AI's reading of the plan exactly as it came back (before any designer edit), kept so it can be reused and audited. */
export const readingSchema = z.object({
  hash: z.string().length(64),
  source: z.enum(["ai", "reused"]),
  fromBoqId: z.string().max(64).optional(),
  at: z.string().max(40),
  scope: z.object({
    rooms: z.array(planRoomSchema).max(40),
    items: z.array(briefItemSchema).max(200),
    assumptions: z.array(z.string().max(300)).max(40),
    unpriced: z.array(z.object({ requirement: z.string().max(300), reason: z.string().max(300) })).max(40),
    questions: z.array(z.string().max(300)).max(40),
    dropped: z.array(z.string().max(300)).max(100),
  }),
});

export const exportRequestSchema = z.object({
  client: z.string().trim().max(120).optional(),
  location: z.string().trim().max(160).optional(),
  date: z.string().trim().max(20).optional(),
  specification: z.string().trim().max(120).optional(),
  preparedBy: z.string().trim().max(80).optional(),
  sheet: z.enum(RATE_SHEETS).optional(),
  coverage: z.array(coverageRow).max(100).optional(),
  planRooms: z.array(planRoomRow).max(40).optional(),
  /** The client's stated budget (₹), for comparison only. */
  budget: z.number().finite().min(0).max(10_000_000_000).optional(),
  /** Original AI reading of the plan this BOQ came from (absent for spec-mode BOQs). */
  reading: readingSchema.optional(),
  /** Rate-card + rules version the lines were priced with (lib/boq/provenance.ts). */
  pricingVersion: z.string().max(40).optional(),
  /** The reviewed scope the lines were priced from; `approved` is the designer's sign-off. */
  scope: z.object({ approved: z.boolean(), items: z.array(briefItemSchema).max(200) }).optional(),
  lines: z.array(lineSchema).min(1).max(MAX_BOQ_LINES),
});

/** Save the workbench under a project (the export payload plus where it belongs). */
export const saveRequestSchema = exportRequestSchema.extend({
  projectId: z.string().min(1).max(64),
  boqId: z.string().max(64).optional(),
  leadId: z.string().uuid().optional(),
  /** Ask to approve this estimate (server checks the scope is approved and stamps who / when). */
  finalApprove: z.boolean().optional(),
  title: z.string().trim().min(1).max(120),
  tier: z.enum(PACKAGE_TIERS),
  city: z.string().trim().max(60),
});

export type BuildRequest = z.infer<typeof buildRequestSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
