import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { analyzeRoomPhotos } from "@/lib/ai/claude";
import { AIConfigurationError, AIRequestError, AIValidationError } from "@/lib/ai/errors";
import { isAnthropicConfigured } from "@/lib/config";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";
import type { Room } from "@/lib/types";

function dimensionsSummary(room: Room): string | undefined {
  const { length, width, ceilingHeight, unit } = room.dimensions;
  if (!length && !width && !ceilingHeight) return undefined;
  const parts = [
    length && `${length}${unit} length`,
    width && `${width}${unit} width`,
    ceilingHeight && `${ceilingHeight}${unit} ceiling height`,
  ].filter(Boolean);
  return parts.join(", ");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; roomId: string }> }
) {
  const { projectId, roomId } = await params;

  // Defense in depth: proxy.ts already blocks unauthenticated requests
  // to /api/*, but this route is also reachable directly, so check again.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Please sign in.", code: "unauthorized" },
      { status: 401 }
    );
  }

  // Vision calls to Claude are billed per request — rate-limited per user,
  // independent of the (separate, stricter) image-generation limit.
  try {
    await enforceRateLimit(`analyze:${user.id}`, { limit: 20, windowSeconds: 3600 });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        { error: "Too many analysis requests this hour. Please wait and try again.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }

  if (!isAnthropicConfigured()) {
    return NextResponse.json(
      {
        error:
          "AI room analysis is unavailable: ANTHROPIC_API_KEY is not configured on the server. Add it to your environment and restart the app, or continue the design brief manually.",
        code: "not_configured",
      },
      { status: 503 }
    );
  }

  const repo = await getRepository();
  const project = await repo.getProject(projectId);
  const room = project?.rooms.find((r) => r.id === roomId);
  if (!project || !room) {
    return NextResponse.json({ error: "Room not found.", code: "not_found" }, { status: 404 });
  }
  if (room.photos.length === 0) {
    return NextResponse.json(
      { error: "Upload at least one room photo before running AI analysis.", code: "invalid" },
      { status: 400 }
    );
  }

  try {
    const analysis = await analyzeRoomPhotos(
      room.photos.map((p) => ({ url: p.url })),
      {
        roomName: room.name,
        roomType: room.type,
        dimensionsSummary: dimensionsSummary(room),
        preferredStyle: room.preferredStyle,
        preferredColorPalette: room.preferredColorPalette,
        storageRequirements: room.storageRequirements,
        materialPreferences: room.materialPreferences,
        budget: room.budget,
        constraints: room.constraints,
        existingConditionNotes: room.existingConditionNotes,
      }
    );

    const updatedRoom = await repo.saveRoomAnalysis(projectId, roomId, {
      analysis,
      reviewedByDesigner: false,
    });

    return NextResponse.json({ room: updatedRoom });
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 });
    }
    if (error instanceof AIRequestError) {
      const status = error.code === "rate_limited" ? 429 : error.code === "timeout" ? 504 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    if (error instanceof AIValidationError) {
      return NextResponse.json({ error: error.message, code: "invalid_response" }, { status: 502 });
    }
    return NextResponse.json(
      { error: "AI room analysis failed unexpectedly. Please try again or continue manually.", code: "unknown" },
      { status: 500 }
    );
  }
}
