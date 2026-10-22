import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { getRepository } from "@/lib/data";
import { formatInr } from "@/lib/format";
import { printModel } from "@/lib/boq/print";
import { PrintButton } from "@/components/boq/print-button";

export const dynamic = "force-dynamic";

const LIST = (title: string, items: string[]) =>
  items.length > 0 && (
    <section className="break-inside-avoid">
      <h3 className="text-[0.95rem] font-semibold">{title} ({items.length})</h3>
      <ul className="mt-1 list-disc pl-5 text-[0.85rem]">
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </section>
  );

// Designer-only printable BOQ (browser print → PDF). Reads only the SAVED BOQ, so the printed totals are the saved ones.
export default async function BoqPrintPage({ params }: { params: Promise<{ projectId: string; boqId: string }> }) {
  await requirePageUser();
  const { projectId, boqId } = await params;
  const repo = await getRepository();
  const [project, boq] = await Promise.all([repo.getProject(projectId), repo.getBoq(projectId, boqId)]);
  if (!project || !boq) notFound();
  const m = printModel(boq.payload as unknown as Parameters<typeof printModel>[0], {
    title: boq.title,
    project: project.title,
    location: project.location,
    tier: boq.tier,
    updatedAt: boq.updatedAt,
  });
  return (
    <main className="mx-auto max-w-5xl bg-cream p-8 text-[0.9rem] text-navy print:max-w-none print:p-0">
      <div className="mb-4 flex justify-end print:hidden">
        <PrintButton />
      </div>
      <header className="border-b border-navy/30 pb-4">
        <h1 className="text-[1.6rem] font-semibold">Bill of Quantities — {m.project}</h1>
        <dl className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3">
          {[
            ["Location", m.location || "—"],
            ["Category", m.tier],
            ["Estimate date", m.updatedAt.slice(0, 10)],
            ["BOQ revision", `Rev ${m.revision}`],
            ["Status", m.statusLabel],
            ["BOQ", m.title],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-navy/60">{k}:</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {m.status !== "approved" && <p className="mt-3 rounded border border-royal px-3 py-1 font-medium text-royal-deep">DRAFT — this estimate has not been approved.</p>}
      </header>

      {m.rooms.map((g) => (
        <section key={g.room} className="mt-6">
          <h2 className="text-[1.05rem] font-semibold">{g.room}</h2>
          <table className="mt-1 w-full border-collapse text-[0.82rem]">
            <thead>
              <tr className="border-b border-navy/40 text-left">
                <th className="py-1 pr-2">Item / specification</th>
                <th className="py-1 pr-2 text-right">Qty</th>
                <th className="py-1 pr-2">Unit</th>
                <th className="py-1 pr-2 text-right">Rate</th>
                <th className="py-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {g.lines.map((l, i) => (
                <tr key={i} className="break-inside-avoid border-b border-navy/10 align-top">
                  <td className="py-1 pr-2">
                    <span className="font-medium">{l.title ?? l.item}</span>
                    {l.scopeStatus && l.scopeStatus !== "NEW" && <span className="ml-1 text-navy/60">[{l.scopeStatus}]</span>}
                    {l.provisional && <span className="ml-1 text-royal-deep">[provisional rate]</span>}
                    <span className={"ml-1 " + (l.state === "confirmed" ? "text-royal" : l.state === "assumed" ? "text-royal-deep" : "text-navy")}>
                      [{l.state === "awaiting" ? "awaiting professional approval" : l.state}]
                    </span>
                    {l.description && <span className="block text-navy/70">{l.description}</span>}
                    {l.remarks && <span className="block text-navy/60">{l.remarks}</span>}
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums">{l.qty}</td>
                  <td className="py-1 pr-2">{l.uom}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{formatInr(l.rate)}</td>
                  <td className="py-1 text-right tabular-nums">{formatInr(l.amount)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className="py-1 pr-2 text-right font-semibold">Subtotal — {g.room}</td>
                <td className="py-1 text-right font-semibold tabular-nums">{formatInr(g.subtotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      ))}

      <section className="mt-8 break-inside-avoid border-t border-navy/40 pt-3">
        <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatInr(m.total)}</span></div>
        <div className="flex justify-between text-navy/70"><span>{m.taxNote}</span><span /></div>
        <div className="mt-1 flex justify-between text-[1.1rem] font-semibold"><span>Total (ex-GST)</span><span className="tabular-nums">{formatInr(m.finalTotal)}</span></div>
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {LIST("Included scope", m.included)}
        {LIST("Excluded scope", m.excluded)}
        {LIST("Retained (existing, not priced)", m.retained)}
        {LIST("Refurbishment", m.refurbish)}
        {LIST("Provisional rates to confirm", m.provisional)}
        {LIST("Unresolved items (not priced)", m.unresolved)}
      </div>
      {m.decisions.length > 0 && (
        <section className="mt-6 break-inside-avoid">
          <h3 className="text-[0.95rem] font-semibold">Open professional decisions</h3>
          <ul className="mt-1 list-disc pl-5 text-[0.85rem]">
            {m.decisions.map((d) => (
              <li key={d.id}>
                {d.message} <span className="text-navy/60">({d.count} line{d.count === 1 ? "" : "s"})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {m.estimated > 0 && <p className="mt-4 text-[0.85rem] text-navy/70">{m.estimated} line(s) rest on assumed quantities to be confirmed on site.</p>}
    </main>
  );
}
