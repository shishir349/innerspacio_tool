import { requirePageUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";
import { loadLeadSpec } from "@/lib/boq/lead";
import { RATE_CARD } from "@/lib/rates/catalog";
import { BoqWorkbench, type WorkbenchInitial } from "@/components/boq/workbench";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULTS: WorkbenchInitial = {
  bhk: "3",
  homeSize: "small",
  city: "Delhi",
  tier: "premium",
  rooms: { living_room: 1, dining_room: 1, kitchen: 1, bedroom: 3, bathroom: 3 },
  client: "",
};

export default async function BoqPage({ searchParams }: { searchParams: Promise<{ lead?: string }> }) {
  await requirePageUser();
  const { lead } = await searchParams;

  let initial = DEFAULTS;
  let note: string | null = null;
  if (lead && UUID.test(lead) && isSupabaseConfigured()) {
    const spec = await loadLeadSpec(lead);
    if (spec) {
      const rooms: Record<string, number> = {};
      for (const r of spec.input.rooms) rooms[r.roomType] = (rooms[r.roomType] ?? 0) + 1;
      initial = {
        bhk: spec.input.bhk,
        homeSize: spec.input.homeSize,
        city: spec.input.city,
        tier: spec.input.tier,
        rooms,
        client: spec.client,
        leadId: lead,
      };
      note = `Prefilled from lead${spec.client ? ` “${spec.client}”` : ""}.`;
    } else {
      note = "Lead not found — showing defaults.";
    }
  }

  const catalog = RATE_CARD.map((r) => ({
    id: r.id,
    code: r.code,
    trade: r.trade,
    item: r.item,
    uom: r.uom,
    rate: r.rate,
    desc: r.desc,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Bill of quantities</p>
        <h1 className="editorial-heading text-3xl text-foreground">BOQ Builder</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Generates a room-by-room BOQ from the InnerSpacio rate card, lets you edit every line, and exports the
          reference-format workbook (Master BOQ, trade and room summaries).
        </p>
        {note && <p className="mt-2 text-sm text-primary">{note}</p>}
      </div>
      <BoqWorkbench initial={initial} catalog={catalog} />
    </div>
  );
}
