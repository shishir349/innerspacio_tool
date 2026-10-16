import Link from "next/link";
import { FileSpreadsheet, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/lib/format";
import { formatDate } from "@/lib/format";
import type { BoqRecord, Project } from "@/lib/types";

/** The project's BOQs and the way back into the other tools (BOQ builder, design studio). */
export function ProjectBoqs({ project, boqs }: { project: Project; boqs: BoqRecord[] }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium">Bills of quantities</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href={`/design-studio`} />}>
            Design Studio
          </Button>
          <Button size="sm" className="gap-1" render={<Link href={`/boq?project=${project.id}`} />}>
            <Plus className="size-4" /> New BOQ
          </Button>
        </div>
      </div>
      {boqs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-[0.95rem] text-muted-foreground">
          No BOQ saved for this project yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {boqs.map((b) => (
            <li key={b.id}>
              <Link
                href={`/boq?project=${project.id}&boq=${b.id}`}
                className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-muted/50"
              >
                <span className="flex items-center gap-2 font-medium">
                  <FileSpreadsheet className="size-4 text-muted-foreground" /> {b.title}
                </span>
                <span className="text-[0.85rem] text-muted-foreground">
                  {b.tier} · {formatInr(b.total)} · updated {formatDate(b.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
