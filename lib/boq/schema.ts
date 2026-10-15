import { z } from "zod";
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
});

const coverageRow = z.object({
  requirement: z.string().max(300),
  room: z.string().max(60),
  lines: z.number().int().min(0).max(1000),
  codes: z.array(z.string().max(20)).max(50),
  titles: z.array(z.string().max(200)).max(50).default([]),
});

const planRoomRow = z.object({
  name: z.string().max(80),
  boqRoom: z.string().max(60),
  l: z.number().min(0).max(300),
  b: z.number().min(0).max(300),
  h: z.number().min(0).max(40),
  source: z.enum(["labelled", "scaled", "assumed"]),
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
  lines: z.array(lineSchema).min(1).max(MAX_BOQ_LINES),
});

export type BuildRequest = z.infer<typeof buildRequestSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
