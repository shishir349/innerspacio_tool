import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { getImageGenerationProvider } from "@/lib/image-gen/provider";
import { MAX_VARIANTS_PER_REQUEST } from "@/lib/image-gen/types";
import { buildConceptEditInstruction } from "@/lib/image-gen/prompt-builder";
import { uploadConceptImage, ConceptImageUploadError } from "@/lib/storage";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/config";
import { ROOM_TYPES } from "@/lib/types";
import type { DesignConcept } from "@/lib/types";

const requestSchema = z.object({
  style: z.string().min(1, "Style is required."),
  brief: z.string().min(1, "A short styling brief is required."),
  palette: z.string().optional(),
  variantCount: z.coerce.number().int().min(1).max(MAX_VARIANTS_PER_REQUEST).default(1),
});

function dataUrlToBase64(dataUrl: string): { base64: string; contentType: string } | null {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  return { contentType: match[1], base64: match[2] };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; roomId: string }> }
) {
  const { projectId, roomId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Please sign in.", code: "unauthorized" },
      { status: 401 }
    );
  }

  // Image generation is the single most expensive operation in the app —
  // rate-limited per user, independent of the coarser /present/* IP limit.
  try {
    await enforceRateLimit(`concepts:${user.id}`, { limit: 15, windowSeconds: 3600 });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        { error: "Too many concept-generation requests this hour. Please wait and try again.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "invalid" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "invalid" },
      { status: 400 }
    );
  }

  const repo = await getRepository();
  const project = await repo.getProject(projectId);
  const room = project?.rooms.find((r) => r.id === roomId);
  if (!project || !room) {
    return NextResponse.json({ error: "Room not found.", code: "not_found" }, { status: 404 });
  }
  const referencePhoto = room.photos.find((p) => p.isPrimary) ?? room.photos[0];
  if (!referencePhoto) {
    return NextResponse.json(
      { error: "Upload at least one room photo before generating a design concept.", code: "invalid" },
      { status: 400 }
    );
  }

  const provider = getImageGenerationProvider();
  const roomTypeLabel = ROOM_TYPES.find((t) => t.value === room.type)?.label ?? room.type;

  const instruction = buildConceptEditInstruction({
    roomType: room.type,
    style: parsed.data.style,
    palette: parsed.data.palette,
    userBrief: parsed.data.brief,
    analysis: room.analysis?.analysis,
    designBrief: room.designBrief,
  });

  let generated;
  try {
    generated = await provider.generateConcepts({
      referencePhotoUrl: referencePhoto.url,
      roomName: room.name,
      roomType: roomTypeLabel,
      style: parsed.data.style,
      palette: parsed.data.palette,
      brief: instruction,
      variantCount: parsed.data.variantCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Concept generation failed: ${error instanceof Error ? error.message : "unknown error"}. You can continue with manually described concepts.`,
        code: "generation_failed",
      },
      { status: 502 }
    );
  }

  const savedConceptIds: string[] = [];
  const errors: string[] = [];
  let updatedRoom = room;

  for (const result of generated) {
    try {
      let imageUrl = result.imageUrl;
      let storagePath: string | undefined;

      // Only real provider output gets persisted to storage — demo
      // placeholders are inline SVG data URIs with nothing durable to save,
      // and uploading them would misleadingly imply a real generated asset.
      if (!provider.isDemo && isSupabaseConfigured()) {
        const decoded = dataUrlToBase64(result.imageUrl);
        if (decoded) {
          const uploaded = await uploadConceptImage(roomId, decoded.base64, decoded.contentType);
          imageUrl = uploaded.url;
          storagePath = uploaded.storagePath;
        }
      }

      updatedRoom = await repo.addConcept(projectId, roomId, {
        title: result.title,
        style: result.style,
        description: result.description,
        keyChanges: result.keyChanges,
        imageUrl,
        storagePath,
        provider: result.provider,
        status: result.status,
      });

      const newest = updatedRoom.concepts.reduce((latest: DesignConcept | null, c) =>
        !latest || c.createdAt > latest.createdAt ? c : latest, null);
      if (newest) savedConceptIds.push(newest.id);
    } catch (error) {
      errors.push(
        error instanceof ConceptImageUploadError || error instanceof Error
          ? error.message
          : "Unknown error while saving a generated concept."
      );
    }
  }

  if (savedConceptIds.length === 0) {
    return NextResponse.json(
      { error: errors[0] ?? "Could not save any generated concept.", code: "generation_failed" },
      { status: 502 }
    );
  }

  // Never auto-publish a freshly generated concept to the client — hide it
  // from any active presentation link by default; the designer opts a
  // concept into the client view explicitly from the project page.
  if (isSupabaseConfigured()) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const { getActivePresentationLink, updateLinkVisibility } = await import(
        "@/lib/presentation-links/designer"
      );
      const client = await createSupabaseServerClient();
      const link = await getActivePresentationLink(client, projectId);
      if (link) {
        const hidden = new Set(link.hiddenConceptIds ?? []);
        savedConceptIds.forEach((id) => hidden.add(id));
        await updateLinkVisibility(client, link.id, { hiddenConceptIds: Array.from(hidden) });
      }
    } catch {
      // Best-effort — never fail concept generation because the
      // presentation-link visibility update couldn't be applied.
    }
  }

  return NextResponse.json({
    room: updatedRoom,
    provider: provider.name,
    isDemo: provider.isDemo,
    generatedCount: generated.length,
    savedCount: savedConceptIds.length,
    partialErrors: errors.length > 0 ? errors : undefined,
  });
}
