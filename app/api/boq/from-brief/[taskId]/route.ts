import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";
import { AIConfigurationError, AIRequestError, AIValidationError } from "@/lib/ai/errors";
import { finishManusBoq } from "@/lib/ai/boq-manus";
import { briefResponse } from "@/lib/boq/brief-response";
import { PACKAGE_TIERS } from "@/lib/quote/constants";

export const runtime = "nodejs";

const querySchema = z.object({
  tier: z.enum(PACKAGE_TIERS),
  city: z.string().trim().max(60).default("Delhi"),
});
const TASK_ID = /^[A-Za-z0-9_-]{6,80}$/;

// Staff-only: one poll of a plan analysis started by POST /api/boq/from-brief.
export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in.", code: "unauthorized" }, { status: 401 });
  }
  try {
    await enforceRateLimit(`boq-poll:${user.id}`, { limit: 900, windowSeconds: 3600 });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json({ error: "Polling too fast. Please wait.", code: "rate_limited" }, { status: 429 });
    }
    throw error;
  }

  const { taskId } = await params;
  const q = querySchema.safeParse({
    tier: request.nextUrl.searchParams.get("tier"),
    city: request.nextUrl.searchParams.get("city") ?? undefined,
  });
  if (!TASK_ID.test(taskId) || !q.success) {
    return NextResponse.json({ error: "Invalid request.", code: "invalid" }, { status: 400 });
  }

  try {
    const p = await finishManusBoq(taskId);
    if (p.state === "running") return NextResponse.json({ status: "running" });
    if (p.state === "failed") return NextResponse.json({ status: "failed", error: p.error }, { status: 502 });
    return NextResponse.json({ status: "done", ...briefResponse(p.scope, q.data.tier, q.data.city) });
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return NextResponse.json({ status: "failed", error: error.message, code: "not_configured" }, { status: 503 });
    }
    if (error instanceof AIRequestError) {
      // A transient poll failure should not kill the analysis: tell the client to retry.
      if (error.code === "timeout" || error.code === "rate_limited") {
        return NextResponse.json({ status: "running" });
      }
      return NextResponse.json({ status: "failed", error: error.message, code: error.code }, { status: 502 });
    }
    if (error instanceof AIValidationError) {
      return NextResponse.json({ status: "failed", error: error.message, code: error.code }, { status: 502 });
    }
    throw error;
  }
}
