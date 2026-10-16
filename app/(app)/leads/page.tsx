import Link from "next/link";
import { requirePageUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TIER_INFO, type PackageTier } from "@/lib/quote/constants";
import { formatDate } from "@/lib/format";
import { formatRange } from "@/lib/quote/format";
import { Button } from "@/components/ui/button";
import { openLeadProjectAction } from "@/lib/actions/leads";

export const dynamic = "force-dynamic";

interface LeadListRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  bhk: string;
  package_tier: PackageTier;
  estimate_low: number;
  estimate_high: number;
  status: string;
  created_at: string;
  project_id: string | null;
}

const STATUS: Record<string, string> = {
  new: "New",
  generated: "Images ready",
  consult_requested: "Consultation requested",
};

export default async function LeadsPage() {
  await requirePageUser();

  let leads: LeadListRow[] = [];
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    // Staff session + RLS. Drafts (no consent yet) are abandoned sessions — hide them.
    const cols = "id, name, email, phone, city, bhk, package_tier, estimate_low, estimate_high, status, created_at";
    const query = (select: string) =>
      supabase
        .from("leads")
        .select(select)
        .gt("consent_at", "1970-01-02T00:00:00Z")
        .order("created_at", { ascending: false })
        .limit(100);
    const withProject = await query(`${cols}, project_id`);
    // Before migration 0005 there is no project_id column.
    const rows: unknown[] = withProject.data
      ? withProject.data
      : ((await query(cols)).data ?? []).map((l) => ({ ...(l as object), project_id: null }));
    leads = rows as LeadListRow[];
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Self-serve quote requests</p>
        <h1 className="display display-md mt-4 text-foreground">Leads</h1>
      </div>

      {leads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-[0.95rem] text-muted-foreground">
          {isSupabaseConfigured() ? "No submitted quotes yet." : "Leads need the database configured."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {leads.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{l.name}</p>
                <p className="truncate text-[0.85rem] text-muted-foreground">
                  {l.phone} · {l.email} · {l.city}
                </p>
                <p className="mt-1 text-[0.85rem] text-muted-foreground">
                  {l.bhk} BHK · {TIER_INFO[l.package_tier]?.label ?? l.package_tier} ·{" "}
                  {formatRange({ lowLakh: Number(l.estimate_low), highLakh: Number(l.estimate_high) })} ·{" "}
                  {STATUS[l.status] ?? l.status} · {formatDate(l.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <form action={openLeadProjectAction}>
                  <input type="hidden" name="leadId" value={l.id} />
                  <Button type="submit" size="sm" variant="outline">
                    {l.project_id ? "Open project" : "Create project"}
                  </Button>
                </form>
                {l.project_id && (
                  <Button render={<Link href={`/boq?project=${l.project_id}&lead=${l.id}`} />} size="sm">
                    Open BOQ
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
