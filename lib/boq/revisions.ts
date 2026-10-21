import type { ScopeStatus } from "@/lib/boq/build";
import { exportBlocker } from "@/lib/boq/review";

/**
 * BOQ lifecycle + revision history. All of it lives in the BOQ's jsonb payload (no migration) and is owned by the
 * server: a client can ask to approve, but revision numbers, history and the approval stamp are computed here.
 */
export const MAX_REVISIONS = 10;

export interface LineLite {
  room: string;
  trade: string;
  item: string;
  title?: string;
  code?: string;
  uom: string;
  qty: number;
  rate: number;
  scopeStatus?: string;
  provisional?: boolean;
}
type Scope = { approved: boolean; items: { status?: ScopeStatus; requirement?: string }[] };

export interface Snapshot {
  /** The revision number this snapshot preserves. */
  n: number;
  /** When it was superseded. */
  at: string;
  approvedAt?: string;
  approvedBy?: string;
  total: number;
  lines: LineLite[];
  scope?: Scope;
}
export interface StoredPayload {
  lines: LineLite[];
  scope?: Scope;
  revision?: number;
  finalApproved?: { at: string; by: string };
  revisions?: Snapshot[];
  [k: string]: unknown;
}
export type BoqStatus = "draft" | "review" | "approved" | "revised";

export function boqStatus(p: Pick<StoredPayload, "scope" | "revision" | "finalApproved">): BoqStatus {
  if (p.finalApproved) return "approved";
  if ((p.revision ?? 1) > 1) return "revised";
  return p.scope?.approved ? "review" : "draft";
}

const total = (lines: { qty: number; rate: number }[]) => Math.round(lines.reduce((n, l) => n + l.qty * l.rate, 0) * 100) / 100;
const lite = (l: LineLite): LineLite => ({
  room: l.room, trade: l.trade, item: l.item, title: l.title, code: l.code, uom: l.uom, qty: l.qty, rate: l.rate, scopeStatus: l.scopeStatus, provisional: l.provisional,
});
const fingerprint = (p: Pick<StoredPayload, "lines" | "scope">) =>
  JSON.stringify([p.lines.map((l) => [l.room, l.trade, l.title ?? l.item, l.uom, l.qty, l.rate]), p.scope?.items.map((i) => [i.requirement, i.status])]);

// Server-owned keys a client may never set.
const OWNED = ["revision", "revisions", "finalApproved", "finalApprove"] as const;

/**
 * The payload to store. Approving an estimate needs an approved scope; editing an APPROVED BOQ archives the approved
 * version as an immutable revision and reopens the new one as a draft (a client cannot edit and approve in one step).
 */
export function prepareSave(
  existing: StoredPayload | undefined,
  incoming: Pick<StoredPayload, "lines" | "scope"> & { finalApprove?: boolean } & Record<string, unknown>,
  ctx: { now: string; userId: string }
): StoredPayload {
  const next: StoredPayload = { ...(incoming as StoredPayload) };
  for (const k of OWNED) delete (next as Record<string, unknown>)[k];
  const revisions = [...(existing?.revisions ?? [])];
  let revision = existing?.revision ?? 1;
  let approved = existing?.finalApproved;

  const edited = !!existing && fingerprint(existing) !== fingerprint(incoming);
  if (existing?.finalApproved && edited) {
    revisions.push({
      n: revision,
      at: ctx.now,
      approvedAt: existing.finalApproved.at,
      approvedBy: existing.finalApproved.by,
      total: total(existing.lines),
      lines: existing.lines.map(lite),
      scope: existing.scope,
    });
    revision += 1;
    approved = undefined;
  } else if (edited && !existing?.finalApproved) {
    approved = undefined;
  }

  if (incoming.finalApprove && !approved && !(existing?.finalApproved && edited)) {
    const blocked = exportBlocker(incoming.scope);
    if (blocked) throw new Error(`Cannot approve the estimate: ${blocked}`);
    approved = { at: ctx.now, by: ctx.userId };
  }

  next.revision = revision;
  next.revisions = revisions.slice(-MAX_REVISIONS);
  if (approved) next.finalApproved = approved;
  return next;
}

const keyOf = (l: LineLite, seen: Map<string, number>) => {
  const base = `${l.room}|${l.trade}|${l.title ?? l.item}`;
  const n = (seen.get(base) ?? 0) + 1;
  seen.set(base, n);
  return `${base}#${n}`;
};

/** What changed between two versions: lines added / removed, quantity and rate edits, and the total delta. */
export function diffRevisions(a: { lines: LineLite[] }, b: { lines: LineLite[] }) {
  const index = (ls: LineLite[]) => {
    const seen = new Map<string, number>();
    return new Map(ls.map((l) => [keyOf(l, seen), l]));
  };
  const A = index(a.lines);
  const B = index(b.lines);
  const changed: { title: string; room: string; qty?: [number, number]; rate?: [number, number] }[] = [];
  for (const [k, lb] of B) {
    const la = A.get(k);
    if (!la) continue;
    if (la.qty !== lb.qty || la.rate !== lb.rate) {
      changed.push({
        title: lb.title ?? lb.item,
        room: lb.room,
        ...(la.qty !== lb.qty ? { qty: [la.qty, lb.qty] as [number, number] } : {}),
        ...(la.rate !== lb.rate ? { rate: [la.rate, lb.rate] as [number, number] } : {}),
      });
    }
  }
  const added = [...B].filter(([k]) => !A.has(k)).map(([, l]) => l);
  const removed = [...A].filter(([k]) => !B.has(k)).map(([, l]) => l);
  const totalA = total(a.lines);
  const totalB = total(b.lines);
  return { changed, added, removed, totalA, totalB, delta: Math.round((totalB - totalA) * 100) / 100 };
}
