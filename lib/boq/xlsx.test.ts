import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildBoqWorkbook } from "@/lib/boq/xlsx";
import { buildBoq } from "@/lib/boq/build";

async function load(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb;
}

const lines = buildBoq({
  bhk: "2",
  city: "Delhi",
  tier: "premium",
  rooms: [{ roomType: "living_room" }, { roomType: "kitchen" }, { roomType: "bedroom" }, { roomType: "bathroom" }],
});

describe("buildBoqWorkbook", () => {
  it("has the six reference sheets in order", async () => {
    const wb = await load(await buildBoqWorkbook({ lines }));
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Instructions",
      "Master BOQ",
      "Trade Summary",
      "Room Summary",
      "Lists",
      "General Assumptions",
    ]);
  });

  it("amount is a live Qty × Rate formula with the right cached value", async () => {
    const wb = await load(await buildBoqWorkbook({ lines }));
    const ws = wb.getWorksheet("Master BOQ")!;
    let found = 0;
    ws.eachRow((row, n) => {
      const k = row.getCell(11).value as ExcelJS.CellFormulaValue | null;
      if (n >= 7 && k && typeof k === "object" && "formula" in k && Number(row.getCell(9).value) > 0) {
        expect(k.formula).toBe(`I${n}*J${n}`);
        expect(k.result).toBeCloseTo(Number(row.getCell(9).value) * Number(row.getCell(10).value), 1);
        found++;
      }
    });
    expect(found).toBe(lines.length);
  });

  it("trade and room summaries reconcile with the BOQ total", async () => {
    const total = lines.reduce((n, l) => n + l.amount, 0);
    const wb = await load(await buildBoqWorkbook({ lines }));
    const grandOf = (name: string) => {
      const ws = wb.getWorksheet(name)!;
      let v = 0;
      ws.eachRow((row) => {
        if (row.getCell(1).value === "Grand Total") {
          v = ((row.getCell(2).value as ExcelJS.CellFormulaValue).result as number) ?? 0;
        }
      });
      return v;
    };
    expect(grandOf("Trade Summary")).toBeCloseTo(total, 0);
    expect(grandOf("Room Summary")).toBeCloseTo(total, 0);
  });

  it("puts dropdown validations on room, trade, item and uom", async () => {
    const wb = await load(await buildBoqWorkbook({ lines }));
    const ws = wb.getWorksheet("Master BOQ")!;
    const first = ws.getRow(8);
    for (const c of [1, 2, 3, 5]) expect(first.getCell(c).dataValidation?.type).toBe("list");
  });
});

describe("professional-BOQ parity in the workbook", () => {
  const withMeta = {
    lines: [
      { room: "Entrance", trade: "Wall Panelling", item: "Wall Panelling", title: "Entrance feature wall — fluted HDHMR", description: "d", uom: "Sq.Ft.", qty: 10, rate: 1129, rateSource: "spazay" as const, altRate: 900 },
      { room: "Living", trade: "Furnishings & Décor", item: "Furnishing", title: "New curtains", description: "d", uom: "Rft", qty: 45, rate: 800, rateSource: "spazay" as const, provisional: true },
    ],
    sheet: "both" as const,
    coverage: [
      { requirement: "Entrance feature wall", room: "Entrance", lines: 1, codes: ["WP11"], titles: ["Entrance feature wall — fluted HDHMR"] },
      { requirement: "Lighting", room: "Living", lines: 0, codes: [], titles: [] },
    ],
    planRooms: [{ name: "Entrance", boqRoom: "Entrance", l: 10, b: 8, h: 9, source: "assumed" }],
  };

  it("prints the rate sheet, the specific title, rate basis and the Livspace reference", async () => {
    const wb = await load(await buildBoqWorkbook(withMeta));
    const ws = wb.getWorksheet("Master BOQ")!;
    expect(String(ws.getCell("A3").value)).toContain("Spazay billed · Livspace shown for comparison");
    expect(ws.getCell("C8").value).toBe("Entrance feature wall — fluted HDHMR");
    expect(ws.getCell("L8").value).toBe("Spazay");
    expect(ws.getCell("M8").value).toBe(900);
    expect(String(ws.getCell("L12").value)).toMatch(/Provisional/);
  });

  it("ends with a Grand Total, the client-scope exclusions and the disclaimers", async () => {
    const wb = await load(await buildBoqWorkbook(withMeta));
    const ws = wb.getWorksheet("Master BOQ")!;
    let grand = 0;
    const text: string[] = [];
    ws.eachRow((row) => {
      if (row.getCell(1).value === "Grand Total") grand = ((row.getCell(11).value as ExcelJS.CellFormulaValue).result as number) ?? 0;
      text.push(String(row.getCell(4).value ?? "") + String(row.getCell(1).value ?? ""));
    });
    expect(grand).toBeCloseTo(10 * 1129 + 45 * 800, 1);
    expect(text.join("|")).toContain("Taxes & GST are applicable extra");
    expect(text.join("|")).toContain("final quantities, specifications and rates may vary");
  });

  it("adds a Scope Coverage sheet that flags unpriced requirements and lists assumed areas", async () => {
    const wb = await load(await buildBoqWorkbook(withMeta));
    const sc = wb.getWorksheet("Scope Coverage")!;
    const cells: string[] = [];
    sc.eachRow((row) => row.eachCell((c) => cells.push(String(c.value))));
    const all = cells.join("|");
    expect(all).toContain("WP11");
    expect(all).toContain("NOT PRICED");
    expect(all).toContain("1 line(s) are provisional allowances");
    expect(all).toContain("10 ft × 8 ft = 80 sq ft");
  });

  it("omits Scope Coverage when there is nothing to cover (spec-built BOQ)", async () => {
    const wb = await load(await buildBoqWorkbook({ lines }));
    expect(wb.getWorksheet("Scope Coverage")).toBeUndefined();
  });
});
