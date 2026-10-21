import { describe, expect, it } from "vitest";
import { guardFurniture } from "@/lib/boq/tier-guard";
import { quantify, type BriefItem } from "@/lib/boq/brief";

const mk = (room: string, requirement: string, rateId: string, count = 1): BriefItem =>
  ({ room, requirement, kind: "rate", rateId, count, basis: "count", status: "NEW" }) as BriefItem;

describe("grade follows the tier, not the model", () => {
  it("premium run: luxury furniture picks become elevated; bathroom fittings are the client's scope", () => {
    const r = guardFurniture([mk("Guest / Parents Bedroom", "Provide bed and side tables.", "lf:LFL08"), mk("Master Bathroom", "Replace sanitaryware and fixtures.", "bth:BTH02")], "premium");
    expect(r.items.map((x) => [x.rateId, x.status])).toEqual([["lf:LFE08", "NEW"], ["bth:BTH02", "EXCLUDED"]]);
    expect(r.warnings).toHaveLength(2);
    const t = guardFurniture([{ ...mk("Living", "sofa", "lf:LFL01"), title: "Living room — luxury 3-seater sofa" }], "premium");
    expect(t.items[0].title).toBe("Living room — elevated 3-seater sofa");
  });
  it("luxury keeps luxury; essential drops to basic", () => {
    expect(guardFurniture([mk("Living", "sofa", "lf:LFE01")], "luxury").items[0].rateId).toBe("lf:LFL01");
    expect(guardFurniture([mk("Living", "sofa", "lf:LFL01")], "essential").items[0].rateId).toBe("lf:LFB01");
  });
});

describe("furniture the brief never names is dropped, and said so", () => {
  const bed = "Provide bed and side tables.";
  it("keeps the bed and side tables, drops chairs, coffee table and study chair quoted from an unrelated line", () => {
    const r = guardFurniture(
      [
        mk("Kids Room", bed, "lf:LFE07"), mk("Kids Room", bed, "lf:LFE10"),
        mk("Kids Room", bed, "lf:LFE02", 2), mk("Kids Room", bed, "lf:LFE03"),
        mk("Kids Room", "Install a study-cum-storage unit.", "lf:LFE12"),
      ],
      "premium"
    );
    expect(r.items.map((x) => x.rateId)).toEqual(["lf:LFE07", "lf:LFE10"]);
    expect(r.warnings.filter((w) => /dropped/.test(w))).toHaveLength(3);
  });
  it("keeps what is named: accent chairs and a coffee table when the brief asks for them", () => {
    const r = guardFurniture([mk("Master Bedroom", "Procure two accent chairs and a coffee table.", "lf:LFE02", 2), mk("Master Bedroom", "Procure two accent chairs and a coffee table.", "lf:LFE03")], "premium");
    expect(r.items).toHaveLength(2);
  });
  it("a sofa set keeps the sofas but not the coffee tables the model added", () => {
    const q = "Procure and install the living room sofa set.";
    const r = guardFurniture([mk("Living", q, "lf:LFE01"), mk("Living", q, "al:SOFA2"), mk("Living", q, "lf:LFE03", 2)], "premium");
    expect(r.items.map((x) => x.rateId)).toEqual(["lf:LFE01", "al:SOFA2"]);
  });
  it("never touches non-furniture items", () => {
    const x = mk("Kitchen", "Install a modular kitchen.", "mod:C06");
    expect(guardFurniture([x], "premium").items).toEqual([x]);
  });
});

describe("quantify applies the guard", () => {
  it("a luxury sofa in a premium BOQ is billed elevated and the change is a warning", () => {
    const r = quantify([mk("Living", "Procure the sofa.", "lf:LFL01")], [], { tier: "premium", city: "Noida" } as Parameters<typeof quantify>[2]);
    expect(r.lines.map((l) => l.rateId)).toEqual(["lf:LFE01"]);
    expect(r.warnings.some((w) => /lf:LFE01/.test(w))).toBe(true);
  });
});
