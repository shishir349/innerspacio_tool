import "server-only";
import type {
  ConceptGenerationRequest,
  GeneratedConceptResult,
  ImageGenerationProvider,
} from "@/lib/image-gen/types";
import { MAX_VARIANTS_PER_REQUEST } from "@/lib/image-gen/types";

const STABILITY_ENDPOINT =
  "https://api.stability.ai/v2beta/stable-image/control/structure";

/**
 * Real image-generation provider using Stability AI's structure-control
 * endpoint, which transforms an input image while preserving its structure —
 * matching the requirement to use the room photo as a reference and
 * preserve architectural features while restyling finishes/furniture/lighting.
 *
 * This endpoint generates one image per request (no native batch `n`
 * parameter like OpenAI's edit endpoint), so multiple variants are produced
 * by issuing sequential requests rather than one batched call — still
 * within the same `ImageGenerationProvider.generateConcepts` contract.
 *
 * Only used when IMAGE_GENERATION_PROVIDER=stability and STABILITY_API_KEY
 * are set. Replace or extend this file to plug in a different provider —
 * the rest of the app only depends on the ImageGenerationProvider interface.
 */
export class StabilityImageGenerationProvider implements ImageGenerationProvider {
  readonly name = "stability";
  readonly isDemo = false;

  async generateConcepts(request: ConceptGenerationRequest): Promise<GeneratedConceptResult[]> {
    const apiKey = process.env.STABILITY_API_KEY;
    if (!apiKey) {
      throw new Error("STABILITY_API_KEY is not configured.");
    }

    const count = Math.max(1, Math.min(request.variantCount, MAX_VARIANTS_PER_REQUEST));
    const referenceImage = await fetchImageBytes(request.referencePhotoUrl);

    const results: GeneratedConceptResult[] = [];
    for (let i = 0; i < count; i++) {
      const result = await generateOne(apiKey, request, referenceImage, i, count);
      results.push(result);
    }
    return results;
  }
}

async function generateOne(
  apiKey: string,
  request: ConceptGenerationRequest,
  referenceImage: { bytes: ArrayBuffer; contentType: string },
  index: number,
  total: number
): Promise<GeneratedConceptResult> {
  const form = new FormData();
  form.append(
    "image",
    new Blob([referenceImage.bytes], { type: referenceImage.contentType }),
    "reference.jpg"
  );
  form.append("prompt", request.brief);
  form.append("output_format", "png");
  form.append("control_strength", "0.55");
  // Vary the seed-adjacent control slightly per variant so repeated calls
  // for the same brief don't just return the same image N times.
  if (total > 1) {
    form.append("seed", String((Date.now() + index * 7919) % 4294967295));
  }

  const response = await fetch(STABILITY_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "image/*",
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    if (response.status === 429) {
      throw new Error(`Stability AI rate-limited this request. Please wait a moment and try again.`);
    }
    throw new Error(
      `Stability AI request failed (${response.status}): ${errorText || response.statusText}`
    );
  }

  const imageBuffer = Buffer.from(await response.arrayBuffer());
  const imageUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
  const variantSuffix = total > 1 ? ` — Variant ${index + 1}` : "";

  return {
    imageUrl,
    title: `${request.style} Concept${variantSuffix}`,
    style: request.style,
    description: `AI-generated concept rendering for the ${request.roomName.toLowerCase()}, generated from the client's uploaded photo with a ${request.style.toLowerCase()} direction. This is an illustrative visualisation, not a precise architectural drawing or construction specification — scope, measurements and materials must still be confirmed on site.`,
    keyChanges: [
      "Generated from the client's actual room photo",
      "Architectural structure preserved; finishes, furniture and lighting restyled",
    ],
    provider: "stability",
    status: "generated",
  };
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
