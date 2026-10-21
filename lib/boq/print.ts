import { lineAssessment, openDecisions, type LineState } from "@/lib/boq/decisions";
import { boqStatus, type StoredPayload } from "@/lib/boq/revisions";

interface FullLine {
  room: string;
  trade: string;
  item: string;
  title?: string;
  description?: string;
  remarks?: string;
  area?: string;
  uom: string;
  qty: number;
  rate: number;
  provisional?: boolean;
  qtySource?: string;
  rateNote?: string;
  scopeStatus?: string;
  rateId?: string;
  autoAdded?: boolean;
}
interface ScopeRow {
  room: string;
  requirement: string;
  title?: string;
  status?: string;
  rateId?: string;
}

export interface PrintMeta {
  title: string;
  project: string;
  location: string;
  tier: string;
  updatedAt: string;
}

const STATUS_LABEL = { draft: "Draft — not approved", review: "Scope approved — estimate not approved", approved: "Approved", revised: "Revised — not approved" } as const;

/** Everything the printable BOQ shows, derived only from the saved payload: nothing is recomputed or adjusted. */
export function printModel(
  payload: { lines: FullLine[]; scope?: { approved: boolean; items: ScopeRow[] }; revision?: number; finalApproved?: { at: string; by: string } },
  meta: PrintMeta
) {
  const byRoom = new Map<string, { room: string; lines: (FullLine & { amount: number; state: LineState; reasons: string[] })[]; subtotal: number }>();
  let total = 0;
  for (const l of payload.lines) {
    const amount = Math.round(l.qty * l.rate * 100) / 100;
    total += amount;
    const g = byRoom.get(l.room) ?? { room: l.room, lines: [], subtotal: 0 };
    const a = lineAssessment({ ...l, qtySource: l.qtySource as "measured" | "entered" | "estimated" | undefined }, payload.lines as never);
    g.lines.push({ ...l, amount, state: a.state as LineState, reasons: a.reasons.map((r) => r.text) });
    g.subtotal += amount;
    byRoom.set(l.room, g);
  }
  const items = payload.scope?.items ?? [];
  const label = (i: ScopeRow) => `${i.room} · ${i.title ?? i.requirement}`;
  const of = (...s: string[]) => items.filter((i) => s.includes(i.status ?? "NEW")).map(label);
  const status = boqStatus(payload as unknown as StoredPayload);
  total = Math.round(total * 100) / 100;
  return {
    ...meta,
    revision: payload.revision ?? 1,
    status,
    statusLabel: status === "approved" && payload.finalApproved ? `Approved ${payload.finalApproved.at.slice(0, 10)}` : STATUS_LABEL[status],
    rooms: [...byRoom.values()].map((r) => ({ ...r, subtotal: Math.round(r.subtotal * 100) / 100 })),
    total,
    taxNote: "Taxes: not included. GST is applicable extra as per the client's commercial terms.",
    finalTotal: total,
    included: of("NEW", "REPLACE"),
    excluded: of("EXCLUDED"),
    retained: of("RETAIN"),
    refurbish: of("REFURBISH"),
    unresolved: items.filter((i) => i.status === "UNCONFIRMED" || (i.status === "REFURBISH" && !i.rateId)).map(label),
    provisional: payload.lines.filter((l) => l.provisional).map((l) => `${l.room} · ${l.title ?? l.item}`),
    estimated: payload.lines.filter((l) => l.qtySource === "estimated").length,
    decisions: openDecisions(payload.lines as never),
    states: payload.lines.reduce<Record<string, number>>((n, l) => {
      const st = lineAssessment({ ...l, qtySource: l.qtySource as never }, payload.lines as never).state;
      n[st] = (n[st] ?? 0) + 1;
      return n;
    }, {}),
  };
}
