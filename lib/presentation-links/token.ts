import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { refreshSignedPhotoUrl } from "@/lib/storage";
import { hashToken } from "./crypto";
import type {
  ClientDecisionType,
  Id,
  PresentationLink,
} from "@/lib/types";
import type { ClientLinkConcept, ClientLinkProject, ClientLinkRoom } from "@/lib/presentation/client-dto";

export type ResolveFailureReason = "not_found" | "expired" | "revoked";
export type ResolveResult =
  | { ok: true; link: PresentationLink }
  | { ok: false; reason: ResolveFailureReason };

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

/**
 * Validates a raw token and returns the link it resolves to, or a generic
 * failure reason. Every other function in this module takes an already-
 * resolved `PresentationLink`, never a raw token — so there is exactly one
 * place a token is ever looked up, and exactly one place that decides
 * whether it's usable.
 *
 * Deliberately returns a *reason* (not_found/expired/revoked) for this
 * module's own callers to log/branch on internally, but every caller-facing
 * surface (the page, the Server Actions) must collapse all three into the
 * same generic client-visible message — never reveal which case it was.
 */
export async function resolvePresentationLink(token: string | undefined | null): Promise<ResolveResult> {
  if (!token || token.length < 32) {
    return { ok: false, reason: "not_found" };
  }

  const tokenHash = hashToken(token);
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("presentation_links")
    .select("*")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, reason: "not_found" };
  }
  if (data.revoked_at) {
    return { ok: false, reason: "revoked" };
  }
  if (new Date(data.expires_at as string).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, link: mapLinkRow(data) };
}

export async function touchLastAccessed(link: PresentationLink): Promise<void> {
  const client = createSupabaseAdminClient();
  await client
    .from("presentation_links")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", link.id);
}

export async function logAuditEvent(
  link: PresentationLink,
  eventType: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const client = createSupabaseAdminClient();
  // Audit logging must never be able to break the user-facing action it's
  // logging — failures here are swallowed (not re-thrown), only reported.
  const { error } = await client.from("presentation_audit_events").insert({
    presentation_link_id: link.id,
    project_id: link.projectId,
    event_type: eventType,
    metadata,
  });
  if (error) {
    console.error(`Failed to log presentation audit event "${eventType}":`, error.message);
  }
}

/**
 * Builds the full client-facing view for a resolved link. Every query here
 * is scoped to `link.projectId` (and, downstream, to room ids actually
 * belonging to that project) — never to a caller-supplied id. This is the
 * only function that assembles a `ClientLinkProject`, and it only ever
 * reads the specific columns listed below, never a `select("*")` spread
 * into the response.
 */
export async function getClientPresentationData(link: PresentationLink): Promise<ClientLinkProject> {
  const client = createSupabaseAdminClient();

  const { data: projectRow, error: projectErr } = await client
    .from("projects")
    .select("title, client_name, location")
    .eq("id", link.projectId)
    .single();
  if (projectErr || !projectRow) {
    throw new Error("Presentation link's project could not be loaded.");
  }

  let roomsQuery = client
    .from("rooms")
    .select("id, name, type, dimension_length, dimension_width, dimension_ceiling_height, dimension_unit")
    .eq("project_id", link.projectId)
    .order("created_at");
  if (link.visibleRoomIds && link.visibleRoomIds.length > 0) {
    roomsQuery = roomsQuery.in("id", link.visibleRoomIds);
  }
  const { data: roomRows, error: roomsErr } = await roomsQuery;
  if (roomsErr) throw new Error("Could not load rooms for this presentation link.");

  const roomIds = (roomRows ?? []).map((r) => r.id as string);
  if (roomIds.length === 0) {
    return {
      projectTitle: projectRow.title as string,
      clientFirstName: firstName(projectRow.client_name as string),
      location: link.showLocation ? (projectRow.location as string) : undefined,
      rooms: [],
    };
  }

  const [{ data: photoRows }, { data: conceptRows }, { data: estimateRows }, { data: decisionRows }] =
    await Promise.all([
      client
        .from("room_photos")
        .select("id, room_id, url, storage_path, is_primary, created_at")
        .in("room_id", roomIds)
        .order("created_at"),
      client
        .from("design_concepts")
        .select("id, room_id, title, style, description, key_changes, image_url, provider, status, created_at")
        .in("room_id", roomIds)
        .order("created_at"),
      client
        .from("estimate_versions")
        .select("*")
        .in("room_id", roomIds)
        .eq("status", "published"),
      client.from("client_decisions").select("*").eq("presentation_link_id", link.id),
    ]);

  const hiddenConceptIds = new Set(link.hiddenConceptIds ?? []);
  const selectedConceptIds = new Set(
    (decisionRows ?? [])
      .filter((d) => d.decision_type === "concept_selected")
      .map((d) => d.concept_id as string)
  );
  const approvedConceptIds = new Set(
    (decisionRows ?? [])
      .filter((d) => d.decision_type === "concept_approved")
      .map((d) => d.concept_id as string)
  );
  const acceptedEstimateVersionIds = new Set(
    (decisionRows ?? [])
      .filter((d) => d.decision_type === "estimate_accepted")
      .map((d) => d.estimate_version_id as string)
  );

  const rooms: ClientLinkRoom[] = await Promise.all(
    (roomRows ?? []).map(async (roomRow) => {
      const roomId = roomRow.id as string;

      const roomPhotos = (photoRows ?? []).filter((p) => p.room_id === roomId);
      const primaryPhoto = roomPhotos.find((p) => p.is_primary) ?? roomPhotos[0];
      let originalPhotoUrl: string | undefined;
      if (primaryPhoto) {
        originalPhotoUrl = primaryPhoto.storage_path
          ? ((await refreshSignedPhotoUrl(client, primaryPhoto.storage_path as string)) ??
            (primaryPhoto.url as string))
          : (primaryPhoto.url as string);
      }

      const concepts: ClientLinkConcept[] = (conceptRows ?? [])
        .filter((c) => c.room_id === roomId && !hiddenConceptIds.has(c.id as string))
        .map((c) => ({
          id: c.id as string,
          title: c.title as string,
          style: c.style as string,
          description: c.description as string,
          keyChanges: (c.key_changes as string[]) ?? [],
          imageUrl: c.image_url as string,
          status: c.status as ConceptStatusFromRow,
          isSelected: selectedConceptIds.has(c.id as string),
          isApproved: approvedConceptIds.has(c.id as string),
        }));

      const estimateRow = (estimateRows ?? []).find((e) => e.room_id === roomId);
      const estimate = estimateRow
        ? {
            id: estimateRow.id as string,
            versionNumber: estimateRow.version_number as number,
            title: estimateRow.title as string,
            displayStatus: estimateRow.display_status as "preliminary" | "final",
            lineItems: (estimateRow.line_items as { name: string; unit: string; quantity: number }[]) ?? [],
            subtotalBeforeGst: estimateRow.subtotal_before_gst as number,
            gstPercent: estimateRow.gst_percent as number,
            gstAmount: estimateRow.gst_amount as number,
            totalClientEstimate: estimateRow.total_client_estimate as number,
            inclusions: (estimateRow.inclusions as string) ?? undefined,
            exclusions: (estimateRow.exclusions as string) ?? undefined,
            assumptions: (estimateRow.assumptions as string) ?? undefined,
            validityDays: estimateRow.validity_days as number,
            publishedAt: estimateRow.published_at as string,
            isAccepted: acceptedEstimateVersionIds.has(estimateRow.id as string),
          }
        : undefined;

      return {
        roomId,
        roomName: roomRow.name as string,
        roomType: roomRow.type as ClientLinkRoom["roomType"],
        dimensions: {
          length: (roomRow.dimension_length as number) ?? undefined,
          width: (roomRow.dimension_width as number) ?? undefined,
          ceilingHeight: (roomRow.dimension_ceiling_height as number) ?? undefined,
          unit: (roomRow.dimension_unit as "ft" | "m") ?? "ft",
        },
        originalPhotoUrl,
        concepts,
        estimate,
      };
    })
  );

  return {
    projectTitle: projectRow.title as string,
    clientFirstName: firstName(projectRow.client_name as string),
    location: link.showLocation ? (projectRow.location as string) : undefined,
    rooms,
  };
}

type ConceptStatusFromRow = ClientLinkConcept["status"];

function firstName(fullName: string | null | undefined): string | undefined {
  if (!fullName) return undefined;
  return fullName.trim().split(/\s+/)[0] || undefined;
}

// ─────────────────────────── ownership-chain checks ───────────────────────
// Mirrors the pattern in lib/data/supabase-store.ts: verify the full parent
// chain belongs to this link's project *before* any write, so a client
// can never act on a room/concept/estimate version outside the project
// their token is bound to, even if they guess or reuse another valid id.

async function assertRoomInLinkProject(projectId: Id, roomId: Id): Promise<void> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("rooms")
    .select("id")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("That room is not part of this presentation.");
  }
}

async function assertConceptInRoom(roomId: Id, conceptId: Id): Promise<void> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("design_concepts")
    .select("id")
    .eq("id", conceptId)
    .eq("room_id", roomId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("That concept is not part of this room.");
  }
}

async function assertPublishedEstimateInRoom(roomId: Id, estimateVersionId: Id): Promise<void> {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("estimate_versions")
    .select("id")
    .eq("id", estimateVersionId)
    .eq("room_id", roomId)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) {
    throw new Error("That estimate is not the currently published one for this room.");
  }
}

export interface RecordDecisionInput {
  decisionType: ClientDecisionType;
  roomId: Id;
  conceptId?: Id;
  estimateVersionId?: Id;
}

export async function recordClientDecision(
  link: PresentationLink,
  input: RecordDecisionInput
): Promise<void> {
  await assertRoomInLinkProject(link.projectId, input.roomId);

  if (input.decisionType === "estimate_accepted") {
    if (!input.estimateVersionId) throw new Error("estimateVersionId is required.");
    await assertPublishedEstimateInRoom(input.roomId, input.estimateVersionId);
  } else {
    if (!input.conceptId) throw new Error("conceptId is required.");
    await assertConceptInRoom(input.roomId, input.conceptId);
  }

  const client = createSupabaseAdminClient();
  const { error } = await client.from("client_decisions").insert({
    presentation_link_id: link.id,
    project_id: link.projectId,
    room_id: input.roomId,
    concept_id: input.conceptId ?? null,
    estimate_version_id: input.estimateVersionId ?? null,
    decision_type: input.decisionType,
  });
  if (error) throw new Error("Could not record your selection. Please try again.");

  await logAuditEvent(link, `client.${input.decisionType}`, {
    roomId: input.roomId,
    conceptId: input.conceptId,
    estimateVersionId: input.estimateVersionId,
  });
}

export interface RecordFeedbackInput {
  message: string;
  roomId?: Id;
  conceptId?: Id;
  feedbackType?: "comment" | "change_request";
}

export async function recordClientFeedback(
  link: PresentationLink,
  input: RecordFeedbackInput
): Promise<void> {
  const message = input.message.trim();
  if (message.length === 0) throw new Error("Feedback message cannot be empty.");
  if (message.length > 4000) throw new Error("Feedback message is too long.");

  if (input.roomId) {
    await assertRoomInLinkProject(link.projectId, input.roomId);
    if (input.conceptId) {
      await assertConceptInRoom(input.roomId, input.conceptId);
    }
  }

  const client = createSupabaseAdminClient();
  const { error } = await client.from("client_feedback").insert({
    presentation_link_id: link.id,
    project_id: link.projectId,
    room_id: input.roomId ?? null,
    concept_id: input.conceptId ?? null,
    feedback_type: input.feedbackType ?? "comment",
    message,
  });
  if (error) throw new Error("Could not submit your feedback. Please try again.");

  await logAuditEvent(link, "client.feedback_submitted", {
    roomId: input.roomId,
    conceptId: input.conceptId,
  });
}
