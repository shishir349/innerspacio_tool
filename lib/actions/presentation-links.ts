"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createPresentationLink,
  getActivePresentationLink,
  getClientActivity,
  publishEstimateVersion,
  regeneratePresentationLink,
  revokePresentationLink,
  updateLinkVisibility,
} from "@/lib/presentation-links/designer";
import type { ActionResult } from "@/lib/actions/projects";
import type { ClientDecision, ClientFeedback, EstimateDisplayStatus, PresentationLink } from "@/lib/types";

function fail(error: unknown): ActionResult<never> {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues.map((i) => i.message).join("; ") };
  }
  if (error instanceof AuthError) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

function requireSupabase(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Client presentation links require Supabase to be configured — they need real persistence and a real cryptographic token store, which demo mode doesn't provide."
    );
  }
}

export async function getPresentationLinkStatusAction(
  projectId: string
): Promise<ActionResult<PresentationLink | null>> {
  try {
    await requireUser();
    if (!isSupabaseConfigured()) return { ok: true, data: null };
    const client = await createSupabaseServerClient();
    const link = await getActivePresentationLink(client, projectId);
    return { ok: true, data: link };
  } catch (error) {
    return fail(error);
  }
}

export async function createPresentationLinkAction(
  projectId: string
): Promise<ActionResult<{ link: PresentationLink; rawToken: string }>> {
  try {
    const user = await requireUser();
    requireSupabase();
    const client = await createSupabaseServerClient();
    const result = await createPresentationLink(client, user.id, projectId);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

export async function regeneratePresentationLinkAction(
  projectId: string
): Promise<ActionResult<{ link: PresentationLink; rawToken: string }>> {
  try {
    const user = await requireUser();
    requireSupabase();
    const client = await createSupabaseServerClient();
    const result = await regeneratePresentationLink(client, user.id, projectId);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

export async function revokePresentationLinkAction(
  linkId: string,
  projectId: string
): Promise<ActionResult<null>> {
  try {
    await requireUser();
    requireSupabase();
    const client = await createSupabaseServerClient();
    await revokePresentationLink(client, linkId);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

const updateVisibilitySchema = z.object({
  visibleRoomIds: z.array(z.string()).nullable().optional(),
  hiddenConceptIds: z.array(z.string()).optional(),
  showLocation: z.boolean().optional(),
});

export async function updateLinkVisibilityAction(
  linkId: string,
  projectId: string,
  input: z.infer<typeof updateVisibilitySchema>
): Promise<ActionResult<PresentationLink>> {
  try {
    await requireUser();
    requireSupabase();
    const parsed = updateVisibilitySchema.parse(input);
    const client = await createSupabaseServerClient();
    const link = await updateLinkVisibility(client, linkId, parsed);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: link };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Flips a single concept's visibility on the project's active presentation
 * link, if one exists. No-ops (returns null) when there is no active link —
 * callers show the designer a "no live link yet" state rather than an error.
 */
export async function toggleConceptVisibilityAction(
  projectId: string,
  conceptId: string,
  visible: boolean
): Promise<ActionResult<PresentationLink | null>> {
  try {
    await requireUser();
    if (!isSupabaseConfigured()) return { ok: true, data: null };
    const client = await createSupabaseServerClient();
    const link = await getActivePresentationLink(client, projectId);
    if (!link) return { ok: true, data: null };

    const hidden = new Set(link.hiddenConceptIds ?? []);
    if (visible) {
      hidden.delete(conceptId);
    } else {
      hidden.add(conceptId);
    }
    const updated = await updateLinkVisibility(client, link.id, {
      hiddenConceptIds: Array.from(hidden),
    });
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, data: updated };
  } catch (error) {
    return fail(error);
  }
}

export async function getClientActivityAction(
  projectId: string
): Promise<ActionResult<{ decisions: ClientDecision[]; feedback: ClientFeedback[] }>> {
  try {
    await requireUser();
    if (!isSupabaseConfigured()) return { ok: true, data: { decisions: [], feedback: [] } };
    const client = await createSupabaseServerClient();
    const activity = await getClientActivity(client, projectId);
    return { ok: true, data: activity };
  } catch (error) {
    return fail(error);
  }
}

const publishEstimateSchema = z.object({
  title: z.string().min(1, "Title is required."),
  displayStatus: z.enum(["preliminary", "final"]),
  inclusions: z.string().optional(),
  exclusions: z.string().optional(),
  assumptions: z.string().optional(),
  validityDays: z.coerce.number().min(1).max(365).optional(),
});

export async function publishEstimateVersionAction(
  projectId: string,
  roomId: string,
  input: z.infer<typeof publishEstimateSchema>
): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    requireSupabase();
    const parsed = publishEstimateSchema.parse(input);
    const client = await createSupabaseServerClient();
    await publishEstimateVersion(client, user.id, projectId, roomId, parsed as {
      title: string;
      displayStatus: EstimateDisplayStatus;
      inclusions?: string;
      exclusions?: string;
      assumptions?: string;
      validityDays?: number;
    });
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/design-studio/${projectId}/${roomId}`);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}
