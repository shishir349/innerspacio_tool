import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateToken, hashToken } from "./crypto";
import type {
  ClientDecision,
  ClientFeedback,
  EstimateDisplayStatus,
  Id,
  PresentationLink,
} from "@/lib/types";

const DEFAULT_LINK_TTL_DAYS = 30;

type Row = Record<string, unknown>;

function mapLinkRow(row: Row): PresentationLink {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    tokenHash: row.token_hash as string,
    createdByUserId: row.created_by as string,
    createdAt: row.created_at as string,
    expiresAt: row.expires_at as string,
    revokedAt: (row.revoked_at as string) ?? undefined,
    lastAccessedAt: (row.last_accessed_at as string) ?? undefined,
    visibleRoomIds: (row.visible_room_ids as string[] | null) ?? undefined,
    hiddenConceptIds: (row.hidden_concept_ids as string[]) ?? [],
    showLocation: Boolean(row.show_location),
  };
}

function mapDecisionRow(row: Row): ClientDecision {
  return {
    id: row.id as string,
    presentationLinkId: row.presentation_link_id as string,
    projectId: row.project_id as string,
    roomId: (row.room_id as string) ?? undefined,
    conceptId: (row.concept_id as string) ?? undefined,
    estimateVersionId: (row.estimate_version_id as string) ?? undefined,
    decisionType: row.decision_type as ClientDecision["decisionType"],
    createdAt: row.created_at as string,
  };
}

function mapFeedbackRow(row: Row): ClientFeedback {
  return {
    id: row.id as string,
    presentationLinkId: row.presentation_link_id as string,
    projectId: row.project_id as string,
    roomId: (row.room_id as string) ?? undefined,
    conceptId: (row.concept_id as string) ?? undefined,
    feedbackType: row.feedback_type as ClientFeedback["feedbackType"],
    message: row.message as string,
    createdAt: row.created_at as string,
  };
}

/** Returns the project's current active (non-revoked) link, if any. */
export async function getActivePresentationLink(
  client: SupabaseClient,
  projectId: Id
): Promise<PresentationLink | null> {
  const { data, error } = await client
    .from("presentation_links")
    .select("*")
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return mapLinkRow(data);
}

export interface CreateLinkOptions {
  ttlDays?: number;
  showLocation?: boolean;
  visibleRoomIds?: Id[];
}

/**
 * Creates a new link for a project. Returns the raw token exactly once —
 * callers must show it to the designer immediately and never log it or
 * store it themselves; only `tokenHash` is persisted.
 */
export async function createPresentationLink(
  client: SupabaseClient,
  userId: string,
  projectId: Id,
  options: CreateLinkOptions = {}
): Promise<{ link: PresentationLink; rawToken: string }> {
  const existing = await getActivePresentationLink(client, projectId);
  if (existing) {
    throw new Error(
      "This project already has an active presentation link. Revoke or regenerate it instead of creating another."
    );
  }

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const ttlDays = options.ttlDays ?? DEFAULT_LINK_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("presentation_links")
    .insert({
      project_id: projectId,
      token_hash: tokenHash,
      created_by: userId,
      expires_at: expiresAt,
      show_location: options.showLocation ?? true,
      visible_room_ids: options.visibleRoomIds ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Could not create presentation link: ${error?.message ?? "unknown error"}`);
  }

  return { link: mapLinkRow(data), rawToken };
}

export async function revokePresentationLink(client: SupabaseClient, linkId: Id): Promise<void> {
  const { error } = await client
    .from("presentation_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .is("revoked_at", null);
  if (error) throw new Error(`Could not revoke presentation link: ${error.message}`);
}

/** Revokes the project's current active link (if any) and creates a fresh one. */
export async function regeneratePresentationLink(
  client: SupabaseClient,
  userId: string,
  projectId: Id,
  options: CreateLinkOptions = {}
): Promise<{ link: PresentationLink; rawToken: string }> {
  const existing = await getActivePresentationLink(client, projectId);
  if (existing) {
    await revokePresentationLink(client, existing.id);
  }

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const ttlDays = options.ttlDays ?? DEFAULT_LINK_TTL_DAYS;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await client
    .from("presentation_links")
    .insert({
      project_id: projectId,
      token_hash: tokenHash,
      created_by: userId,
      expires_at: expiresAt,
      show_location: options.showLocation ?? existing?.showLocation ?? true,
      visible_room_ids: options.visibleRoomIds ?? existing?.visibleRoomIds ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Could not regenerate presentation link: ${error?.message ?? "unknown error"}`);
  }

  return { link: mapLinkRow(data), rawToken };
}

export interface UpdateLinkVisibilityInput {
  visibleRoomIds?: Id[] | null;
  hiddenConceptIds?: Id[];
  showLocation?: boolean;
}

export async function updateLinkVisibility(
  client: SupabaseClient,
  linkId: Id,
  input: UpdateLinkVisibilityInput
): Promise<PresentationLink> {
  const patch: Record<string, unknown> = {};
  if (input.visibleRoomIds !== undefined) patch.visible_room_ids = input.visibleRoomIds;
  if (input.hiddenConceptIds !== undefined) patch.hidden_concept_ids = input.hiddenConceptIds;
  if (input.showLocation !== undefined) patch.show_location = input.showLocation;

  const { data, error } = await client
    .from("presentation_links")
    .update(patch)
    .eq("id", linkId)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Could not update link visibility: ${error?.message ?? "unknown error"}`);
  }
  return mapLinkRow(data);
}

export async function getClientActivity(
  client: SupabaseClient,
  projectId: Id
): Promise<{ decisions: ClientDecision[]; feedback: ClientFeedback[] }> {
  const [{ data: decisionRows, error: decisionErr }, { data: feedbackRows, error: feedbackErr }] =
    await Promise.all([
      client
        .from("client_decisions")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
      client
        .from("client_feedback")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);
  if (decisionErr) throw new Error(`Could not load client decisions: ${decisionErr.message}`);
  if (feedbackErr) throw new Error(`Could not load client feedback: ${feedbackErr.message}`);

  return {
    decisions: (decisionRows ?? []).map(mapDecisionRow),
    feedback: (feedbackRows ?? []).map(mapFeedbackRow),
  };
}

export interface PublishEstimateInput {
  title: string;
  displayStatus: EstimateDisplayStatus;
  inclusions?: string;
  exclusions?: string;
  assumptions?: string;
  validityDays?: number;
}

/**
 * Snapshots the room's current *live* estimate (lib/data — the designer's
 * editable working draft) into a new, frozen, client-safe `estimate_versions`
 * row, and marks any previously published version for this room as
 * superseded. The client-facing page only ever reads published versions —
 * editing the live draft afterward can never change what was already shown
 * to or accepted by the client.
 */
export async function publishEstimateVersion(
  client: SupabaseClient,
  userId: string,
  projectId: Id,
  roomId: Id,
  input: PublishEstimateInput
): Promise<void> {
  const { data: room, error: roomErr } = await client
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (roomErr || !room) {
    throw new Error("Room not found in this project.");
  }

  const { data: estimateRow, error: estimateErr } = await client
    .from("estimates")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  if (estimateErr || !estimateRow) {
    throw new Error("This room doesn't have a saved estimate to publish yet.");
  }

  const { data: lineItemRows, error: lineItemsErr } = await client
    .from("estimate_line_items")
    .select("name, unit, quantity")
    .eq("estimate_id", estimateRow.id);
  if (lineItemsErr) {
    throw new Error(`Could not load estimate line items: ${lineItemsErr.message}`);
  }

  const { data: previousPublished } = await client
    .from("estimate_versions")
    .select("id, version_number")
    .eq("room_id", roomId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersionNumber = ((previousPublished?.version_number as number) ?? 0) + 1;

  if (previousPublished?.id) {
    const { error: supersedeErr } = await client
      .from("estimate_versions")
      .update({ status: "superseded" })
      .eq("id", previousPublished.id);
    if (supersedeErr) {
      throw new Error(`Could not supersede the previous published estimate: ${supersedeErr.message}`);
    }
  }

  const { error: insertErr } = await client.from("estimate_versions").insert({
    room_id: roomId,
    project_id: projectId,
    version_number: nextVersionNumber,
    status: "published",
    display_status: input.displayStatus,
    title: input.title,
    line_items: (lineItemRows ?? []).map((li) => ({
      name: li.name,
      unit: li.unit,
      quantity: li.quantity,
    })),
    subtotal_before_gst: estimateRow.target_selling_subtotal,
    gst_percent: estimateRow.gst_percent,
    gst_amount: estimateRow.gst_amount,
    total_client_estimate: estimateRow.total_client_estimate,
    inclusions: input.inclusions ?? null,
    exclusions: input.exclusions ?? null,
    assumptions: input.assumptions ?? null,
    validity_days: input.validityDays ?? 30,
    published_by: userId,
  });
  if (insertErr) {
    throw new Error(`Could not publish estimate: ${insertErr.message}`);
  }
}
