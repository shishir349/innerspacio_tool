import { describe, expect, it } from "vitest";
import { boqStatus, diffRevisions, prepareSave, MAX_REVISIONS, type StoredPayload } from "@/lib/boq/revisions";

const line = (o: Record<string, unknown> = {}) => ({ room: "Living", trade: "Wall Panelling", item: "Panel", title: "Feature wall", uom: "Sq.Ft.", qty: 72, rate: 1012, ...o });
const incoming = (o: Record<string, unknown> = {}) => ({ lines: [line()], scope: { approved: true, items: [] as { status?: string }[] }, ...o });
const NOW = "2026-10-19T12:00:00.000Z";
const by = "u1";

describe("lifecycle status", () => {
  it("draft until the scope is approved, review until the estimate is, then approved / revised", () => {
    expect(boqStatus({ lines: [line()] } as StoredPayload)).toBe("draft");
    expect(boqStatus({ lines: [line()], scope: { approved: false, items: [] } } as StoredPayload)).toBe("draft");
    expect(boqStatus({ lines: [line()], scope: { approved: true, items: [] } } as StoredPayload)).toBe("review");
    expect(boqStatus({ lines: [line()], scope: { approved: true, items: [] }, finalApproved: { at: NOW, by } } as StoredPayload)).toBe("approved");
    expect(boqStatus({ lines: [line()], revision: 2 } as StoredPayload)).toBe("revised");
  });
});

describe("prepareSave", () => {
  it("a first save is revision 1; approving stamps who and when", () => {
    const p = prepareSave(undefined, incoming({ finalApprove: true }) as never, { now: NOW, userId: by });
    expect(p.revision).toBe(1);
    expect(p.finalApproved).toMatchObject({ at: NOW, by });
    expect(p.revisions).toEqual([]);
  });

  it("approval is refused while the scope is unapproved or has UNCONFIRMED items", () => {
    expect(() => prepareSave(undefined, incoming({ scope: { approved: false, items: [] }, finalApprove: true }) as never, { now: NOW, userId: by })).toThrow(/scope/i);
    expect(() => prepareSave(undefined, incoming({ scope: { approved: true, items: [{ status: "UNCONFIRMED" }] }, finalApprove: true }) as never, { now: NOW, userId: by })).toThrow(/UNCONFIRMED/);
  });

  it("editing an APPROVED BOQ keeps the approved version as an immutable revision and reopens as a draft", () => {
    const approved = prepareSave(undefined, incoming({ finalApprove: true }) as never, { now: NOW, userId: by });
    const edited = prepareSave(approved as StoredPayload, incoming({ lines: [line({ qty: 80 })], finalApprove: true }) as never, { now: "2026-10-20T00:00:00.000Z", userId: by });
    expect(edited.revision).toBe(2);
    expect(edited.finalApproved).toBeUndefined(); // a client cannot approve and edit in one step
    expect(edited.revisions).toHaveLength(1);
    expect(edited.revisions![0]).toMatchObject({ n: 1, total: 72 * 1012, approvedAt: NOW });
    expect(boqStatus(edited)).toBe("revised");
  });

  it("an identical re-save of an approved BOQ changes nothing", () => {
    const approved = prepareSave(undefined, incoming({ finalApprove: true }) as never, { now: NOW, userId: by });
    const again = prepareSave(approved as StoredPayload, incoming() as never, { now: "2026-10-21T00:00:00.000Z", userId: by });
    expect(again.revision).toBe(1);
    expect(again.finalApproved).toMatchObject({ at: NOW });
    expect(again.revisions).toEqual([]);
  });

  it("editing an unapproved draft does not create revisions", () => {
    const draft = prepareSave(undefined, incoming({ scope: { approved: false, items: [] } }) as never, { now: NOW, userId: by });
    const next = prepareSave(draft as StoredPayload, incoming({ scope: { approved: false, items: [] }, lines: [line({ qty: 1 })] }) as never, { now: NOW, userId: by });
    expect(next.revision).toBe(1);
    expect(next.revisions).toEqual([]);
  });

  it("the client cannot forge revision numbers or history", () => {
    const p = prepareSave(undefined, incoming({ revision: 9, revisions: [{ n: 1 }], finalApproved: { at: "x", by: "y" } }) as never, { now: NOW, userId: by });
    expect(p.revision).toBe(1);
    expect(p.revisions).toEqual([]);
    expect(p.finalApproved).toBeUndefined();
  });

  it(`keeps at most ${MAX_REVISIONS} revisions, newest last`, () => {
    let p = prepareSave(undefined, incoming({ finalApprove: true }) as never, { now: NOW, userId: by }) as StoredPayload;
    for (let i = 0; i < MAX_REVISIONS + 3; i++) {
      p = prepareSave(p, incoming({ lines: [line({ qty: 100 + i })] }) as never, { now: NOW, userId: by }) as StoredPayload;
      p = prepareSave(p, incoming({ lines: [line({ qty: 100 + i })], finalApprove: true }) as never, { now: NOW, userId: by }) as StoredPayload;
    }
    expect(p.revisions!.length).toBe(MAX_REVISIONS);
    expect(p.revisions![p.revisions!.length - 1].n).toBe(p.revision! - 1);
  });
});

describe("diffRevisions", () => {
  const a = { lines: [line(), line({ room: "Kitchen", title: "Kitchen", qty: 100, rate: 3348 })] };
  const b = { lines: [line({ qty: 80 }), line({ room: "Kitchen", title: "Kitchen", qty: 100, rate: 3000 }), line({ room: "Dining", title: "Crockery", qty: 40, rate: 2803 })] };
  const d = diffRevisions(a, b);
  it("reports quantity, rate, added and removed lines and the total delta", () => {
    expect(d.changed.map((c) => c.title)).toEqual(["Feature wall", "Kitchen"]);
    expect(d.changed[0]).toMatchObject({ qty: [72, 80] });
    expect(d.changed[1]).toMatchObject({ rate: [3348, 3000] });
    expect(d.added.map((l) => l.title)).toEqual(["Crockery"]);
    expect(d.removed).toEqual([]);
    expect(d.totalA).toBe(72 * 1012 + 100 * 3348);
    expect(d.totalB).toBe(80 * 1012 + 100 * 3000 + 40 * 2803);
    expect(d.delta).toBe(d.totalB - d.totalA);
  });
});
