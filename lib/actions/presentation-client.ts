"use server";

import { z } from "zod";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";
import {
  recordClientDecision,
  recordClientFeedback,
  resolvePresentationLink,
} from "@/lib/presentation-links/token";

export type ClientActionResult = { ok: true } | { ok: false; error: string };

/**
 * One generic message for every "this link doesn't work" case — not_found,
 * expired and revoked are deliberately indistinguishable to the caller, so
 * a client (or an attacker probing tokens) can't learn which case it was.
 */
const LINK_UNAVAILABLE_MESSAGE =
  "This presentation link is no longer available. Please contact your designer for an updated link.";

function fail(error: unknown): ClientActionResult {
  if (error instanceof RateLimitedError) {
    return { ok: false, error: "Too many requests — please wait a moment and try again." };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues.map((i) => i.message).join("; ") };
  }
  return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
}

const decisionSchema = z.object({
  token: z.string().min(1),
  decisionType: z.enum(["concept_selected", "concept_approved", "estimate_accepted"]),
  roomId: z.string().min(1),
  conceptId: z.string().optional(),
  estimateVersionId: z.string().optional(),
});

export async function submitClientDecisionAction(
  input: z.infer<typeof decisionSchema>
): Promise<ClientActionResult> {
  try {
    const parsed = decisionSchema.parse(input);

    const resolved = await resolvePresentationLink(parsed.token);
    if (!resolved.ok) return { ok: false, error: LINK_UNAVAILABLE_MESSAGE };

    await enforceRateLimit(`decision:${resolved.link.id}`, { limit: 30, windowSeconds: 60 });

    await recordClientDecision(resolved.link, {
      decisionType: parsed.decisionType,
      roomId: parsed.roomId,
      conceptId: parsed.conceptId,
      estimateVersionId: parsed.estimateVersionId,
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

const feedbackSchema = z.object({
  token: z.string().min(1),
  message: z.string().min(1, "Feedback cannot be empty.").max(4000),
  roomId: z.string().optional(),
  conceptId: z.string().optional(),
  feedbackType: z.enum(["comment", "change_request"]).optional(),
});

export async function submitClientFeedbackAction(
  input: z.infer<typeof feedbackSchema>
): Promise<ClientActionResult> {
  try {
    const parsed = feedbackSchema.parse(input);

    const resolved = await resolvePresentationLink(parsed.token);
    if (!resolved.ok) return { ok: false, error: LINK_UNAVAILABLE_MESSAGE };

    await enforceRateLimit(`feedback:${resolved.link.id}`, { limit: 10, windowSeconds: 60 });

    await recordClientFeedback(resolved.link, {
      message: parsed.message,
      roomId: parsed.roomId,
      conceptId: parsed.conceptId,
      feedbackType: parsed.feedbackType,
    });
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
