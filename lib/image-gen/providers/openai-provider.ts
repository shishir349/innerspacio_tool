import "server-only";
import type {
  ConceptGenerationRequest,
  GeneratedConceptResult,
  ImageGenerationProvider,
} from "@/lib/image-gen/types";
import { MAX_VARIANTS_PER_REQUEST } from "@/lib/image-gen/types";

const OPENAI_EDITS_ENDPOINT = "https://api.openai.com/v1/images/edits";
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Valid `size` values for gpt-image-1's edit endpoint, verified against
 * OpenAI's current documentation (platform.openai.com, Oct 2026) — this is
 * NOT an arbitrary WxH string, only these four are accepted:
 * https://developers.openai.com/cookbook/examples/generate_images_with_gpt_image
 */
type OpenAIImageSize = "1024x1024" | "1536x1024" | "1024x1536" | "auto";
const DEFAULT_SIZE: OpenAIImageSize = "1536x1024"; // landscape — a better default fit for room photos than square

/**
 * Real image-generation provider using OpenAI's image-edit endpoint, which
 * transforms an input image from a text prompt while keeping it as the
 * starting point — matching the requirement to use the room photo as a
 * reference and preserve architectural features while restyling
 * finishes/furniture/lighting.
 *
 * API details verified directly against OpenAI's current docs/cookbook
 * rather than assumed from training data:
 * - Endpoint: POST /v1/images/edits (NOT the text-to-image /generations endpoint).
 * - Image input is raw file BYTES in multipart/form-data — never a URL.
 *   (This provider fetches the reference photo server-side first.)
 * - `response_format` must NOT be sent for gpt-image-1 — it always returns
 *   base64 (`data[].b64_json`); sending `response_format` is rejected.
 * - `size` only accepts "1024x1024" | "1536x1024" | "1024x1536" | "auto" —
 *   not an arbitrary WxH string.
 * - `n` accepts 1–10 in a single request; we cap at MAX_VARIANTS_PER_REQUEST
 *   for cost/latency, independent of what the API itself would allow.
 *
 * Only used when IMAGE_GENERATION_PROVIDER=openai and OPENAI_API_KEY are
 * set. Replace or extend this file to plug in a different provider — the
 * rest of the app only depends on the ImageGenerationProvider interface.
 */
export class OpenAIImageGenerationProvider implements ImageGenerationProvider {
  readonly name = "openai";
  readonly isDemo = false;

  async generateConcepts(request: ConceptGenerationRequest): Promise<GeneratedConceptResult[]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const n = Math.max(1, Math.min(request.variantCount, MAX_VARIANTS_PER_REQUEST, 10));

    const referenceImage = await fetchImageBytes(request.referencePhotoUrl);
    const extension = extensionForContentType(referenceImage.contentType);

    const form = new FormData();
    form.append("model", model);
    form.append(
      "image",
      new Blob([referenceImage.bytes], { type: referenceImage.contentType }),
      `reference.${extension}`
    );
    form.append("prompt", request.brief);
    form.append("size", DEFAULT_SIZE);
    form.append("n", String(n));
    // Deliberately no `response_format` — gpt-image-1 rejects it and always
    // returns b64_json; see the class doc comment above.

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(OPENAI_EDITS_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("OpenAI image request timed out. Please try again.");
      }
      throw new Error(
        `OpenAI image request failed: ${error instanceof Error ? error.message : "unknown error"}`
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(await describeOpenAIError(response));
    }

    let body: { data?: { b64_json?: string }[] };
    try {
      body = await response.json();
    } catch {
      throw new Error("OpenAI returned a response that could not be parsed as JSON.");
    }

    if (!body.data || body.data.length === 0) {
      throw new Error("OpenAI image request did not return any image data.");
    }

    const results: GeneratedConceptResult[] = [];
    body.data.forEach((item, index) => {
      if (!item.b64_json) return; // skip any malformed entry rather than failing the whole batch
      const variantSuffix = body.data!.length > 1 ? ` — Variant ${index + 1}` : "";
      results.push({
        imageUrl: `data:image/png;base64,${item.b64_json}`,
        title: `${request.style} Concept${variantSuffix}`,
        style: request.style,
        description: `AI-generated concept rendering for the ${request.roomName.toLowerCase()}, generated from the client's uploaded photo with a ${request.style.toLowerCase()} direction. This is an illustrative visualisation, not a precise architectural drawing or construction specification — scope, measurements and materials must still be confirmed on site.`,
        keyChanges: [
          "Generated from the client's actual room photo",
          "Architectural structure preserved; finishes, furniture and lighting restyled",
        ],
        provider: "openai",
        status: "generated",
      });
    });

    if (results.length === 0) {
      throw new Error("OpenAI returned image entries with no usable image data.");
    }

    return results;
  }
}

async function describeOpenAIError(response: Response): Promise<string> {
  const bodyText = await response.text().catch(() => "");
  let message = bodyText || response.statusText;
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string; code?: string; type?: string } };
    if (parsed.error?.message) message = parsed.error.message;
    if (parsed.error?.code === "content_policy_violation") {
      return "OpenAI declined to generate this image because the request or reference photo was flagged by its content policy. Try a different photo or a less explicit instruction.";
    }
    if (parsed.error?.type === "insufficient_quota" || parsed.error?.code === "billing_hard_limit_reached") {
      return "OpenAI image generation is unavailable: the configured account has hit its billing/usage limit.";
    }
  } catch {
    // body wasn't JSON — fall through with the raw text/status.
  }

  if (response.status === 429) {
    return `OpenAI rate-limited this request: ${message}. Please wait a moment and try again.`;
  }
  if (response.status === 401 || response.status === 403) {
    return "OpenAI rejected the configured API key. Check OPENAI_API_KEY.";
  }
  if (response.status === 413) {
    return "The reference photo is too large for OpenAI's image-edit endpoint. Try a smaller photo.";
  }
  return `OpenAI image request failed (${response.status}): ${message}`;
}

function extensionForContentType(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

async function fetchImageBytes(url: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  if (url.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.*)$/.exec(url);
    if (!match) throw new Error("Unsupported data URL for reference photo.");
    const buffer = Buffer.from(match[2], "base64");
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer;
    return { bytes: arrayBuffer, contentType: match[1] };
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch reference photo (${response.status}).`);
  }
  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "image/jpeg",
  };
}
