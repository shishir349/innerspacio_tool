import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";
import { clientIp } from "@/lib/supabase/middleware";
import { requestConsult, resolveLead } from "@/lib/leads/service";

// Public, token-gated: marks the lead as wanting a free consultation.
export async function POST(request: NextRequest) {
  const token = request.headers.get("x-quote-token") ?? "";
  try {
    await enforceRateLimit(`quote-consult:${clientIp(request)}`, { limit: 10, windowSeconds: 3600 });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json({ error: "Too many requests.", code: "rate_limited" }, { status: 429 });
    }
    throw error;
  }
  const lead = token ? await resolveLead(token) : null;
  if (!lead) return NextResponse.json({ error: "Not found.", code: "not_found" }, { status: 404 });
  await requestConsult(lead);
  return NextResponse.json({ ok: true });
}
