import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";
import { AIConfigurationError, AIRequestError, AIValidationError } from "@/lib/ai/errors";
import { extractBoqScope, type ImageInput } from "@/lib/ai/boq-brief";
import { quantify } from "@/lib/boq/brief";
import { summarizeBoq } from "@/lib/boq/build";
import { PhotoUploadError, validatePhotoFile } from "@/lib/storage";
import { PACKAGE_TIERS } from "@/lib/quote/constants";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PHOTOS = 6;
const MAX_TOTAL_BYTES = 32 * 1024 * 1024;
const MAX_REQUIREMENTS = 8000;
// Anthropic rejects images over 5 MB; the browser shrinks them, this is the server backstop.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const fieldsSchema = z.object({
  requirements: z.string().trim().min(10, "Describe the requirements (at least a sentence).").max(MAX_REQUIREMENTS),
  tier: z.enum(PACKAGE_TIERS),
  city: z.string().trim().max(60).default("Delhi"),
});

const MEDIA = ["image/jpeg", "image/png", "image/webp"] as const;

async function toImage(file: File, what: string): Promise<ImageInput> {
  if (!(MEDIA as readonly string[]).includes(file.type)) {
    throw new PhotoUploadError(`${what} must be a JPEG, PNG or WEBP image (got ${file.type || "unknown"}).`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new PhotoUploadError(`${what} is larger than 5 MB. Use a smaller image.`);
  }
  const buf = Buffer.from(await file.arrayBuffer());
  validatePhotoFile(file, buf);
  return { data: buf.toString("base64"), mediaType: file.type as ImageInput["mediaType"] };
}

// Staff-only, paid (vision model): layout plan + photos + requirements → editable BOQ.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in.", code: "unauthorized" }, { status: 401 });
  }

  try {
    await enforceRateLimit(`boq-brief:${user.id}`, { limit: 10, windowSeconds: 3600 });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        { error: "Too many plan analyses this hour. Please wait and try again.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }

  // Reject oversize bodies before buffering them.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_TOTAL_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "Files are too large in total (32 MB max).", code: "invalid" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data.", code: "invalid" }, { status: 400 });
  }

  const fields = fieldsSchema.safeParse({
    requirements: form.get("requirements"),
    tier: form.get("tier"),
    city: form.get("city") ?? undefined,
  });
  if (!fields.success) {
    return NextResponse.json(
      { error: fields.error.issues.map((i) => i.message).join("; "), code: "invalid" },
      { status: 400 }
    );
  }

  const planFile = form.get("plan");
  if (!(planFile instanceof File)) {
    return NextResponse.json({ error: "Attach the layout plan image.", code: "invalid" }, { status: 400 });
  }
  const photoFiles = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photoFiles.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `Attach at most ${MAX_PHOTOS} photos.`, code: "invalid" }, { status: 400 });
  }
  const total = planFile.size + photoFiles.reduce((n, f) => n + f.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    return NextResponse.json({ error: "Files are too large in total (32 MB max).", code: "invalid" }, { status: 400 });
  }

  let plan: ImageInput;
  let photos: ImageInput[];
  try {
    plan = await toImage(planFile, "Layout plan");
    photos = await Promise.all(photoFiles.map((f) => toImage(f, "Photo")));
  } catch (error) {
    if (error instanceof PhotoUploadError) {
      return NextResponse.json({ error: error.message, code: "invalid" }, { status: 400 });
    }
    throw error;
  }

  let scope;
  try {
    scope = await extractBoqScope({ plan, photos, requirements: fields.data.requirements, tier: fields.data.tier });
  } catch (error) {
    if (error instanceof AIConfigurationError) {
      return NextResponse.json({ error: error.message, code: "not_configured" }, { status: 503 });
    }
    if (error instanceof AIRequestError) {
      const status = error.code === "rate_limited" ? 429 : error.code === "timeout" ? 504 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    if (error instanceof AIValidationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 502 });
    }
    throw error;
  }

  const { lines, warnings } = quantify(scope.items, scope.rooms, {
    tier: fields.data.tier,
    city: fields.data.city,
  });

  return NextResponse.json({
    tier: fields.data.tier,
    city: fields.data.city,
    rooms: scope.rooms,
    items: scope.items,
    lines,
    summary: summarizeBoq(lines),
    warnings: [...warnings, ...scope.dropped],
    assumptions: scope.assumptions,
    unpriced: scope.unpriced,
    questions: scope.questions,
  });
}
