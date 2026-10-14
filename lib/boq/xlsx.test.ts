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
