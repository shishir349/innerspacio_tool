import { describe, expect, it } from "vitest";
import { calculateEstimate, PricingEngineError } from "./engine";
import type { EstimateCalculationInput } from "@/lib/types";

function baseInput(
  overrides: Partial<EstimateCalculationInput> = {}
): EstimateCalculationInput {
  return {
    lineItems: [
      { catalogueItemId: "a", name: "Item A", unit: "sqft", baseCostPerUnit: 100, quantity: 10 },
    ],
    additionalCosts: [],
    contingencyPercent: 0,
    targetGrossMarginPercent: 40,
    gstPercent: 18,
    ...overrides,
  };
}

describe("calculateEstimate", () => {
  it("computes direct cost as sum of quantity * base cost plus additional costs", () => {
    const result = calculateEstimate(
      baseInput({
        lineItems: [
          { catalogueItemId: "a", name: "A", unit: "sqft", baseCostPerUnit: 100, quantity: 10 },
          { catalogueItemId: "b", name: "B", unit: "nos", baseCostPerUnit: 500, quantity: 2 },
        ],
        additionalCosts: [{ id: "x", label: "Site visit", amount: 1000 }],
        contingencyPercent: 0,
      })
    );
    // 10*100 + 2*500 + 1000 = 1000 + 1000 + 1000 = 3000
    expect(result.directCost).toBe(3000);
  });

  it("applies contingency on top of direct cost", () => {
    const result = calculateEstimate(
      baseInput({
        lineItems: [{ catalogueItemId: "a", name: "A", unit: "sqft", baseCostPerUnit: 100, quantity: 10 }],
        contingencyPercent: 10,
      })
    );
    expect(result.directCost).toBe(1000);
    expect(result.contingencyAmount).toBe(100);
    expect(result.costBasis).toBe(1100);
  });

  it("targets a 40% gross margin, not a 40% markup", () => {
    const result = calculateEstimate(
      baseInput({
        lineItems: [{ catalogueItemId: "a", name: "A", unit: "sqft", baseCostPerUnit: 100, quantity: 10 }],
        contingencyPercent: 0,
        targetGrossMarginPercent: 40,
        gstPercent: 0,
      })
    );
    // costBasis = 1000, subtotal = 1000 / 0.6 = 1666.67, NOT 1400 (a 40% markup)
    expect(result.costBasis).toBe(1000);
    expect(result.targetSellingSubtotal).toBeCloseTo(1666.67, 2);
    expect(result.targetSellingSubtotal).not.toBe(1400);
    expect(result.grossProfit).toBeCloseTo(666.67, 2);
    expect(result.actualGrossMarginPercent).toBeCloseTo(40, 1);
  });

  it("calculates GST on the selling subtotal, excluded from the margin calculation", () => {
    const result = calculateEstimate(
      baseInput({
        lineItems: [{ catalogueItemId: "a", name: "A", unit: "sqft", baseCostPerUnit: 100, quantity: 10 }],
        contingencyPercent: 0,
        targetGrossMarginPercent: 40,
        gstPercent: 18,
      })
    );
    expect(result.targetSellingSubtotal).toBeCloseTo(1666.67, 2);
    expect(result.gstAmount).toBeCloseTo(300.0, 1);
    expect(result.totalClientEstimate).toBeCloseTo(1966.67, 1);
    // Margin must be computed excluding GST.
    expect(result.actualGrossMarginPercent).toBeCloseTo(40, 1);
  });

  it("produces itemized line items with per-line direct cost", () => {
    const result = calculateEstimate(
      baseInput({
        lineItems: [
          { catalogueItemId: "a", name: "Tiling", unit: "sqft", baseCostPerUnit: 85, quantity: 120 },
        ],
      })
    );
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].lineDirectCost).toBe(85 * 120);
    expect(result.lineItems[0].id).toBeTruthy();
  });

  it("rejects a negative quantity", () => {
    expect(() =>
      calculateEstimate(
        baseInput({
          lineItems: [{ catalogueItemId: "a", name: "A", unit: "sqft", baseCostPerUnit: 100, quantity: -1 }],
        })
      )
    ).toThrow(PricingEngineError);
  });

  it("rejects a negative base cost per unit", () => {
    expect(() =>
      calculateEstimate(
        baseInput({
          lineItems: [{ catalogueItemId: "a", name: "A", unit: "sqft", baseCostPerUnit: -5, quantity: 1 }],
        })
      )
    ).toThrow(PricingEngineError);
  });

  it("rejects a negative additional cost amount", () => {
    expect(() =>
      calculateEstimate(baseInput({ additionalCosts: [{ id: "x", label: "Bad", amount: -10 }] }))
    ).toThrow(PricingEngineError);
  });

  it("rejects an out-of-range contingency percent", () => {
    expect(() => calculateEstimate(baseInput({ contingencyPercent: -5 }))).toThrow(
      PricingEngineError
    );
    expect(() => calculateEstimate(baseInput({ contingencyPercent: 150 }))).toThrow(
      PricingEngineError
    );
  });

  it("rejects a target gross margin of 100% or more (division by zero guard)", () => {
    expect(() =>
      calculateEstimate(baseInput({ targetGrossMarginPercent: 100 }))
    ).toThrow(PricingEngineError);
    expect(() =>
      calculateEstimate(baseInput({ targetGrossMarginPercent: 140 }))
    ).toThrow(PricingEngineError);
  });

  it("rejects a negative GST percent", () => {
    expect(() => calculateEstimate(baseInput({ gstPercent: -1 }))).toThrow(PricingEngineError);
  });

  it("produces a non-finite-safe, fully finite result for a zero-cost estimate", () => {
    const result = calculateEstimate(
      baseInput({
        lineItems: [],
        additionalCosts: [],
        contingencyPercent: 0,
        targetGrossMarginPercent: 40,
        gstPercent: 18,
      })
    );
    expect(Number.isFinite(result.totalClientEstimate)).toBe(true);
    expect(result.totalClientEstimate).toBe(0);
    expect(result.actualGrossMarginPercent).toBe(0);
  });

  it("handles a realistic multi-line bathroom estimate end to end", () => {
    const result = calculateEstimate({
      lineItems: [
        { catalogueItemId: "tile", name: "Anti-skid floor tiling", unit: "sqft", baseCostPerUnit: 95, quantity: 45 },
        { catalogueItemId: "water", name: "Waterproofing", unit: "sqft", baseCostPerUnit: 60, quantity: 45 },
        { catalogueItemId: "sanitary", name: "Sanitaryware set", unit: "set", baseCostPerUnit: 18000, quantity: 1 },
      ],
      additionalCosts: [{ id: "transport", label: "Transport", amount: 2000 }],
      contingencyPercent: 8,
      targetGrossMarginPercent: 40,
      gstPercent: 18,
    });
    const expectedDirect = 45 * 95 + 45 * 60 + 18000 * 1 + 2000;
    expect(result.directCost).toBe(expectedDirect);
    expect(result.costBasis).toBeCloseTo(expectedDirect * 1.08, 2);
    expect(result.actualGrossMarginPercent).toBeCloseTo(40, 1);
    expect(result.totalClientEstimate).toBeGreaterThan(result.targetSellingSubtotal);
  });
});
