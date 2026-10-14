import { z } from "zod";
import {
  BHK_OPTIONS,
  CITIES,
  MAX_IDEAS_LENGTH,
  MAX_QUOTE_ROOMS,
  PACKAGE_TIERS,
  QUOTE_ROOM_TYPES,
} from "@/lib/quote/constants";

const roomTypeValues = QUOTE_ROOM_TYPES.map((r) => r.value) as [string, ...string[]];

export const createLeadSchema = z
  .object({
    bhk: z.enum(BHK_OPTIONS),
    homeSize: z.enum(["small", "large"]).optional(),
    packageTier: z.enum(PACKAGE_TIERS),
    city: z.enum(CITIES),
    name: z.string().trim().min(2, "Please enter your name.").max(80),
    email: z.string().trim().email("Enter a valid email address.").max(120),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9][0-9\s-]{7,16}$/, "Enter a valid phone number."),
    whatsappOptIn: z.boolean().default(false),
    consent: z.literal(true, { message: "Please accept the privacy terms to continue." }),
    /** Honeypot: real users never see or fill this. */
    website: z.string().max(0).optional(),
    rooms: z
      .array(
        z.object({
          roomType: z.enum(roomTypeValues),
          ideas: z.string().trim().max(MAX_IDEAS_LENGTH).optional(),
        })
      )
      .min(1, "Select at least one room.")
      .max(MAX_QUOTE_ROOMS, `You can design up to ${MAX_QUOTE_ROOMS} rooms at a time.`),
  })
  .superRefine((v, ctx) => {
    for (const t of QUOTE_ROOM_TYPES) {
      const n = v.rooms.filter((r) => r.roomType === t.value).length;
      if (n > t.max) {
        ctx.addIssue({ code: "custom", message: `Too many rooms of type ${t.label}.`, path: ["rooms"] });
      }
    }
  });

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
