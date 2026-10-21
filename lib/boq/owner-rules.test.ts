import { describe, expect, it } from "vitest";
import { buildBoq, specAssumptions, tierHints } from "@/lib/boq/build";
import { quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";
import { guardFurniture } from "@/lib/boq/tier-guard";
import { validateBoq } from "@/lib/boq/validate";
import { BATH_TILE_H, KITCHEN_STANDARD as KS, WALL_NET } from "@/lib/boq/standards";
import { getRate } from "@/lib/rates/catalog";

/** The owner's answers (pre-booking estimate rules) pinned as behaviour. */
const rooms = [{ roomType: "living_room" as const }, { roomType: "kitchen" as const }, { roomType: "bedroom" as const }, { roomType: "bathroom" as const }, { roomType: "bedroom" as const }, { roomType: "bathroom" as const }];
const spec = (tier: "essential" | "premium" | "luxury") => buildBoq({ bhk: "3", tier, city: "Delhi", rooms });

describe("spec-mode estimate follows the owner's rules at every tier", () => {
  for (const tier of ["essential", "premium", "luxury"] as const) {
    const lines = spec(tier);
    it(`${tier}: kitchen is the standard HG-laminate / HDHMR / BWP-sink / Hettich / InnoTech kitchen, no loft`, () => {
      const k = lines.filter((l) => l.room === "Kitchen" && l.trade === "Modular Woodwork" && l.rateId === "mod:unit");
      expect(k.length).toBeGreaterThanOrEqual(4);
      for (const l of k) expect(l.code, l.item).toContain(KS.shutter.slice(4));
      expect(k.filter((l) => l.code.includes(KS.wetCarcass.slice(4)))).toHaveLength(1); // BWP at the sink only
      expect(k.some((l) => (l.remarks ?? "").toLowerCase().includes("loft"))).toBe(false);
      expect(lines.find((l) => l.rateId === "mod:K03")!.qty).toBe(KS.innotechDrawers);
      expect(lines.find((l) => l.rateId === "mod:K14")!.qty).toBe(KS.bottlePullouts);
    });
    it(`${tier}: no electrical, waterproofing, deep cleaning, sanitaryware or geyser by default; floor protection is included`, () => {
      expect(lines.filter((l) => l.trade === "Electrical & AC Works")).toEqual([]);
      expect(lines.filter((l) => l.trade === "Waterproofing" || /waterproof/i.test(l.item))).toEqual([]);
      expect(lines.some((l) => l.rateId === "sc:SC02")).toBe(false);
      expect(lines.some((l) => l.trade === "Bathroom Sanitaryware & CP Fittings" || l.rateId === "fu:BF10")).toBe(false);
      expect(lines.filter((l) => l.rateId === "sc:SC04")).toHaveLength(1);
    });
    it(`${tier}: the vanity is priced; bathroom tiles run to ${BATH_TILE_H} ft`, () => {
      expect(lines.some((l) => l.room === "Master Bathroom" && l.item === "Bathroom Vanity")).toBe(true);
      const wall = lines.find((l) => l.room === "Master Bathroom" && l.rateId === "cv:CV03")!;
      expect(wall.h).toBe(BATH_TILE_H);
      expect(wall.qty).toBeCloseTo(wall.l! * BATH_TILE_H * WALL_NET, 1);
    });
  }
  it("the assumptions say what is and is not included", () => {
    const a = specAssumptions({ bhk: "3", homeSize: undefined }).join("\n");
    expect(a).toMatch(/grain trolley/);
    expect(a).toMatch(/client's scope/);
    expect(a).toMatch(/NOT included unless specifically requested/);
    expect(a).toMatch(/8 ft/);
  });
  it("tier hints no longer offer bathroom fittings", () => {
    expect(Object.keys(tierHints("premium"))).not.toContain("bathroomFittings");
  });
});

const item = (p: Partial<BriefItem>): BriefItem => ({ room: "Master Bathroom", requirement: "req", kind: "rate", basis: "count", status: "NEW", ...p }) as BriefItem;

describe("guard: client scope and opt-in services", () => {
  it("sanitaryware is held as EXCLUDED (recorded, never priced) at any tier", () => {
    const r = quantify([item({ requirement: "Replace sanitaryware and fixtures.", rateId: "bth:BTH02" })], [], { tier: "luxury", city: "Noida", homeCare: false });
    expect(r.lines).toEqual([]);
    expect(r.coverage[0]).toMatchObject({ status: "EXCLUDED", lines: 0 });
  });
  it("waterproofing, electrical and cleaning are dropped unless the requirement names them", () => {
    const tl = (rateId: string, requirement: string) => guardFurniture([item({ rateId, requirement })], "premium").items.length;
    expect(tl("cv:CV10", "Fully renovate the bathroom.")).toBe(0);
    expect(tl("cv:CV10", "Redo the bathroom waterproofing.")).toBe(1);
    expect(tl("el:EL30", "Install a TV unit.")).toBe(0);
    expect(tl("el:EL30", "Install new light points.")).toBe(1);
    expect(tl("sc:SC02", "Renovate the kitchen.")).toBe(0);
    expect(tl("sc:SC02", "Deep clean at handover.")).toBe(1);
    expect(guardFurniture([item({ unit: "deep_clean", requirement: "Paint the home" })], "premium").items).toHaveLength(0);
  });
});

describe("plan mode: bathroom tile height and defaults", () => {
  const bath: PlanRoom = { id: "b", name: "Bath", boqRoom: "Master Bathroom", l: 10, b: 6, h: 10, source: "labelled" };
  it("wall tiling and tile removal take 8 ft; paint keeps the room height", () => {
    const tile = quantify([item({ rateId: "cv:CV03", basis: "wall_area" })], [bath], { tier: "premium", city: "Noida", homeCare: false }).lines[0];
    expect(tile.qty).toBeCloseTo(2 * (10 + 6) * BATH_TILE_H * WALL_NET, 1);
    const paint = quantify([item({ rateId: "ps:F06", basis: "wall_area", requirement: "paint" })], [bath], { tier: "premium", city: "Noida", homeCare: false }).lines[0];
    expect(paint.qty).toBeCloseTo(2 * (10 + 6) * 10 * WALL_NET, 1);
  });
  it("floor protection is a default; deep cleaning is not", () => {
    const codes = quantify([], [bath], { tier: "premium", city: "Noida" }).lines.map((l) => l.rateId);
    expect(codes).toEqual(["sc:SC04"]);
  });
});

describe("measurement rule: the card unit is the unit", () => {
  const line = { room: "Living", trade: "Paint & Polish", item: "Paint", rateId: "ps:F06", uom: "Rft", qty: 10, rate: 48 };
  it("warns when a card rate is billed in another unit", () => {
    expect(validateBoq([line]).some((i) => /differs from the card unit Sq\.Ft\./.test(i.message))).toBe(true);
    expect(validateBoq([{ ...line, uom: "Sq.Ft." }]).some((i) => /card unit/.test(i.message))).toBe(false);
  });
  it("the kitchen add-ons are countable items on the card", () => {
    expect(getRate("mod:K03").uom).toBe("Nos");
    expect(getRate("mod:K14").uom).toBe("Nos");
  });
});
