import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { quantify, type BriefItem, type PlanRoom } from "@/lib/boq/brief";
import { buildBoqWorkbook } from "@/lib/boq/xlsx";

/** Regression for boq_sample2 (Greenwoods villa): multi-room, area labels, loose furniture, whole-home. */

const rooms: PlanRoom[] = [
  { id: "k1", name: "Kids Bedroom-1", boqRoom: "Kids Room", l: 14, b: 12, h: 10, source: "assumed" },
  { id: "k2", name: "Kids Bedroom-2", boqRoom: "Kids Room", l: 14, b: 12, h: 10, source: "assumed" },
];
const item = (p: Partial<BriefItem> & Pick<BriefItem, "room" | "requirement">): BriefItem => ({ kind: "rate", basis: "area", ...p });
const items: BriefItem[] = [
  item({ room: "Foyer / Entryway", area: "Boot Room", requirement: "Boot room shelf", rateId: "mod:FS01", basis: "length", width: 200 }),
  item({ room: "Study / Office", requirement: "Study storage", kind: "modular", item: "Study Table/Desk", basis: "elevation", width: 12, height: 9 }),
  item({ room: "Kids Room", area: "Kids Bedroom-1", requirement: "Kids 1 wardrobe", kind: "modular", item: "Wardrobe", basis: "elevation", width: 10, height: 9 }),
  item({ room: "Kids Room", area: "Kids Bedroom-2", requirement: "Kids 2 wardrobe", kind: "modular", item: "Wardrobe", basis: "elevation", width: 13, height: 10 }),
  item({ room: "Living", requirement: "Sofa", rateId: "lf:LFL01", basis: "count", count: 1 }),
  item({ room: "Others / Whole Home Civil", area: "Whole Home", requirement: "Glass railing", rateId: "al:RAILING", basis: "length", width: 250 }),
  item({ room: "Others / Whole Home Civil", area: "Whole Home", requirement: "Jacuzzi", rateId: "al:JACUZZI", basis: "count", count: 1 }),
];
const { lines } = quantify(items, rooms, { tier: "luxury", city: "Noida", homeCare: false });

describe("Greenwoods villa brief", () => {
  it("every line is complete and carries its plan area", () => {
    expect(lines).toHaveLength(7);
    for (const l of lines) {
      for (const k of ["room", "trade", "item", "title", "description", "uom"] as const) expect(l[k], `${l.rateId} ${k}`).toBeTruthy();
      expect(l.qty).toBeGreaterThan(0);
      expect(l.rate).toBeGreaterThan(0);
      expect(l.area).toBeTruthy();
    }
    expect(lines.filter((l) => l.room === "Kids Room").map((l) => l.area).sort()).toEqual(["Kids Bedroom-1", "Kids Bedroom-2"]);
    expect(lines.find((l) => l.rateId === "mod:FS01")!.area).toBe("Boot Room");
  });

  it("modular units are single all-in lines at the luxury spec", () => {
    const w = lines.find((l) => l.area === "Kids Bedroom-2")!;
    expect(w.qty).toBe(130);
    expect(w.rate).toBe(1635 + 1168 + 467); // C09 + S05 + H02
  });

  it("allowances flag provisional; loose furniture lands in Annexure B", async () => {
    expect(lines.filter((l) => l.provisional).map((l) => l.rateId).sort()).toEqual(["al:JACUZZI", "al:RAILING"]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildBoqWorkbook({ lines })) as unknown as ArrayBuffer);
    const col: string[] = [];
    wb.getWorksheet("Master BOQ")!.eachRow((r) => col.push(String(r.getCell(1).value ?? "")));
    const b = col.findIndex((v) => v.startsWith("COSTING ANNEXURE B"));
    expect(b).toBeGreaterThan(0);
    expect(col.slice(b).some((v) => v === "Living")).toBe(true);
    expect(col.slice(0, b).some((v) => v === "Study / Office")).toBe(true);
  });
});
