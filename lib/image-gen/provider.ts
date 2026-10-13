import "server-only";
import { getImageGenerationProviderName } from "@/lib/config";
import { DemoImageGenerationProvider } from "@/lib/image-gen/providers/demo-provider";
import { StabilityImageGenerationProvider } from "@/lib/image-gen/providers/stability-provider";
import { OpenAIImageGenerationProvider } from "@/lib/image-gen/providers/openai-provider";
import type { ImageGenerationProvider } from "@/lib/image-gen/types";

export function getImageGenerationProvider(): ImageGenerationProvider {
  const providerName = getImageGenerationProviderName();
  if (providerName === "stability" && process.env.STABILITY_API_KEY) {
    return new StabilityImageGenerationProvider();
  }
  if (providerName === "openai" && process.env.OPENAI_API_KEY) {
    return new OpenAIImageGenerationProvider();
  }
  return new DemoImageGenerationProvider();
}

export type {
  ImageGenerationProvider,
  ConceptGenerationRequest,
  GeneratedConceptResult,
} from "@/lib/image-gen/types";
export { MAX_VARIANTS_PER_REQUEST } from "@/lib/image-gen/types";
