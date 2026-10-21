import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { normalizeScope } from "@/lib/ai/boq-brief";
import { briefResponse } from "@/lib/boq/brief-response";
import { quantify, type BriefItem } from "@/lib/boq/brief";
import { CLEO_ROOMS } from "@/lib/boq/fixtures/cleo-county";
import { printModel } from "@/lib/boq/print";
import { diffRevisions } from "@/lib/boq/revisions";
import { RepositoryError } from "@/lib/data/types";

// In-memory stand-in for the repository + a signed-in user: the real route handlers run against it.
const store = new Map<string, { id: string; projectId: string; title: string; tier: string; city: string; sheet: string; total: number; payload: unknown; updatedAt: string; createdAt: string }>();
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => ({ id: "designer-1" }) }));
vi.mock("@/lib/data", () => ({
  getRepository: async () => ({
    getBoq: async (_p: string, id: string) => store.get(id) ?? null,
    saveBoq: async (projectId: string, input: { id?: string; payload: unknown; total: number; title: string; tier: string; city: string; sheet: string }) => {
      if (input.id && !store.has(input.id)) throw new RepositoryError("nf", "not_found");
      const id = input.id ?? `boq-${store.size + 1}`;
      const rec = { ...input, id, projectId, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() };
      store.set(id, rec);
      return rec;
    },
  }),
}));

const { POST: save } = await import("@/app/api/boq/save/route");
const { POST: exportBoq } = await import("@/app/api/boq/export/route");
const post = (body: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const NextReq = (body: unknown) => post(body) as never;

// What the AI step would return for a realistic 3BHK renovation (mocked: no paid call).
const U = (room: string, requirement: string, o: Record<string, unknown> = {}) => ({ room, requirement, kind: "rate", basis: "area", ...o });
const RAW = {
  rooms: CLEO_ROOMS,
  items: [
    U("Kitchen", "modular kitchen — complete renovation", { unit: "kitchen_cabinetry", basis: "elevation", status: "NEW" }),
    U("Kitchen", "countertop", { unit: "quartz_counter", status: "NEW" }),
    U("Kitchen", "necessary civil modifications", { rateId: "cv:CV13", basis: "floor_area", status: "UNCONFIRMED" }),
    U("Kitchen", "new electrical points 6 nos", { rateId: "el:EL02", count: 6, status: "NEW" }),
    U("Guest / Parents Bedroom", "replace wardrobe shutters 6 ft x 8 ft", { rateId: "mod:S04", basis: "elevation", width: 6, height: 8, status: "REPLACE" }),
    U("Guest / Parents Bedroom", "full flooring replacement", { rateId: "cv:CV04", basis: "floor_area", status: "NEW" }),
    U("Master Bedroom", "existing bed retained", { rateId: "lf:LFE08", count: 1, status: "RETAIN" }),
    U("Master Bedroom", "bed upholstery refresh 6 ft x 4 ft", { rateId: "wp:WP32", basis: "elevation", width: 6, height: 4, status: "REFURBISH" }),
    U("Master Bedroom", "full flooring replacement", { rateId: "cv:CV04", basis: "floor_area", status: "NEW" }),
    U("Master Bathroom", "wall tiling", { rateId: "cv:CV03", basis: "wall_area", status: "NEW" }),
    U("Master Bathroom", "floor tiling", { rateId: "cv:CV04", basis: "floor_area", status: "NEW" }),
    U("Master Bathroom", "vanity with new countertop", { unit: "vanity", basis: "count", status: "NEW" }),
    U("Master Bathroom", "existing plumbing infrastructure retained", { rateId: "cv:CV12", basis: "floor_area", status: "RETAIN" }),
    U("Master Bathroom", "existing shower partition retained", { unit: "shower_partition", status: "RETAIN" }),
    U("Kids Bathroom", "wall tiling", { rateId: "cv:CV03", basis: "wall_area", status: "NEW" }),
    U("Kids Bathroom", "vanity with new countertop", { unit: "vanity", basis: "count", status: "NEW" }),
    U("Kids Bathroom", "new shower partition", { unit: "shower_partition", status: "NEW" }),
    U("Kids Bathroom", "existing plumbing retained", { rateId: "cv:CV12", basis: "floor_area", status: "RETAIN" }),
    U("Dining", "dining table", { rateId: "lf:LFE06", count: 1, status: "EXCLUDED" }),
    U("Dining", "bar cabinet", { unit: "crockery_unit", status: "NEW" }),
    U("Others / Whole Home Civil", "electrical modifications 12 points", { rateId: "el:EL02", count: 12, status: "NEW" }),
    U("Living", "mystery work", { rateId: "zz:NOPE", count: 1, status: "NEW" }),
  ],
  assumptions: [],
  unpriced: [],
  questions: ["Which civil modifications are needed in the kitchen?"],
};

const scope = normalizeScope(RAW);
const res = briefResponse(scope, "premium", "Noida");
const titles = (room: string) => res.lines.filter((l) => l.room === room).map((l) => (l.title ?? l.item).toLowerCase());

describe("scope is exactly what the brief asks for (before any total)", () => {
  it("the AI output validates and keeps every status", () => {
    expect(scope.items).toHaveLength(RAW.items.length);
    expect(scope.dropped).toEqual([]);
    expect(scope.items.filter((i) => i.status === "RETAIN")).toHaveLength(4);
  });
  it("dining: the table is excluded, only the bar cabinet is priced", () => {
    expect(titles("Dining").some((t) => t.includes("dining table"))).toBe(false);
    expect(titles("Dining")).toHaveLength(1);
  });
  it("master bedroom: the bed is retained, only the upholstery refresh is priced", () => {
    const l = res.lines.filter((x) => x.room === "Master Bedroom");
    expect(l.some((x) => x.rateId === "lf:LFE08")).toBe(false);
    expect(l.find((x) => x.rateId === "wp:WP32")).toMatchObject({ scopeStatus: "REFURBISH", qty: 24 });
  });
  it("guest bedroom: shutters only (no carcass, no new all-in wardrobe)", () => {
    const l = res.lines.filter((x) => x.room === "Guest / Parents Bedroom" && x.trade === "Modular Woodwork");
    expect(l.map((x) => x.code)).toEqual(["S04"]);
  });
  it("bathrooms: retained plumbing and the retained master shower are not charged; the new common shower is", () => {
    expect(res.lines.some((l) => l.trade === "Plumbing")).toBe(false);
    expect(titles("Master Bathroom").some((t) => t.includes("shower"))).toBe(false);
    expect(titles("Kids Bathroom").filter((t) => t.includes("shower"))).toHaveLength(1);
  });
  it("kitchen: civil modifications are UNCONFIRMED and held, not guessed", () => {
    expect(titles("Kitchen").some((t) => t.includes("civil") || t.includes("repair"))).toBe(false);
    expect(res.warnings.join("|")).toMatch(/UNCONFIRMED/);
  });
  it("a missing rate is reported, never silently priced", () => {
    expect(res.lines.some((l) => l.rateId === "zz:NOPE")).toBe(false);
    expect(res.warnings.join("|")).toMatch(/unknown rate item/i);
  });
  it("electrical is priced only where specified (6 + 12 points)", () => {
    const pts = res.lines.filter((l) => l.rateId === "el:EL02").reduce((n, l) => n + l.qty, 0);
    expect(pts).toBe(18);
  });
});

describe("workflow over the real API handlers", () => {
  beforeEach(() => store.clear());
  const body = (o: Record<string, unknown> = {}) => ({
    projectId: "p1", title: "Cleo — BOQ", tier: "premium", city: "Noida", client: "Karan", location: "Noida",
    lines: res.lines, scope: { approved: true, items: scope.items.map((i) => (i.status === "UNCONFIRMED" ? { ...i, status: "NEW" } : i)) }, ...o,
  });

  it("invalid input is rejected with 400, an unknown BOQ is 404", async () => {
    expect((await save(NextReq({ nope: 1 }))).status).toBe(400);
    expect((await save(NextReq(body({ boqId: "missing" })))).status).toBe(404);
  });

  it("export is blocked while the scope is unapproved or has UNCONFIRMED items", async () => {
    expect((await exportBoq(post({ lines: res.lines, scope: { approved: false, items: scope.items } }))).status).toBe(409);
    expect((await exportBoq(post({ lines: res.lines, scope: { approved: true, items: scope.items } }))).status).toBe(409); // still has UNCONFIRMED
  });

  it("save → approve → export → edit keeps the approved revision, and every total agrees", async () => {
    const draft = await (await save(NextReq(body()))).json();
    expect(draft).toMatchObject({ revision: 1, status: "review" });

    // approving needs an approved, fully confirmed scope
    const refused = await save(NextReq(body({ boqId: draft.id, scope: { approved: false, items: [] }, finalApprove: true })));
    expect(refused.status).toBe(409);

    const approved = await (await save(NextReq(body({ boqId: draft.id, finalApprove: true })))).json();
    expect(approved).toMatchObject({ revision: 1, status: "approved" });
    expect(approved.finalApproved).toMatchObject({ by: "designer-1" });

    // export (xlsx) of the approved BOQ reconciles to the saved total
    const out = await exportBoq(post({ lines: res.lines, scope: { approved: true, items: body().scope.items }, specification: "Premium · Rev 1 · APPROVED" }));
    expect(out.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await out.arrayBuffer()) as ArrayBuffer);
    let sheetTotal = 0;
    wb.getWorksheet("Master BOQ")!.eachRow((row) => {
      const v = row.getCell(11).value as ExcelJS.CellFormulaValue | null;
      if (v && typeof v === "object" && "formula" in v && /^I\d+\*J\d+$/.test(v.formula)) sheetTotal += Number(v.result ?? 0);
    });
    const lineTotal = res.lines.reduce((n, l) => n + l.qty * l.rate, 0);
    expect(Math.abs(sheetTotal - lineTotal)).toBeLessThan(1);
    expect(Math.abs(approved.total - lineTotal)).toBeLessThan(1);
    expect(Math.abs(res.summary.total - lineTotal)).toBeLessThan(1);

    // editing the approved BOQ archives it and reopens a draft
    const edited = body({ boqId: draft.id, lines: res.lines.map((l, i) => (i === 0 ? { ...l, qty: l.qty + 10 } : l)), finalApprove: true });
    const next = await (await save(NextReq(edited))).json();
    expect(next).toMatchObject({ revision: 2, status: "revised", finalApproved: null });
    expect(next.revisions).toHaveLength(1);
    expect(next.revisions[0]).toMatchObject({ n: 1 });
    const d = diffRevisions(next.revisions[0], { lines: edited.lines });
    expect(d.changed).toHaveLength(1);
    expect(d.delta).toBeCloseTo(10 * res.lines[0].rate, 1);

    // the printable BOQ is derived from the saved payload and matches it
    const saved = store.get(draft.id)!;
    const pm = printModel(saved.payload as never, { title: saved.title, project: "Cleo", location: "Noida", tier: "Premium", updatedAt: saved.updatedAt });
    expect(Math.abs(pm.total - saved.total)).toBeLessThan(1);
    expect(pm.revision).toBe(2);
    expect(pm.excluded).toHaveLength(1);
    expect(pm.retained.length).toBeGreaterThanOrEqual(3);
  });

  it("a failed AI result (no scope) never produces an approvable BOQ", () => {
    const empty = briefResponse({ rooms: CLEO_ROOMS, items: [], assumptions: [], unpriced: [], questions: [], dropped: [] }, "premium", "Noida");
    expect(empty.lines).toHaveLength(0);
    expect(empty.summary.total).toBe(0);
  });

  it("editing the scope re-prices through the deterministic engine (no AI)", () => {
    const edited: BriefItem[] = scope.items.map((i) => (i.requirement.startsWith("replace wardrobe shutters") ? { ...i, width: 8, sizeBy: "designer" as const } : i));
    const before = res.lines.find((l) => l.code === "S04")!;
    const after = quantify(edited, CLEO_ROOMS, { tier: "premium", city: "Noida" }).lines.find((l) => l.code === "S04")!;
    expect(after.qty).toBeGreaterThan(before.qty);
  });
});
