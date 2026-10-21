import type { ScopeStatus } from "@/lib/boq/build";

/** The few line fields the review needs (works on workbench rows and API lines alike). */
export interface ReviewRow {
  room: string;
  trade: string;
  item: string;
  title?: string;
  qty: number;
  rate: number;
  qtySource?: "measured" | "entered" | "estimated";
  provisional?: boolean;
  rateNote?: string;
  scopeStatus?: ScopeStatus;
}

const rank = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);

/** Pure cost-transparency summary: every figure is qty × rate of the rows given, nothing is adjusted. */
export function reviewSummary(rows: ReviewRow[]) {
  const byRoom = new Map<string, number>();
  const byTrade = new Map<string, number>();
  const byStatus: Partial<Record<ScopeStatus, number>> = {};
  let subtotal = 0;
  const priced = rows.map((r) => ({ ...r, amount: r.qty * r.rate }));
  for (const r of priced) {
    subtotal += r.amount;
    byRoom.set(r.room, (byRoom.get(r.room) ?? 0) + r.amount);
    byTrade.set(r.trade, (byTrade.get(r.trade) ?? 0) + r.amount);
    const st = r.scopeStatus ?? "NEW";
    byStatus[st] = (byStatus[st] ?? 0) + 1;
  }
  return {
    subtotal,
    rooms: byRoom.size,
    byRoom: rank(byRoom),
    byTrade: rank(byTrade),
    top: [...priced].sort((a, b) => b.amount - a.amount).slice(0, 5),
    unverifiedRates: priced.filter((r) => r.provisional || r.rateNote),
    estimated: priced.filter((r) => r.qtySource === "estimated"),
    byStatus,
  };
}

/** Why a plan-driven BOQ may not be exported yet (null = fine). Spec-mode BOQs carry no scope and are never blocked. */
export function exportBlocker(scope?: { approved: boolean; items: { status?: ScopeStatus }[] }): string | null {
  if (!scope) return null;
  if (scope.items.some((i) => i.status === "UNCONFIRMED")) return "Resolve every UNCONFIRMED scope item before exporting.";
  if (!scope.approved) return "Approve the scope before exporting.";
  return null;
}

const HIGH_ROOM_FACTOR = 2; // a room is "unusually high" at more than 2x the average room's cost (relative, no fixed ceiling)

/** Budget comparison. Reports only: scope, quantities and rates are never touched. */
export function budgetView(rows: ReviewRow[], budget: number | undefined) {
  const s = reviewSummary(rows);
  const mean = s.byRoom.length ? s.subtotal / s.byRoom.length : 0;
  const has = typeof budget === "number" && budget > 0;
  const sum = (rs: { amount: number }[]) => rs.reduce((n, r) => n + r.amount, 0);
  return {
    budget: has ? budget : null,
    total: s.subtotal,
    difference: has ? s.subtotal - budget : null,
    over: has ? s.subtotal > budget : null,
    pct: has ? Math.round(((s.subtotal - budget) / budget) * 1000) / 10 : null,
    drivers: s.top,
    highRooms: s.byRoom.filter(([, v]) => s.byRoom.length > 2 && v > HIGH_ROOM_FACTOR * mean).map(([room, amount]) => ({ room, amount })),
    provisionalTotal: sum(s.unverifiedRates.filter((r) => r.provisional)),
    assumedTotal: sum(s.estimated),
  };
}
