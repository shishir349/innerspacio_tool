import { isSupabaseConfigured, isAnthropicConfigured, isImageGenerationConfigured } from "@/lib/config";
import { Info } from "lucide-react";

export function DemoModeBanner() {
  const supabase = isSupabaseConfigured();
  const anthropic = isAnthropicConfigured();
  const imageGen = isImageGenerationConfigured();

  if (supabase && anthropic && imageGen) return null;

  const missing: string[] = [];
  if (!supabase) missing.push("database & storage (Supabase)");
  if (!anthropic) missing.push("AI room analysis (Claude)");
  if (!imageGen) missing.push("real concept image generation");

  return (
    <div className="flex items-start gap-2.5 border-b border-border bg-secondary/60 px-4 py-2.5 text-xs text-secondary-foreground md:px-8">
      <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <p>
        <span className="font-medium">Demo mode.</span> Running with sample data — {missing.join(", ")}{" "}
        {missing.length === 1 ? "is" : "are"} not configured. See the README for setup. Data you
        create here is saved locally for this environment only.
      </p>
    </div>
  );
}
