"use client";

import { useMemo, useState } from "react";
import { formatInr } from "@/lib/format";
import { diffRevisions, type BoqStatus, type LineLite, type Snapshot } from "@/lib/boq/revisions";

const TONE: Record<BoqStatus, string> = {
  draft: "bg-muted text-foreground",
  review: "bg-accent text-royal-deep",
  approved: "bg-accent text-royal-deep",
  revised: "bg-royal text-cream",
};
const LABEL: Record<BoqStatus, string> = {
  draft: "Draft — scope not approved",
  review: "In review — scope approved, estimate not",
  approved: "Approved",
  revised: "Revised — not yet approved",
};

const d = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

/** Where this BOQ is in its life, and what changed since each earlier version. */
export function RevisionPanel({
  status,
  revision,
  approvedAt,
  revisions,
  current,
}: {
  status: BoqStatus;
  revision: number;
  approvedAt?: string;
  revisions: Snapshot[];
  current: LineLite[];
}) {
  const [sel, setSel] = useState<number | null>(null);
  const snap = revisions.find((r) => r.n === sel) ?? null;
  const diff = useMemo(() => (snap ? diffRevisions(snap, { lines: current }) : null), [snap, current]);
  return (
    <section className="rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={"rounded px-2 py-0.5 text-[0.85rem] " + TONE[status]}>{LABEL[status]}</span>
        <span className="text-[0.9rem]">Revision {revision}</span>
        {approvedAt && <span className="text-[0.85rem] text-muted-foreground">approved {d(approvedAt)}</span>}
        {status === "approved" && (
          <span className="text-[0.85rem] text-muted-foreground">Saving an edit keeps this version and starts revision {revision + 1} as a draft.</span>
        )}
      </div>
      {revisions.length > 0 && (
        <div className="mt-3 text-[0.85rem]">
          <label className="text-muted-foreground">
            Compare with an earlier revision{" "}
            <select className="ml-1 h-8 rounded-md border border-input bg-background px-2" value={sel ?? ""} onChange={(e) => setSel(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Choose…</option>
              {revisions.map((r) => (
                <option key={r.n} value={r.n}>
                  Rev {r.n} · {formatInr(r.total)}
                  {r.approvedAt ? ` · approved ${d(r.approvedAt)}` : ""}
                </option>
              ))}
            </select>
          </label>
          {diff && (
            <div className="mt-2 space-y-1">
              <p>
                Rev {sel}: {formatInr(diff.totalA)} → now {formatInr(diff.totalB)} ({diff.delta >= 0 ? "+" : "−"}
                {formatInr(Math.abs(diff.delta))}). {diff.added.length} added · {diff.removed.length} removed · {diff.changed.length} changed.
              </p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {diff.changed.slice(0, 12).map((c, i) => (
                  <li key={i}>
                    {c.room} · {c.title}
                    {c.qty ? ` — qty ${c.qty[0]} → ${c.qty[1]}` : ""}
                    {c.rate ? ` — rate ${c.rate[0]} → ${c.rate[1]}` : ""}
                  </li>
                ))}
                {diff.added.slice(0, 8).map((l, i) => (
                  <li key={"a" + i}>Added: {l.room} · {l.title ?? l.item}</li>
                ))}
                {diff.removed.slice(0, 8).map((l, i) => (
                  <li key={"r" + i}>Removed: {l.room} · {l.title ?? l.item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
