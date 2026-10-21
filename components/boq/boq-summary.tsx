import { formatInr } from "@/lib/format";
import { budgetView, reviewSummary, type ReviewRow } from "@/lib/boq/review";

/** After pricing: what the money buys, and which figures still need a human. */
export function BoqSummary({
  rows,
  project,
  location,
  tier,
  budget,
  onBudget,
}: {
  rows: ReviewRow[];
  project: string;
  location: string;
  tier: string;
  budget?: number;
  onBudget: (n: number | undefined) => void;
}) {
  const s = reviewSummary(rows);
  const b = budgetView(rows, budget);
  const st = Object.entries(s.byStatus).filter(([k]) => k !== "NEW");
  return (
    <section className="rounded-3xl border border-border bg-card p-6">
      <h3 className="text-[0.95rem] font-medium">Project summary</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-[0.9rem] sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Project", project || "—"],
          ["Location", location || "—"],
          ["Category", tier],
          ["Rooms", String(s.rooms)],
          ["Lines", String(rows.length)],
          ["Subtotal", formatInr(s.subtotal)],
          ["Taxes", "Not included — GST applies extra"],
          ["Total (ex-GST)", formatInr(s.subtotal)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-border/50 py-1">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {st.length > 0 && (
        <p className="mt-2 text-[0.85rem] text-muted-foreground">Scope on priced lines: {st.map(([k, v]) => `${v} ${k}`).join(" · ")}.</p>
      )}
      <div className="mt-4 rounded-lg border border-border p-3 text-[0.88rem]">
        <label className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Client budget (₹)</span>
          <input
            className="h-8 w-40 rounded-md border border-input bg-background px-2 text-right tabular-nums"
            inputMode="numeric"
            aria-label="Client budget"
            value={budget ?? ""}
            onChange={(e) => onBudget(Number(e.target.value.replace(/[^0-9]/g, "")) || undefined)}
          />
          {b.budget !== null && b.difference !== null && (
            <span className={b.over ? "font-medium text-destructive" : "font-medium text-emerald-700"}>
              {b.over ? `Over budget by ${formatInr(b.difference)} (${b.pct}%)` : `Within budget — ${formatInr(-b.difference)} to spare`}
            </span>
          )}
        </label>
        {b.over && (
          <div className="mt-2 text-muted-foreground">
            <p>
              Nothing has been changed. Where the money is: {b.drivers.slice(0, 3).map((d) => `${d.title ?? d.item} ${formatInr(d.amount)}`).join(" · ")}.
              {b.highRooms.length > 0 && ` Unusually high rooms: ${b.highRooms.map((r) => `${r.room} ${formatInr(r.amount)}`).join(", ")}.`}
              {` Uncertain money: ${formatInr(b.provisionalTotal)} provisional rates, ${formatInr(b.assumedTotal)} on assumed quantities.`}
            </p>
            <p className="mt-1">To bring it down, change a scope item (RETAIN, REFURBISH or EXCLUDED in the scope review, or a smaller size) — each change is yours to approve.</p>
          </div>
        )}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <h4 className="text-[0.85rem] font-medium">Top cost drivers</h4>
          <ol className="mt-1 space-y-1 text-[0.85rem]">
            {s.top.map((r, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate">{r.room} · {r.title ?? r.item}</span>
                <span className="tabular-nums text-muted-foreground">{formatInr(r.amount)}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h4 className="text-[0.85rem] font-medium">Rates to verify ({s.unverifiedRates.length})</h4>
          <ul className="mt-1 space-y-1 text-[0.85rem] text-muted-foreground">
            {s.unverifiedRates.slice(0, 8).map((r, i) => (
              <li key={i}>{r.title ?? r.item}{r.provisional ? " — provisional allowance" : r.rateNote ? ` — ${r.rateNote}` : ""}</li>
            ))}
            {s.unverifiedRates.length === 0 && <li>None flagged.</li>}
          </ul>
        </div>
        <div>
          <h4 className="text-[0.85rem] font-medium">Quantities assumed ({s.estimated.length})</h4>
          <ul className="mt-1 space-y-1 text-[0.85rem] text-muted-foreground">
            {s.estimated.slice(0, 8).map((r, i) => (
              <li key={i}>{r.room} · {r.title ?? r.item}</li>
            ))}
            {s.estimated.length === 0 && <li>All quantities measured or entered.</li>}
            {s.estimated.length > 8 && <li>…and {s.estimated.length - 8} more.</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
