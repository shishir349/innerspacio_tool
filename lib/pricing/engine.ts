import type {
  EstimateCalculationInput,
  EstimateCalculationResult,
  EstimateLineItem,
} from "@/lib/types";

export class PricingEngineError extends Error {}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new PricingEngineError(`${label} must be a finite number.`);
  }
}

function assertNonNegative(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) {
    throw new PricingEngineError(`${label} must not be negative.`);
  }
}

function assertPercent(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0 || value >= 100) {
    throw new PricingEngineError(`${label} must be between 0 and 100 (exclusive of 100).`);
  }
}

/**
 * Deterministic estimate calculation.
 *
 * Direct cost = sum(quantity * baseCostPerUnit) + additional direct costs
 * Contingency = directCost * contingencyPercent
 * Cost basis = directCost + contingency
 * Target selling subtotal (pre-GST) = costBasis / (1 - targetGrossMarginPercent)
 * Gross profit = targetSellingSubtotal - costBasis
 * Actual gross margin = grossProfit / targetSellingSubtotal
 * GST = targetSellingSubtotal * gstPercent
 * Total client estimate = targetSellingSubtotal + GST
 *
 * Margin is calculated exclusive of GST. A target gross margin is not a markup:
 * a 40% margin on a cost basis of 100 means selling price 166.67, not 140.
 */
export function calculateEstimate(
  input: EstimateCalculationInput
): EstimateCalculationResult {
  const {
    lineItems,
    additionalCosts,
    contingencyPercent,
    targetGrossMarginPercent,
    gstPercent,
  } = input;

  assertPercent(contingencyPercent, "Contingency percent");
  assertPercent(targetGrossMarginPercent, "Target gross margin percent");
  assertFinite(gstPercent, "GST percent");
  if (gstPercent < 0) {
    throw new PricingEngineError("GST percent must not be negative.");
  }

  const resolvedLineItems: EstimateLineItem[] = lineItems.map((item) => {
    assertNonNegative(item.quantity, `Quantity for "${item.name}"`);
    assertNonNegative(item.baseCostPerUnit, `Base cost per unit for "${item.name}"`);
    const lineDirectCost = round2(item.quantity * item.baseCostPerUnit);
    return {
      id: cryptoRandomId(),
      ...item,
      lineDirectCost,
    };
  });

  additionalCosts.forEach((cost) =>
    assertNonNegative(cost.amount, `Additional cost "${cost.label}"`)
  );

  const lineItemsTotal = round2(
    resolvedLineItems.reduce((sum, item) => sum + item.lineDirectCost, 0)
  );
  const additionalCostsTotal = round2(
    additionalCosts.reduce((sum, cost) => sum + cost.amount, 0)
  );

  const directCost = round2(lineItemsTotal + additionalCostsTotal);

  const contingencyFraction = contingencyPercent / 100;
  const contingencyAmount = round2(directCost * contingencyFraction);

  const costBasis = round2(directCost + contingencyAmount);

  const marginFraction = targetGrossMarginPercent / 100;
  const marginDenominator = 1 - marginFraction;
  if (marginDenominator <= 0) {
    throw new PricingEngineError(
      "Target gross margin percent must be less than 100 to avoid division by zero."
    );
  }

  const targetSellingSubtotal = round2(costBasis / marginDenominator);
  const grossProfit = round2(targetSellingSubtotal - costBasis);
  const actualGrossMarginPercent =
    targetSellingSubtotal === 0 ? 0 : round2((grossProfit / targetSellingSubtotal) * 100);

  const gstFraction = gstPercent / 100;
  const gstAmount = round2(targetSellingSubtotal * gstFraction);
  const totalClientEstimate = round2(targetSellingSubtotal + gstAmount);

  const result: EstimateCalculationResult = {
    lineItems: resolvedLineItems,
    additionalCosts,
    directCost,
    contingencyPercent,
    contingencyAmount,
    costBasis,
    targetGrossMarginPercent,
    targetSellingSubtotal,
    grossProfit,
    actualGrossMarginPercent,
    gstPercent,
    gstAmount,
    totalClientEstimate,
  };

  assertFinite(result.totalClientEstimate, "Total client estimate");
  return result;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function cryptoRandomId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `line_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}
