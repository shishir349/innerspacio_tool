import { z } from "zod";
import { BHK_OPTIONS, PACKAGE_TIERS, QUOTE_ROOM_TYPES } from "@/lib/quote/constants";

const roomTypes = QUOTE_ROOM_TYPES.map((r) => r.value) as [string, ...string[]];

export const MAX_BOQ_LINES = 600;

export const specSchema = z.object({
  bhk: z.enum(BHK_OPTIONS),
  homeSize: z.enum(["small", "large"]).optional(),
  city: z.string().trim().max(60),
  tier: z.enum(PACKAGE_TIERS),
  rooms: z.array(z.object({ roomType: z.enum(roomTypes) })).max(20),
});

/** Either build from a stored lead, or from an explicit spec. */
export const buildRequestSchema = z.union([
  z.object({ leadId: z.string().uuid() }),
  specSchema,
]);

const num = z.number().finite().min(0).max(100_000_000);

export const lineSchema = z.object({
  room: z.string().trim().min(1).max(60),
  trade: z.string().trim().min(1).max(80),
  item: z.string().trim().max(80),
  description: z.string().max(1200),
  uom: z.string().trim().min(1).max(12),
  l: num.nullish(),
  b: num.nullish(),
  h: num.nullish(),
  qty: num,
  rate: num,
});

export const exportRequestSchema = z.object({
  client: z.string().trim().max(120).optional(),
  location: z.string().trim().max(160).optional(),
  date: z.string().trim().max(20).optional(),
  specification: z.string().trim().max(120).optional(),
  lines: z.array(lineSchema).min(1).max(MAX_BOQ_LINES),
});

export type BuildRequest = z.infer<typeof buildRequestSchema>;
export type ExportRequest = z.infer<typeof exportRequestSchema>;
