import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Bhk, HomeSize, PackageTier, QuoteRoomType } from "@/lib/quote/constants";
import type { BoqInput } from "@/lib/boq/build";

export interface LeadSpec {
  input: BoqInput;
  client: string;
  /** The project this lead lives under (null until staff open it). */
  projectId: string | null;
}

/**
 * Staff read of a lead for BOQ prefill. Uses the signed-in user's session, so RLS
 * (staff policies from migration 0004) decides access — NOT the service-role client.
 */
export async function loadLeadSpec(leadId: string): Promise<LeadSpec | null> {
  const supabase = await createSupabaseServerClient();
  let { data: lead } = await supabase
    .from("leads")
    .select("id, name, city, bhk, home_size, package_tier, project_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) {
    // Before migration 0005 there is no project_id column: fall back to the old shape.
    const old = await supabase
      .from("leads")
      .select("id, name, city, bhk, home_size, package_tier")
      .eq("id", leadId)
      .maybeSingle();
    lead = old.data ? { ...old.data, project_id: null } : null;
  }
  if (!lead) return null;
  const { data: rooms } = await supabase
    .from("lead_rooms")
    .select("room_type")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  return {
    client: (lead.name as string) || "",
    projectId: (lead.project_id as string | null) ?? null,
    input: {
      bhk: lead.bhk as Bhk,
      homeSize: (lead.home_size as HomeSize | null) ?? undefined,
      city: (lead.city as string) || "Delhi",
      tier: lead.package_tier as PackageTier,
      rooms: (rooms ?? []).map((r) => ({ roomType: r.room_type as QuoteRoomType })),
    },
  };
}
