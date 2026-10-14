import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/config";
import { clientIp } from "@/lib/supabase/middleware";
import { createLeadSchema } from "@/lib/quote/schema";
import { createLead } from "@/lib/leads/service";

// Public, unauthenticated: creates a lead and returns its token once.
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "This feature needs the database configured.", code: "unavailable" },
      { status: 503 }
    );
  }

  const ip = clientIp(request);
  try {
    await enforceRateLimit(`quote-create:${ip}`, { limit: 5, windowSeconds: 3600 });
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

  // Honeypot: pretend success so bots learn nothing, but create nothing.
  if (typeof (body as { website?: unknown })?.website === "string" && (body as { website: string }).website) {
    return NextResponse.json({ token: "x".repeat(43), rooms: [], estimate: null });
  }

  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "invalid" },
      { status: 400 }
    );
  }

  try {
    const lead = await createLead(parsed.data, ip);
    return NextResponse.json(lead);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong.", code: "server_error" },
      { status: 500 }
    );
  }
}
