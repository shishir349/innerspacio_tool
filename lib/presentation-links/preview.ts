import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActivePresentationLink } from "./designer";
import { getClientPresentationData } from "./token";
import type { PresentationLink } from "@/lib/types";
import type { ClientLinkProject } from "@/lib/presentation/client-dto";

/**
 * Builds the exact same client-facing view a shared link would show, for an
 * authenticated designer previewing their own project — without needing the
 * raw token (which, by design, is never retrievable again after creation).
 *
 * Uses the session-bound client (RLS-enforced) to confirm the signed-in
 * user can actually see this project before building anything, and to read
 * the project's real active link (so the preview reflects real visibility
 * settings) if one exists. The actual data assembly still goes through
 * `getClientPresentationData`, the same function the public /present/[token]
 * route uses — so there is exactly one place that ever builds this view.
 */
export async function getDesignerPreviewData(projectId: string): Promise<ClientLinkProject | null> {
  const sessionClient = await createSupabaseServerClient();

  const { data: projectRow } = await sessionClient
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!projectRow) return null;

  const realLink = await getActivePresentationLink(sessionClient, projectId);

  const link: PresentationLink =
    realLink ?? {
      id: "preview",
      projectId,
      tokenHash: "",
      createdByUserId: "",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      hiddenConceptIds: [],
      showLocation: true,
    };

  return getClientPresentationData(link);
}
