// Centralised, server-only checks for which integrations are actually configured.
// The UI and API routes use these to decide between a real integration and a
// clearly labelled demo fallback — never to fake a successful call.

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}

export type ImageGenerationProviderName = "demo" | "stability" | "openai";

export function getImageGenerationProviderName(): ImageGenerationProviderName {
  const configured = process.env.IMAGE_GENERATION_PROVIDER?.toLowerCase();
  if (configured === "stability") return "stability";
  if (configured === "openai") return "openai";
  return "demo";
}

export function isImageGenerationConfigured(): boolean {
  const provider = getImageGenerationProviderName();
  if (provider === "stability") return Boolean(process.env.STABILITY_API_KEY);
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return false;
}

export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}
