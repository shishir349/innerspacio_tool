import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Every lead lives under a project. This creates (once) the project for a finalized lead,
 * with one project room per room the visitor asked about, and links `leads.project_id`.
 *
 * The caller supplies the client: the public flow passes the service-role client (it has no
 * session), the staff "Create project" action passes the signed-in session client (RLS).
 * This file therefore imports no client factory and never widens access by itself.
 */

const ROOM_TYPE: Record<string, string> = {
  living_room: "living_room",
  kitchen: "kitchen",
  bedroom: "bedroom",
  bathroom: "bathroom",
  dining_room: "dining_room",
  other: "other",
};

export async function ensureLeadProject(client: SupabaseClient, leadId: string): Promise<string | null> {
  const { data: lead } = await client
    .from("leads")
    .select("id, name, email, phone, city, bhk, package_tier, project_id, consent_at")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return null;
  if (lead.project_id) return lead.project_id as string;
  // A draft (no contact details / consent yet) is an abandoned session, not a client.
  if (new Date(lead.consent_at as string).getTime() <= 0 || !lead.name) return null;

  const { data: project, error } = await client
    .from("projects")
    .insert({
      title: `${lead.name} — ${lead.bhk} BHK (${lead.package_tier})`,
      client_name: lead.name,
      client_phone: lead.phone || null,
      client_email: lead.email || null,
      location: lead.city || "—",
      status: "new",
      notes: "Created from a self-serve quote request.",
    })
    .select("id")
    .single();
  if (error || !project) return null;

  const { data: rooms } = await client
    .from("lead_rooms")
    .select("label, room_type, ideas_text")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });
  if (rooms?.length) {
    await client.from("rooms").insert(
      rooms.map((r) => ({
        project_id: project.id,
        name: r.label,
        type: ROOM_TYPE[r.room_type as string] ?? "other",
        constraints: (r.ideas_text as string | null) || null,
      }))
    );
  }

  // Only the writer that still sees an unlinked lead wins; a concurrent twin cleans up its project.
  const { data: linked } = await client
    .from("leads")
    .update({ project_id: project.id })
    .eq("id", leadId)
    .is("project_id", null)
    .select("project_id")
    .maybeSingle();
  if (!linked) {
    await client.from("projects").delete().eq("id", project.id);
    const { data: again } = await client.from("leads").select("project_id").eq("id", leadId).maybeSingle();
    return (again?.project_id as string | null) ?? null;
  }
  return project.id as string;
}
