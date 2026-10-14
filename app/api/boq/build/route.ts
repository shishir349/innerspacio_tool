import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildBoq, summarizeBoq, type BoqInput } from "@/lib/boq/build";
import { loadLeadSpec } from "@/lib/boq/lead";
import { buildRequestSchema } from "@/lib/boq/schema";
import { TIER_INFO } from "@/lib/quote/constants";

// Staff-only: generate an editable BOQ from a home spec or a stored lead.
export async function POST(request: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized. Please sign in.", code: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "invalid" }, { status: 400 });
  }
  const parsed = buildRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "invalid" },
      { status: 400 }
    );
  }

  let input: BoqInput;
  let client = "";
  if ("leadId" in parsed.data) {
    const lead = await loadLeadSpec(parsed.data.leadId);
    if (!lead) return NextResponse.json({ error: "Lead not found.", code: "not_found" }, { status: 404 });
    input = lead.input;
    client = lead.client;
  } else {
    input = parsed.data as BoqInput;
  }

  const lines = buildBoq(input);
  return NextResponse.json({
    input,
    client,
    specification: `${TIER_INFO[input.tier].label} specification`,
    lines,
    summary: summarizeBoq(lines),
  });
}
