import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { calculateEstimate, PricingEngineError } from "@/lib/pricing/engine";
import { RepositoryError } from "@/lib/data/types";

const lineItemSchema = z.object({
  catalogueItemId: z.string(),
  name: z.string().min(1),
  unit: z.string().min(1),
  baseCostPerUnit: z.number().min(0),
  quantity: z.number().min(0),
});

const additionalCostSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  amount: z.number().min(0),
});

const requestSchema = z.object({
  lineItems: z.array(lineItemSchema),
  additionalCosts: z.array(additionalCostSchema).default([]),
  contingencyPercent: z.number().min(0).max(99.99),
  targetGrossMarginPercent: z.number().min(0).max(99.99),
  gstPercent: z.number().min(0),
  conceptId: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; roomId: string }> }
) {
  const { projectId, roomId } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized. Please sign in.", code: "unauthorized" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "invalid" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; "), code: "invalid" },
      { status: 400 }
    );
  }

  try {
    const calculation = calculateEstimate(parsed.data);
    const repo = await getRepository();
    const room = await repo.saveEstimate(projectId, roomId, {
      conceptId: parsed.data.conceptId,
      calculation,
    });
    return NextResponse.json({ room, estimate: room.estimate });
  } catch (error) {
    if (error instanceof PricingEngineError) {
      return NextResponse.json({ error: error.message, code: "invalid_calculation" }, { status: 400 });
    }
    if (error instanceof RepositoryError && error.code === "not_found") {
      return NextResponse.json({ error: error.message, code: "not_found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Could not save the estimate. Please try again.", code: "unknown" },
      { status: 500 }
    );
  }
}
