import "server-only";
import { isAnthropicConfigured } from "@/lib/config";
import { isManusConfigured } from "@/lib/ai/manus";

export type BoqProvider = "manus" | "anthropic";

/** BOQ_AI_PROVIDER wins; otherwise Manus when its key exists, else Anthropic. */
export function getBoqProvider(): BoqProvider | null {
  const pref = process.env.BOQ_AI_PROVIDER;
  if (pref === "manus" && isManusConfigured()) return "manus";
  if (pref === "anthropic" && isAnthropicConfigured()) return "anthropic";
  if (isManusConfigured()) return "manus";
  if (isAnthropicConfigured()) return "anthropic";
  return null;
}
