import "server-only";
import { isSupabaseConfigured } from "@/lib/config";
import { PhotoUploadError, SIGNED_URL_TTL_SECONDS, validatePhotoFile } from "@/lib/storage";

/**
 * One floor plan / blueprint per project, kept in the same private bucket as room
 * photos at a fixed path — no table, so no migration. Access is the signed-in
 * staff session (storage RLS), never the service-role client.
 */

const BUCKET = "room-photos";
const pathFor = (projectId: string) => `floorplans/${projectId}/plan`;

// Floor plans are images here (PDF plans need to be exported to PNG/JPG first).
const PLAN_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function client() {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  return createSupabaseServerClient();
}

export async function saveFloorPlan(projectId: string, file: File): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new PhotoUploadError("Floor plans need the database/storage configured.");
  }
  if (!PLAN_TYPES.includes(file.type)) {
    throw new PhotoUploadError("Floor plan must be a JPEG, PNG or WEBP image. Export PDF plans to an image first.");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  validatePhotoFile(file, buffer);

  const c = await client();
  const { error } = await c.storage
    .from(BUCKET)
    .upload(pathFor(projectId), buffer, { contentType: file.type, upsert: true });
  if (error) throw new PhotoUploadError(`Could not save the floor plan: ${error.message}`);
}

/** Short-lived signed URL, or null if the project has no floor plan. */
export async function getFloorPlanUrl(projectId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const c = await client();
  const { data, error } = await c.storage.from(BUCKET).createSignedUrl(pathFor(projectId), SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function deleteFloorPlan(projectId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const c = await client();
  await c.storage.from(BUCKET).remove([pathFor(projectId)]);
}
