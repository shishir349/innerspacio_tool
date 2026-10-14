import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/config";
import { clientIp } from "@/lib/supabase/middleware";
import { draftLeadSchema } from "@/lib/quote/schema";
import { createDraft } from "@/lib/leads/service";

// Public, unauthenticated: creates a draft lead (no personal details) and
// returns its token once. Contact details are attached by /finalize later.
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "This feature needs the database configured.", code: "unavailable" },
      { status: 503 }
    );
  }

  const ip = clientIp(request);
  try {
    // Drafts can trigger paid image generation before any contact capture, so
    // keep this tight; the per-lead and daily caps bound the rest.
    await enforceRateLimit(`quote-create:${ip}`, { limit: 4, windowSeconds: 3600 });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request.", code: "invalid" }, { status: 400 });
  }

  const parsed = draftLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "invalid" },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await createDraft(parsed.data, ip));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong.", code: "server_error" },
      { status: 500 }
    );
  }
}
