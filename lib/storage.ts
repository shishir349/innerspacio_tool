import "server-only";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/config";
import {
  MAX_PHOTO_BYTES,
  ACCEPTED_PHOTO_TYPES,
  MIN_PHOTO_DIMENSION,
  MAX_PHOTO_DIMENSION,
} from "@/lib/photo-constraints";

export { MAX_PHOTO_BYTES, ACCEPTED_PHOTO_TYPES, MIN_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION };

export class PhotoUploadError extends Error {}

export interface UploadedPhoto {
  url: string;
  storagePath?: string;
}

/**
 * How long a signed photo/concept-image URL is valid for. Kept short
 * deliberately: a signed URL is a bearer credential independent of any
 * session — anyone holding the link can view the private image until it
 * expires, regardless of whether they're signed in. Callers that render
 * photos (lib/data/supabase-store.ts) regenerate a fresh one on every read
 * rather than reusing whatever was last persisted, so this only bounds the
 * window between generating a URL and it actually being rendered.
 */
export const SIGNED_URL_TTL_SECONDS = 10 * 60;

/**
 * Dependency-free pixel-dimension sniffer for PNG and JPEG (the two formats
 * with a simple, well-documented header layout); returns null for anything
 * else (WebP/HEIC) rather than guessing — callers treat null as "dimension
 * check not available for this format" and fall back to MIME+size checks
 * only, instead of silently rejecting a valid file we just can't parse.
 */
export function sniffImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  // PNG: 8-byte signature, then an IHDR chunk whose first 8 bytes (after the
  // chunk length+type) are width/height as big-endian uint32.
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  // JPEG: walk the marker segments looking for a Start-Of-Frame marker
  // (0xC0–0xCF, excluding the DHT/JPG/DAC markers at 0xC4/0xC8/0xCC), whose
  // payload has height at offset 3-4 and width at offset 5-6 from the marker.
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
  }

  return null;
}

export function validatePhotoFile(file: File, buffer?: Buffer): void {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
    throw new PhotoUploadError(
      `Unsupported file type "${file.type || "unknown"}". Please upload a JPEG, PNG, WEBP or HEIC photo.`
    );
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new PhotoUploadError("Photo is larger than 8MB. Please upload a smaller file.");
  }
  if (file.size === 0) {
    throw new PhotoUploadError("The uploaded file is empty.");
  }

  if (buffer) {
    const dimensions = sniffImageDimensions(buffer);
    if (dimensions) {
      if (dimensions.width < MIN_PHOTO_DIMENSION || dimensions.height < MIN_PHOTO_DIMENSION) {
        throw new PhotoUploadError(
          `Photo is too small (${dimensions.width}×${dimensions.height}px). Please upload a photo at least ${MIN_PHOTO_DIMENSION}×${MIN_PHOTO_DIMENSION}px.`
        );
      }
      if (dimensions.width > MAX_PHOTO_DIMENSION || dimensions.height > MAX_PHOTO_DIMENSION) {
        throw new PhotoUploadError(
          `Photo is unusually large (${dimensions.width}×${dimensions.height}px). Please upload a photo under ${MAX_PHOTO_DIMENSION}×${MAX_PHOTO_DIMENSION}px.`
        );
      }
    }
    // WEBP/HEIC: dimensions couldn't be sniffed — proceed on MIME+size checks alone.
  }
}

/**
 * Stores a room photo. Uses Supabase Storage (private bucket, signed URL)
 * when configured; otherwise falls back to an inline data URL so demo mode
 * still has a fully working upload-and-preview flow, without pretending to
 * have durable cloud storage.
 */
export async function uploadRoomPhoto(roomId: string, file: File): Promise<UploadedPhoto> {
  const buffer = Buffer.from(await file.arrayBuffer());
  validatePhotoFile(file, buffer);

  if (isSupabaseConfigured()) {
    // Session-bound client: the storage RLS policies in
    // supabase/migrations/0001_init.sql also check for an authenticated
    // role, which a signed-in request now satisfies (see lib/auth.ts).
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const client = await createSupabaseServerClient();
    const extension = file.name.split(".").pop() || "jpg";
    const storagePath = `${roomId}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await client.storage
      .from("room-photos")
      .upload(storagePath, buffer, { contentType: file.type });
    if (uploadError) {
      throw new PhotoUploadError(`Could not upload photo: ${uploadError.message}`);
    }

    const { data: signed, error: signedError } = await client.storage
      .from("room-photos")
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (signedError || !signed) {
      throw new PhotoUploadError(`Could not create a signed URL for the photo.`);
    }

    return { url: signed.signedUrl, storagePath };
  }

  const url = `data:${file.type};base64,${buffer.toString("base64")}`;
  return { url };
}

/**
 * Regenerates a fresh, short-lived signed URL for an already-uploaded photo
 * OR generated concept image — both live in the same private `room-photos`
 * bucket. Used whenever a room is read back from Supabase — the `url`
 * column is never trusted as the long-term source of truth for access,
 * only `storage_path` is. Returns null if Supabase isn't configured or the
 * signed URL couldn't be created (caller falls back to the stored value).
 */
export async function refreshSignedPhotoUrl(
  client: SupabaseClient,
  storagePath: string
): Promise<string | null> {
  const { data, error } = await client.storage
    .from("room-photos")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

export class ConceptImageUploadError extends Error {}

/**
 * Uploads a real provider-generated concept image (base64, from the
 * provider's response) to the same private `room-photos` bucket used for
 * room photos, under a `concepts/` prefix. Only called for real providers —
 * demo-mode placeholders stay as inline SVG data URIs, since there's
 * nothing real to persist and uploading a placeholder would misleadingly
 * suggest it's a durable generated asset.
 */
export async function uploadConceptImage(
  roomId: string,
  base64Data: string,
  contentType: string
): Promise<{ url: string; storagePath: string }> {
  if (!isSupabaseConfigured()) {
    throw new ConceptImageUploadError("Supabase is not configured — cannot persist concept images.");
  }

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const client = await createSupabaseServerClient();

  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const storagePath = `concepts/${roomId}/${randomUUID()}.${extension}`;
  const buffer = Buffer.from(base64Data, "base64");

  const { error: uploadError } = await client.storage
    .from("room-photos")
    .upload(storagePath, buffer, { contentType });
  if (uploadError) {
    throw new ConceptImageUploadError(`Could not save the generated image: ${uploadError.message}`);
  }

  const { data: signed, error: signedError } = await client.storage
    .from("room-photos")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (signedError || !signed) {
    throw new ConceptImageUploadError("Could not create a signed URL for the generated image.");
  }

  return { url: signed.signedUrl, storagePath };
}
