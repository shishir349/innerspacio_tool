import "server-only";
import ExcelJS from "exceljs";
import { BOQ_ITEMS, BOQ_ROOMS, BOQ_TRADES, BOQ_UOMS } from "@/lib/boq/lists";
import { RATE_SHEET_LABEL, type RateSheet } from "@/lib/rates/sheets";

/**
 * Builds the BOQ workbook in the reference layout (Instructions · Master BOQ ·
 * Trade Summary · Room Summary · Lists · General Assumptions). Amount, trade and room
 * totals are live formulas, with cached results so previewers that don't recalc still
 * show numbers.
 */

export interface BoqSheetLine {
  room: string;
  trade: string;
  item: string;
  /** Specific line title; the "Line / BOQ Item" column prints this, falling back to `item`. */
  title?: string;
  rateSource?: "spazay" | "livspace";
  /** Livspace reference rate (compare mode). */
  altRate?: number | null;
  provisional?: boolean;
  description: string;
  uom: string;
  l?: number | null;
  b?: number | null;
  h?: number | null;
  qty: number;
  rate: number;
}

export interface BoqSheetOptions {
  lines: BoqSheetLine[];
  client?: string;
  location?: string;
  date?: string;
  /** e.g. "Premium specification" — printed on the Instructions sheet. */
  specification?: string;
  preparedBy?: string;
  /** Rate sheet the lines were priced from (printed on the Master BOQ). */
  sheet?: RateSheet;
  /** Requirement → lines map for the Scope Coverage sheet. */
  coverage?: { requirement: string; room: string; lines: number; codes: string[]; titles: string[] }[];
  /** Rooms read from the plan, for the assumed-areas table. */
  planRooms?: { name: string; boqRoom: string; l: number; b: number; h: number; source: string }[];
}

/** Standard client-scope exclusions and disclaimers (professional BOQ, expected_BOQ Master sheet). */
const CLIENT_SCOPE = [
  "Electrical appliances & white goods",
  "Switches / switchboards & light fixtures / fancy / decorative lighting",
  "Tiles except kitchen dado / floor tiles",
  "Exterior paint",
  "Civil & structural changes",
  "Taxes & GST are applicable extra",
  "Electrical work on actuals after design finalisation — the amount quoted is an estimate",
  "Sink, fixtures and faucet supply",
  "Flooring work & tiling / stone work (unless specified above)",
];
const DISCLAIMERS = [
  "*This quotation includes design work (2Ds, working drawings / GFCs, elevations and 3Ds) & project management of items under the company's scope.",
  "*This quotation is based on preliminary discussions and approximate estimates; final quantities, specifications and rates may vary subject to actual site measurements, detailed design development and material selections.",
];

const BROWN = "FF5E3A1E";
const TAN = "FFE8D9CB";
const YELLOW = "FFFFF2CC";
const BLUE = "FFD9E2F3";
const GREEN = "FFE2EFDA";

const SPARE_ROWS = 2;
const FIRST = 7; // first Master BOQ data row
const LAST = 3000;

const ASSUMPTIONS: [string, string, string, string, string][] = [
  ["Modular Woodwork", "Carcass – prelam / HDHMR / BWR / BWP", "As per the carcass code selected on the line (Century / Action Tesa or equivalent)", "Standard material assumption", "18 mm unless design requires otherwise; BWR/BWP for wet areas."],
  ["Modular Woodwork", "Laminate / shutter finish", "Merino or equivalent; acrylic / PU where stated", "Standard material assumption", "Colour, texture and thickness to approved sample."],
  ["Modular Woodwork", "Hardware", "EBCO standard package; Hettich where stated", "Standard material assumption", "Special mechanisms, pull-outs and premium hardware are separate add-ons."],
  ["Modular Woodwork", "Measurement", "Finished cabinet elevation area", "sq ft", "Visible sides, extra depth and special add-ons are separate."],
  ["Tiles", "Wall / floor tiling", "Commercial / vitrified tile with adhesive, grout and installation", "sq ft", "Upgraded tile or non-standard pattern is separate."],
  ["Stone & Countertops", "Granite / quartz supply", "20 mm slab", "sq ft of slab", "Allow 7–12% additional slab wastage; fabrication, cut-outs and edges are separate."],
  ["Plumbing", "Internal supply / drainage", "CPVC (Astral) / PVC (Prince) or equivalent", "Project-specific rate", "Include only approved points and testing."],
  ["Electrical & AC", "Wiring & conduit", "FRLS copper wiring, concealed PVC conduit", "Project-specific rate", "Switchboards, fixtures and appliances are separate unless the line says supply."],
  ["Ceiling", "Gypsum false ceiling", "Gypsum board on GI framework", "Project-specific rate", "Design-specific drops and profiles are extra; confirm lighting scope."],
  ["Paint & Polish", "Wall paint", "Asian Paints, Berger or equivalent", "Project-specific rate", "Fresh paint and repaint have different preparation."],
  ["Windows & Doors", "uPVC windows", "Approved uPVC profile with clear glass", "Project-specific rate", "Mesh, Georgian bars and grills are separate selections."],
  ["General Commercial", "Rate status", "InnerSpacio selling rate", "All units", "Edit the yellow Rate cell where the approved project rate differs."],
  ["General Commercial", "GST", "Confirm applicability in client commercial terms", "All units", "Do not add GST twice where the approved rate already includes it."],
  ["General Commercial", "Measurement & wastage", "Finished visible / billing area unless stated", "All units", "Quantities from standard room sizes must be replaced with site measurements."],
];

const fill = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

function header(row: ExcelJS.Row, from: number, to: number) {
  for (let c = from; c <= to; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = fill(BROWN);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
}

function band(ws: ExcelJS.Worksheet, row: number, lastCol: string, title: string, sub: string) {
  ws.mergeCells(`A${row}:${lastCol}${row}`);
  const t = ws.getCell(`A${row}`);
  t.value = title;
  t.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  t.fill = fill(BROWN);
  t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(row).height = 28;
  ws.mergeCells(`A${row + 1}:${lastCol}${row + 1}`);
  const s = ws.getCell(`A${row + 1}`);
  s.value = sub;
  s.font = { italic: true };
  s.fill = fill(TAN);
  s.alignment = { wrapText: true, vertical: "middle", indent: 1 };
  ws.getRow(row + 1).height = 24;
}

const MONEY = "#,##0.00";

export async function buildBoqWorkbook(opts: BoqSheetOptions): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "InnerSpacio AI Studio";
  wb.created = new Date();

  // Sheet order is the reference workbook's; fill them in any order below.
  const ins = wb.addWorksheet("Instructions");
  const ws = wb.addWorksheet("Master BOQ", { views: [{ state: "frozen", ySplit: 6 }] });
  const tradeSheet = wb.addWorksheet("Trade Summary");
  const roomSheet = wb.addWorksheet("Room Summary");
  const lists = wb.addWorksheet("Lists");

  // ---- Instructions ----
  ins.columns = [{ width: 26 }, { width: 100 }];
  band(
    ins,
    1,
    "B",
    "How to Use This BOQ",
    opts.specification ? `Prepared on the ${opts.specification}.` : "Indicative BOQ prepared by InnerSpacio."
  );
  ins.getRow(5).values = ["Step", "Use"];
  header(ins.getRow(5), 1, 2);
  [
    ["1. Start with a room", "Each room is a section. Change the Room dropdown if a line is reassigned."],
    ["2. Select the trade", "Choose from the frozen BOQ trade list."],
    ["3. Enter the scope", "Add the line item, detailed BOQ description and unit of measurement."],
    ["4. Enter measurements", "Use Length, Breadth and Height when relevant. Enter the measured billing quantity in Quantity."],
    ["5. Check the rate", "Rates are prefilled from the InnerSpacio rate card. Type the approved project rate over it if different. Amount calculates automatically."],
    ["6. Review totals", "Trade-wise and Room-wise costing update from the final Amount column."],
  ].forEach((r, i) => {
    ins.getRow(6 + i).values = r;
  });

  // ---- Lists ----
  lists.columns = [{ width: 42 }, { width: 28 }, { width: 38 }, { width: 4 }, { width: 14 }];
  band(lists, 1, "E", "Lists", "Standard BOQ labels. The Trade dropdown in Master BOQ uses this frozen list.");
  lists.getRow(5).values = ["Trade list", "Room list", "Standard BOQ Items", "", "Unit of Measurement"];
  header(lists.getRow(5), 1, 5);
  BOQ_TRADES.forEach((v, i) => (lists.getCell(6 + i, 1).value = v));
  BOQ_ROOMS.forEach((v, i) => (lists.getCell(6 + i, 2).value = v));
  BOQ_ITEMS.forEach((v, i) => (lists.getCell(6 + i, 3).value = v));
  BOQ_UOMS.forEach((v, i) => (lists.getCell(6 + i, 5).value = v));
  const rng = (col: string, n: number) => `Lists!$${col}$6:$${col}$${5 + n}`;

  // ---- Master BOQ ----
  const compare = opts.sheet === "both";
  ws.columns = [
    { width: 24 }, { width: 30 }, { width: 40 }, { width: 62 }, { width: 8 },
    { width: 8 }, { width: 8 }, { width: 8 }, { width: 11 }, { width: 12 }, { width: 15 },
    { width: 26 }, { width: 16 },
  ];
  ws.mergeCells("A1:K1");
  const title = ws.getCell("A1");
  title.value = "InnerSpacio — Bill of Quantities";
  title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  title.fill = fill(BROWN);
  title.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 34;
  ws.mergeCells("A2:K2");
  ws.getCell("A2").value =
    "Enter scope, measurements and rate in the yellow cells. Amount calculates as Quantity × Rate. Trade labels are fixed in the dropdown list.";
  ws.getCell("A2").font = { italic: true };
  ws.getCell("A2").fill = fill(TAN);
  ws.getCell("A3").value = `Rates: ${RATE_SHEET_LABEL[opts.sheet ?? "spazay"]}   ·   Prepared by: ${opts.preparedBy || "InnerSpacio"}`;
  ws.getCell("A3").font = { italic: true };
  ws.getCell("A4").value = `Project / Client: ${opts.client || "______________________"}`;
  ws.getCell("D4").value = `Project location: ${opts.location || "______________________"}`;
  ws.getCell("I4").value = `Date: ${opts.date || new Date().toISOString().slice(0, 10)}`;
  ws.mergeCells("F5:H5");
  ws.getCell("F5").value = "Measurements";
  header(ws.getRow(5), 6, 8);
  ws.getRow(6).values = ["Room", "Trade", "Line / BOQ Item", "Description", "UOM", "L", "B", "H", "Quantity", "Rate (₹)", "Amount (₹)"];
  ws.getCell("L6").value = "Rate basis";
  if (compare) ws.getCell("M6").value = "Livspace ref (₹)";
  header(ws.getRow(6), 1, compare ? 13 : 12);

  const rooms: string[] = [...BOQ_ROOMS.filter((r) => opts.lines.some((l) => l.room === r))];
  for (const l of opts.lines) if (!rooms.includes(l.room)) rooms.push(l.room);

  let row = FIRST;
  const trades = new Map<string, number>();
  const roomTotals = new Map<string, number>();

  const dv = (r: number, col: string, ref: string) => {
    ws.getCell(`${col}${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [ref], showErrorMessage: false };
  };

  for (const room of rooms) {
    const sec = ws.getRow(row);
    sec.getCell(1).value = room;
    for (let c = 1; c <= 11; c++) {
      sec.getCell(c).fill = fill(BLUE);
      sec.getCell(c).font = { bold: true };
    }
    row++;
    const mine = opts.lines.filter((l) => l.room === room);
    const total = mine.length + SPARE_ROWS;
    for (let i = 0; i < total; i++, row++) {
      const l = mine[i];
      const r = ws.getRow(row);
      r.getCell(1).value = room;
      let amount = 0;
      if (l) {
        r.getCell(2).value = l.trade;
        r.getCell(3).value = l.title || l.item;
        r.getCell(4).value = l.description;
        r.getCell(5).value = l.uom;
        if (l.l) r.getCell(6).value = l.l;
        if (l.b) r.getCell(7).value = l.b;
        if (l.h) r.getCell(8).value = l.h;
        r.getCell(9).value = l.qty;
        r.getCell(10).value = l.rate;
        r.getCell(12).value = l.provisional
          ? "Provisional allowance — confirm"
          : l.rateSource === "livspace"
            ? "Livspace NCR MRC"
            : "Spazay";
        if (l.provisional) r.getCell(10).fill = fill("FFF8CBAD");
        if (compare && l.altRate) {
          r.getCell(13).value = l.altRate;
          r.getCell(13).numFmt = MONEY;
        }
        amount = Math.round(l.qty * l.rate * 100) / 100;
        trades.set(l.trade, (trades.get(l.trade) ?? 0) + amount);
        roomTotals.set(room, (roomTotals.get(room) ?? 0) + amount);
      }
      r.getCell(11).value = { formula: `I${row}*J${row}`, result: amount };
      for (let c = 1; c <= 10; c++) r.getCell(c).fill = fill(YELLOW);
      r.getCell(4).alignment = { wrapText: true, vertical: "top" };
      r.getCell(9).numFmt = "0.00";
      r.getCell(10).numFmt = MONEY;
      r.getCell(11).numFmt = MONEY;
      dv(row, "A", rng("B", BOQ_ROOMS.length));
      dv(row, "B", rng("A", BOQ_TRADES.length));
      dv(row, "C", rng("C", BOQ_ITEMS.length));
      dv(row, "E", rng("E", BOQ_UOMS.length));
    }
  }

  // ---- Grand total, client scope, disclaimers ----
  const lastData = row - 1;
  ws.getCell(`A${row}`).value = "Grand Total";
  ws.getCell(`K${row}`).value = { formula: `SUM(K${FIRST}:K${lastData})`, result: [...trades.values()].reduce((a, b) => a + b, 0) };
  ws.getCell(`K${row}`).numFmt = MONEY;
  header(ws.getRow(row), 1, 11);
  row += 2;
  ws.getCell(`D${row}`).value = "Client scope (i.e. excluded from the scope of this estimate)";
  ws.getCell(`D${row}`).font = { bold: true };
  row++;
  for (const t of CLIENT_SCOPE) ws.getCell(`D${row++}`).value = t;
  row++;
  for (const t of DISCLAIMERS) {
    ws.mergeCells(`A${row}:K${row}`);
    ws.getCell(`A${row}`).value = t;
    ws.getCell(`A${row}`).alignment = { wrapText: true, vertical: "top" };
    ws.getRow(row).height = 32;
    row++;
  }

  const sumRange = (col: string) => `'Master BOQ'!$${col}$${FIRST}:$${col}$${LAST}`;
  const grand = [...trades.values()].reduce((a, b) => a + b, 0);

  function summary(s: ExcelJS.Worksheet, heading: string, sub: string, label: string, keys: readonly string[], col: "A" | "B", totals: Map<string, number>) {
    s.columns = [{ width: 46 }, { width: 20 }];
    band(s, 1, "B", heading, sub);
    s.getRow(5).values = [label, "Amount (₹)"];
    header(s.getRow(5), 1, 2);
    keys.forEach((k, i) => {
      const r = 6 + i;
      s.getCell(r, 1).value = k;
      s.getCell(r, 2).value = { formula: `SUMIF(${sumRange(col)},A${r},${sumRange("K")})`, result: totals.get(k) ?? 0 };
      s.getCell(r, 2).numFmt = MONEY;
      s.getCell(r, 2).fill = fill(GREEN);
    });
    const end = 5 + keys.length;
    s.getCell(end + 2, 1).value = "Grand Total";
    s.getCell(end + 2, 2).value = { formula: `SUM(B6:B${end})`, result: grand };
    s.getCell(end + 2, 2).numFmt = MONEY;
    header(s.getRow(end + 2), 1, 2);
  }

  summary(tradeSheet, "Trade-wise Costing", "Automatically totals the Master BOQ amount by the selected trade.", "Trade", BOQ_TRADES, "B", trades);
  summary(roomSheet, "Room-wise Costing", "Automatically totals the Master BOQ amount by room or project area.", "Room / Area", BOQ_ROOMS, "A", roomTotals);

  // ---- General Assumptions ----
  const ga = wb.addWorksheet("General Assumptions");
  ga.columns = [{ width: 22 }, { width: 34 }, { width: 58 }, { width: 26 }, { width: 70 }];
  band(
    ga,
    1,
    "E",
    "General Assumptions",
    "Standard specifications when starting a project estimate. Replace any allowance with the approved sample, drawing or project-specific quote before issue."
  );
  ga.getRow(5).values = ["Category", "Item / Base Assumption", "Standard Brand / Specification", "Unit", "Estimator Notes"];
  header(ga.getRow(5), 1, 5);
  ASSUMPTIONS.forEach((a, i) => {
    const r = ga.getRow(6 + i);
    r.values = [...a];
    for (let c = 1; c <= 5; c++) r.getCell(c).alignment = { wrapText: true, vertical: "top" };
  });

  // ---- Scope Coverage ----
  if (opts.coverage?.length || opts.planRooms?.length) {
    const sc = wb.addWorksheet("Scope Coverage");
    sc.columns = [{ width: 44 }, { width: 70 }, { width: 24 }, { width: 30 }];
    band(
      sc,
      1,
      "D",
      "Scope Coverage",
      "Every point in the brief is mapped to the BOQ lines that price it. Quantities rest on the assumed areas below and must be confirmed on site before work order."
    );
    sc.getRow(5).values = ["Brief point", "What is covered in this BOQ", "Room section", "Rate codes used"];
    header(sc.getRow(5), 1, 4);
    let r = 6;
    for (const c of opts.coverage ?? []) {
      sc.getRow(r).values = [
        c.requirement,
        c.lines > 0 ? c.titles.join("; ") : "NOT PRICED — add a line or confirm it is out of scope.",
        c.room,
        c.codes.join(", "),
      ];
      for (let k = 1; k <= 4; k++) sc.getRow(r).getCell(k).alignment = { wrapText: true, vertical: "top" };
      if (c.lines === 0) sc.getRow(r).getCell(2).fill = fill("FFF8CBAD");
      r++;
    }
    const prov = opts.lines.filter((l) => l.provisional);
    if (prov.length) {
      r++;
      sc.mergeCells(`A${r}:D${r}`);
      sc.getCell(`A${r}`).value = `${prov.length} line(s) are provisional allowances with no rate in the reference list — ${prov
        .map((l) => l.title || l.item)
        .join("; ")}. Confirm each against the approved selection or a vendor quote before issue.`;
      sc.getCell(`A${r}`).alignment = { wrapText: true, vertical: "top" };
      sc.getRow(r).height = 48;
      r++;
    }
    if (opts.planRooms?.length) {
      r += 1;
      sc.getRow(r).values = ["Assumed areas used for quantities", "Assumption", "Basis", "Status"];
      header(sc.getRow(r), 1, 4);
      r++;
      for (const p of opts.planRooms) {
        sc.getRow(r).values = [
          p.name,
          `${p.l} ft × ${p.b} ft = ${Math.round(p.l * p.b)} sq ft, ceiling ${p.h} ft`,
          p.source === "labelled" ? "Dimensions written on the plan" : p.source === "scaled" ? "Scaled from the plan" : "Typical size assumed",
          p.source === "labelled" ? "Per plan — verify" : "Confirm on site",
        ];
        r++;
      }
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
