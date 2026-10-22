import { pricingVersion } from "@/lib/boq/provenance";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { enforceRateLimit, RateLimitedError } from "@/lib/rate-limit";
import { quantify, quantifyRequestSchema } from "@/lib/boq/brief";
import { summarizeBoq } from "@/lib/boq/build";

// Staff-only, free (no AI): recompute quantities after the designer corrects room sizes.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized. Please sign in.", code: "unauthorized" }, { status: 401 });
  }
  try {
    await enforceRateLimit(`boq-quantify:${user.id}`, { limit: 120, windowSeconds: 3600 });
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return NextResponse.json({ error: "Too many recalculations. Please wait.", code: "rate_limited" }, { status: 429 });
    }
    throw error;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "invalid" }, { status: 400 });
  }
  const parsed = quantifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "invalid" },
      { status: 400 }
    );
  }
  const { lines, warnings, coverage } = quantify(parsed.data.items, parsed.data.rooms, {
    tier: parsed.data.tier,
    city: parsed.data.city,
    sheet: parsed.data.sheet,
  });
  return NextResponse.json({ lines, summary: summarizeBoq(lines), warnings, coverage, pricingVersion: pricingVersion() });
}
