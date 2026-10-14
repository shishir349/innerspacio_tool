import { describe, expect, it } from "vitest";
import { draftLeadSchema, finalizeLeadSchema } from "@/lib/quote/schema";

const draft = { bhk: "2", packageTier: "premium", rooms: [{ roomType: "living_room" }] };
const contact = {
  city: "Pune",
  name: "Asha Rao",
  email: "asha@example.com",
  phone: "+919876543210",
  consent: true,
};

describe("quote schemas", () => {
  it("accepts a draft with no personal details", () => {
    expect(draftLeadSchema.safeParse(draft).success).toBe(true);
  });

  it("rejects too many rooms and too many of one type", () => {
    const seven = Array.from({ length: 7 }, () => ({ roomType: "bedroom" }));
    expect(draftLeadSchema.safeParse({ ...draft, rooms: seven }).success).toBe(false);
    const threeDining = Array.from({ length: 3 }, () => ({ roomType: "dining_room" }));
    expect(draftLeadSchema.safeParse({ ...draft, rooms: threeDining }).success).toBe(false);
  });

  it("finalize needs consent, a valid phone and a known city", () => {
    expect(finalizeLeadSchema.safeParse(contact).success).toBe(true);
    expect(finalizeLeadSchema.safeParse({ ...contact, consent: false }).success).toBe(false);
    expect(finalizeLeadSchema.safeParse({ ...contact, phone: "12" }).success).toBe(false);
    expect(finalizeLeadSchema.safeParse({ ...contact, city: "Atlantis" }).success).toBe(false);
  });

  it("honeypot must stay empty", () => {
    expect(finalizeLeadSchema.safeParse({ ...contact, website: "http://spam" }).success).toBe(false);
  });
});
