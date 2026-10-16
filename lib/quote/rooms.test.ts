import { describe, expect, it } from "vitest";
import { BHK_OPTIONS, BHK_ROOM_DEFAULTS, MAX_PHOTO_ROOMS, MAX_QUOTE_ROOMS, QUOTE_ROOM_TYPES } from "@/lib/quote/constants";
import { draftLeadSchema } from "@/lib/quote/schema";

describe("BHK room defaults", () => {
  it("every home type has a default that fits the per-type and total caps", () => {
    for (const b of BHK_OPTIONS) {
      const d = BHK_ROOM_DEFAULTS[b];
      let total = 0;
      for (const t of QUOTE_ROOM_TYPES) {
        const n = d[t.value] ?? 0;
        expect(n, `${b} ${t.value}`).toBeLessThanOrEqual(t.max);
        total += n;
      }
      expect(total, b).toBeGreaterThan(0);
      expect(total, b).toBeLessThanOrEqual(MAX_QUOTE_ROOMS);
    }
  });

  it("bigger homes never default to fewer rooms", () => {
    const sum = (b: (typeof BHK_OPTIONS)[number]) => Object.values(BHK_ROOM_DEFAULTS[b]).reduce((a, n) => a + (n ?? 0), 0);
    for (let i = 1; i < BHK_OPTIONS.length; i++) expect(sum(BHK_OPTIONS[i])).toBeGreaterThanOrEqual(sum(BHK_OPTIONS[i - 1]));
  });

  it("the draft schema accepts a full 5 BHK default and the photo cap is below the room cap", () => {
    const rooms = QUOTE_ROOM_TYPES.flatMap((t) =>
      Array.from({ length: BHK_ROOM_DEFAULTS["5+"][t.value] ?? 0 }, () => ({ roomType: t.value }))
    );
    expect(draftLeadSchema.safeParse({ bhk: "5+", packageTier: "premium", rooms }).success).toBe(true);
    expect(MAX_PHOTO_ROOMS).toBeLessThan(MAX_QUOTE_ROOMS);
  });
});
