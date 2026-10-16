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
  remarks?: string;
  /** Area label from the client plan (Area column); falls back to the room. */
  area?: string;
  rateSource?: "spazay" | "livspace";
  /** Livspace reference rate (compare mode). */
  altRate?: number | null;
  provisional?: boolean;
  /** A rate to review (e.g. no verified Livspace equivalent). */
  rateNote?: string;
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

/** Professional design & project inclusions (professional BOQ, boq_sample2). */
const INCLUSIONS = [
  "Interior design, space planning and design development as per the approved scope.",
  "Material, finish, colour and fixture selection assistance.",
  "3D visualisations / renders for the identified key spaces.",
  "2Ds and GFC (Good for Construction) drawings: furniture layouts, modular details, wall-panelling details, ceiling / lighting intent and site-execution drawings.",
  "BOQ preparation, scope coordination and design-based cost planning.",
  "Project management, vendor coordination and periodic site supervision during execution.",
  "Quality checks, snag-list preparation and follow-up for works within the approved scope.",
  "Final coordination and handover support, where included in the approved design scope.",
];
/** Site assessment, measurement-based conditions and exclusions. */
const CONDITIONS = [
  "All quantities are provisional and shall be remeasured at site after final design closure and confirmation of execution drawings. Final billing is on approved site measurements and actual executed quantities.",
  "Paint quantities and scope are provisional. Putty, primer, crack filling, POP punning, damp treatment, levelling, texture removal and wall repair are determined only after detailed inspection and are carried out only where necessary.",
  "Modular furniture quantities, depths, heights, shutter areas, visible sides, internal divisions, drawer counts, hardware, handles, fillers, end panels and cut-outs are finalised after site measurement and design closure.",
  "Rates for custom modular units are subject to final material selection (carcass, shutter finish, hardware brand, drawer systems, profile handles, glass, lighting). Add-ons such as pull-outs, corner units, appliance pockets and LED profiles are finalised post design.",
  "Countertop, quartz and granite quantities are based on final on-site templates after cabinetry is installed. Slab selection, wastage, joints, edge profiles, cut-outs, backsplash, transport and strengthening supports are confirmed separately.",
  "Wall panelling, wallpaper, WPC louvres, mirrors, PVD / metal inlays, POP mouldings and decorative lighting are subject to final wall measurements, substrate condition, approved sample and electrical-point availability. Additional framing, levelling or backing is charged separately.",
  "Mirror and glass quantities are based on final measurements after supporting surfaces are complete. Special shapes, bevels, tinting, profiles, LED lighting and non-standard hardware are excluded unless mentioned.",
  "Shower partitions are subject to final bathroom dimensions, tile levels, slope, fixing feasibility and hardware selection. Civil backing and waterproofing repairs are charged additionally.",
  "Bathroom vanity installation is subject to confirmation of plumbing points, drainage, wall condition and sanitaryware selection. Concealed plumbing modifications, wall repair, waterproofing and CP fittings are excluded unless specified.",
  "uPVC window, PVC ceiling, facade and glass-railing work is subject to final openings, levels, access, site conditions and structural feasibility. Scaffolding, civil repair, special glass / hardware and approvals are excluded unless specified.",
  "Deep cleaning covers normal post-work cleaning only. Permanent stains, paint overspray, cement residue, restoration and shifting of heavy furniture are assessed separately.",
  "Concealed defects, seepage, dampness, hollow tiles, damaged plaster, uneven walls / floors or unforeseen work found during execution are additional work after client approval.",
  "Any change in design, material, finish, brand, quantity, site condition or method after BOQ approval is a variation and charged separately.",
  "The quoted scope does not include statutory approvals, society permissions, external-agency charges, utility deposits, structural alterations or work not expressly included in the approved BOQ.",
];

const BROWN = "FF5E3A1E";
const TAN = "FFE8D9CB";
const YELLOW = "FFFFF2CC";
const BLUE = "FFD9E2F3";
const GREEN = "FFE2EFDA";

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
    { width: 24 }, { width: 40 }, { width: 24 }, { width: 16 },
  ];
  const LASTCOL = compare ? 15 : 14;
  ws.mergeCells("A1:K1");
  const title = ws.getCell("A1");
  title.value = "InnerSpacio — Bill of Quantities";
  title.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  title.fill = fill(BROWN);
  title.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 34;
  ws.mergeCells("A2:K2");
  ws.getCell("A2").value =
    "Every line is complete: room, trade, item, description, unit, quantity and rate. Amount = Quantity × Rate; edit the yellow cells to revise.";
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
  ws.getRow(6).values = ["Room", "Trade", "Line / BOQ Item", "Description", "UOM", "L", "B", "H", "Quantity", "Rate (₹)", "Amount (₹)", "Area (per plan)", "Remarks / assumptions", "Rate basis"];
  if (compare) ws.getCell("O6").value = "Livspace ref (₹)";
  header(ws.getRow(6), 1, LASTCOL);

  const isLoose = (l: BoqSheetLine) => l.trade === "Loose Furniture";
  const allRooms: string[] = [...BOQ_ROOMS.filter((r) => opts.lines.some((l) => l.room === r))];
  for (const l of opts.lines) if (!allRooms.includes(l.room)) allRooms.push(l.room);

  let row = FIRST;
  const trades = new Map<string, number>();
  const roomTotals = new Map<string, number>();
  const subtotalCells: string[] = [];

  const dv = (r: number, col: string, ref: string) => {
    ws.getCell(`${col}${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [ref], showErrorMessage: false };
  };

  /** One costing annexure: room sections of fully-populated lines, then a subtotal. */
  const annexure = (heading: string, pick: (l: BoqSheetLine) => boolean) => {
    const lines = opts.lines.filter(pick);
    if (!lines.length) return;
    ws.mergeCells(`A${row}:K${row}`);
    const h = ws.getCell(`A${row}`);
    h.value = heading;
    h.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    h.fill = fill(BROWN);
    row++;
    const first = row;
    for (const room of allRooms) {
      const mine = lines.filter((l) => l.room === room);
      if (!mine.length) continue;
      const sec = ws.getRow(row);
      sec.getCell(1).value = room;
      sec.getCell(4).value = `${mine.length} line item${mine.length === 1 ? "" : "s"}`;
      for (let c = 1; c <= 11; c++) {
        sec.getCell(c).fill = fill(BLUE);
        sec.getCell(c).font = { bold: true };
      }
      row++;
      for (const l of mine) {
        const r = ws.getRow(row);
        r.getCell(1).value = room;
        r.getCell(2).value = l.trade;
        r.getCell(3).value = l.title || l.item;
        r.getCell(4).value = l.description;
        r.getCell(5).value = l.uom;
        if (l.l) r.getCell(6).value = l.l;
        if (l.b) r.getCell(7).value = l.b;
        if (l.h) r.getCell(8).value = l.h;
        r.getCell(9).value = l.qty;
        r.getCell(10).value = l.rate;
        r.getCell(12).value = l.area || room;
        if (l.remarks) r.getCell(13).value = l.remarks;
        r.getCell(14).value = l.provisional
          ? "Provisional allowance — confirm"
          : l.rateSource === "livspace"
            ? "Livspace NCR MRC"
            : "Spazay";
        if (l.provisional) r.getCell(10).fill = fill("FFF8CBAD");
        if (compare && l.altRate) {
          r.getCell(15).value = l.altRate;
          r.getCell(15).numFmt = MONEY;
        }
        const amount = Math.round(l.qty * l.rate * 100) / 100;
        trades.set(l.trade, (trades.get(l.trade) ?? 0) + amount);
        roomTotals.set(room, (roomTotals.get(room) ?? 0) + amount);
        r.getCell(11).value = { formula: `I${row}*J${row}`, result: amount };
        for (let c = 1; c <= 10; c++) r.getCell(c).fill = fill(YELLOW);
        for (const c of [3, 4, 12, 13]) r.getCell(c).alignment = { wrapText: true, vertical: "top" };
        r.getCell(9).numFmt = "0.00";
        r.getCell(10).numFmt = MONEY;
        r.getCell(11).numFmt = MONEY;
        dv(row, "A", rng("B", BOQ_ROOMS.length));
        dv(row, "B", rng("A", BOQ_TRADES.length));
        dv(row, "E", rng("E", BOQ_UOMS.length));
        row++;
      }
    }
    const sub = lines.reduce((n, l) => n + Math.round(l.qty * l.rate * 100) / 100, 0);
    ws.getCell(`D${row}`).value = `Subtotal — ${heading}`;
    ws.getCell(`K${row}`).value = { formula: `SUM(K${first}:K${row - 1})`, result: sub };
    ws.getCell(`K${row}`).numFmt = MONEY;
    for (let c = 1; c <= 11; c++) ws.getRow(row).getCell(c).font = { bold: true };
    subtotalCells.push(`K${row}`);
    row += 2;
  };

  annexure("COSTING ANNEXURE A (FIXED & MODULAR)", (l) => !isLoose(l));
  annexure("COSTING ANNEXURE B (LOOSE FURNITURE)", isLoose);

  // ---- Grand total, client scope, disclaimers ----
  const grand = [...trades.values()].reduce((a, b) => a + b, 0);
  ws.getCell(`A${row}`).value = "Grand Total";
  ws.getCell(`K${row}`).value = { formula: subtotalCells.length ? subtotalCells.join("+") : "0", result: grand };
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

  // ---- Terms & Conditions ----
  const tc = wb.addWorksheet("Terms & Conditions");
  tc.columns = [{ width: 6 }, { width: 130 }];
  band(tc, 1, "B", "Terms & Conditions", "Provisional estimate: subject to site assessment, detailed measurement and design closure.");
  let t = 5;
  const block = (heading: string, items: string[], numbered: boolean) => {
    tc.getRow(t).values = ["", heading];
    header(tc.getRow(t), 1, 2);
    t++;
    items.forEach((x, i) => {
      tc.getRow(t).values = [numbered ? i + 1 : "•", x];
      tc.getRow(t).getCell(2).alignment = { wrapText: true, vertical: "top" };
      t++;
    });
    t++;
  };
  block("Professional design & project inclusions", INCLUSIONS, false);
  block("Site assessment, measurement-based conditions & exclusions", CONDITIONS, true);
  block("Client scope (excluded from this estimate)", CLIENT_SCOPE, false);

  // ---- Scope Coverage ----
  if (opts.coverage?.length || opts.planRooms?.length || opts.lines.some((l) => l.rateNote)) {
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
    const flagged = opts.lines.filter((l) => l.rateNote);
    if (flagged.length) {
      sc.mergeCells(`A${r}:D${r}`);
      sc.getCell(`A${r}`).value = `${flagged.length} line(s) have no verified rate on the selected sheet and are billed at the Spazay card rate — ${flagged
        .map((l) => l.title || l.item)
        .join("; ")}. Review before issue.`;
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
