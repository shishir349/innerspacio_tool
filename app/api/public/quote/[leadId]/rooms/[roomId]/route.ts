import { NextResponse, type NextRequest } from "next/server";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/config";
import { clientIp } from "@/lib/supabase/middleware";
import { LeadError, processRoom, resolveLead } from "@/lib/leads/service";

// Image generation can be slow on a shared host; allow it to run.
export const maxDuration = 120;

// Public. The bearer credential is the lead token (x-quote-token header);
// the `leadId` path segment is only a cross-check, never the credential.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string; roomId: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Unavailable.", code: "unavailable" }, { status: 503 });
  }
  const { leadId, roomId } = await params;

  const token = request.headers.get("x-quote-token") ?? "";
  const lead = token ? await resolveLead(token) : null;
  if (!lead) {
    return NextResponse.json({ error: "Not found.", code: "not_found" }, { status: token ? 404 : 401 });
  }
  if (lead.id !== leadId) {
    return NextResponse.json({ error: "Not found.", code: "not_found" }, { status: 404 });
  }

  try {
    await enforceRateLimit(`quote-room-ip:${clientIp(request)}`, { limit: 20, windowSeconds: 3600 });
    await enforceRateLimit(`quote-room-lead:${lead.id}`, { limit: 12, windowSeconds: 3600 });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment.", code: "rate_limited" },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }

  let files: File[];
  try {
    const form = await request.formData();
    files = form.getAll("photos").filter((f): f is File => f instanceof File);
  } catch {
    return NextResponse.json({ error: "Invalid upload.", code: "invalid" }, { status: 400 });
  }

  try {
    const result = await processRoom(lead, roomId, files);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LeadError) {
      const status =
        error.code === "not_found" ? 404 : error.code === "invalid" ? 400 : error.code === "cap_reached" ? 429 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Something went wrong.", code: "server_error" },
      { status: 500 }
    );
  }
}
