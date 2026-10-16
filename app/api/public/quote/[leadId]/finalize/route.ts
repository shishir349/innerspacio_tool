import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/config";
import { clientIp } from "@/lib/supabase/middleware";
import { finalizeLeadSchema } from "@/lib/quote/schema";
import { finalizeLead, resolveLead } from "@/lib/leads/service";

// Public, token-gated: attaches contact details + consent to a draft lead.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Unavailable.", code: "unavailable" }, { status: 503 });
  }
  const { leadId } = await params;

  const token = request.headers.get("x-quote-token") ?? "";
  const lead = token ? await resolveLead(token) : null;
  if (!lead || lead.id !== leadId) {
    return NextResponse.json({ error: "Not found.", code: "not_found" }, { status: token ? 404 : 401 });
  }

  try {
    await enforceRateLimit(`quote-finalize:${clientIp(request)}`, { limit: 10, windowSeconds: 3600 });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json({ error: "Too many requests.", code: "rate_limited" }, { status: 429 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request.", code: "invalid" }, { status: 400 });
  }

  // Honeypot: pretend success, store nothing.
  if (typeof (body as { website?: unknown })?.website === "string" && (body as { website: string }).website) {
    return NextResponse.json({ ok: true, estimate: null, tiers: [], breakdown: null });
  }

  const parsed = finalizeLeadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "invalid" },
      { status: 400 }
    );
  }

  try {
    const quote = await finalizeLead(lead, parsed.data);
    return NextResponse.json({ ok: true, ...quote });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong.", code: "server_error" },
      { status: 500 }
    );
  }
}
