import { describe, expect, it } from "vitest";
import { UnitType } from "@prisma/client";
import {
  computeRecommendedBatches,
  computeRunCosting,
  computeVariance,
} from "@/lib/engines/production";
import {
  bomSchema,
  cancelRunSchema,
  cloneBomSchema,
  productionRunInputSchema,
} from "@/lib/validators/phase2";

describe("Phase 2 Production BOM, Variance & Costing Engine", () => {
  it("computes yield and consumption variances and flags breaches beyond tolerance", () => {
    const yieldVar = computeVariance(200, 188, 3);
    expect(yieldVar.variancePercent.toFixed(2)).toBe("-6.00");
    expect(yieldVar.flagged).toBe(true);

    const oilVar = computeVariance(10.0, 10.5, 3);
    expect(oilVar.variancePercent.toFixed(2)).toBe("5.00");
    expect(oilVar.flagged).toBe(true);

    const exactBoundary = computeVariance(200, 194, 3);
    expect(exactBoundary.variancePercent.toFixed(2)).toBe("-3.00");
    expect(exactBoundary.flagged).toBe(false);

    const zeroPlanned = computeVariance(0, 10, 3);
    expect(zeroPlanned.variancePercent.toFixed(2)).toBe("0.00");
    expect(zeroPlanned.flagged).toBe(false);
  });

  it("computes total batch cost, cost per packet, and gross margin accurately", () => {
    // Raw (3390) + Pack (620) = 4010; Labour (1200) + Power/Gas (600) = 1800; Total = 5810
    const res = computeRunCosting({
      totalMaterialCost: "4010.00",
      labourCost: "1200.00",
      powerGasCost: "600.00",
      actualOutput: "188",
      sellingPrice: "50.00",
    });

    expect(res.totalMaterialCost.toFixed(2)).toBe("4010.00");
    expect(res.totalOverheads.toFixed(2)).toBe("1800.00");
    expect(res.totalRunCost.toFixed(2)).toBe("5810.00");
    expect(res.costPerPacket?.toFixed(2)).toBe("30.90");
    expect(res.unitGrossProfit?.toFixed(2)).toBe("19.10");
    expect(res.grossMarginPercent?.toFixed(2)).toBe("38.20");
  });

  it("guards against division by zero when actual good yield is 0", () => {
    const res = computeRunCosting({
      totalMaterialCost: "3390.00",
      labourCost: "1200.00",
      powerGasCost: "600.00",
      actualOutput: "0",
      sellingPrice: "50.00",
    });

    expect(res.totalRunCost.toFixed(2)).toBe("5190.00");
    expect(res.costPerPacket).toBeNull();
    expect(res.unitGrossProfit).toBeNull();
    expect(res.grossMarginPercent).toBeNull();
  });

  it("calculates recommended production batches from pending order deficit", () => {
    const case1 = computeRecommendedBatches(120, 88, 200);
    expect(case1.deficit.toFixed(3)).toBe("32.000");
    expect(case1.recommendedBatches).toBe(1);

    const case2 = computeRecommendedBatches(500, 88, 200);
    expect(case2.deficit.toFixed(3)).toBe("412.000");
    expect(case2.recommendedBatches).toBe(3);

    const case3 = computeRecommendedBatches(50, 88, 200);
    expect(case3.deficit.toFixed(3)).toBe("0.000");
    expect(case3.recommendedBatches).toBe(0);
  });

  it("validates BOM, Clone, Run, and Cancellation schemas", () => {
    expect(
      bomSchema.safeParse({
        finishedItemId: "00000000-0000-4000-8000-000000000001",
        name: "Snack 200g",
        batchSizeOutput: 200,
        tolerancePercent: 3,
        items: [
          {
            itemId: "00000000-0000-4000-8000-000000000002",
            standardQty: 40,
            unit: UnitType.KG,
          },
        ],
      }).success
    ).toBe(true);

    expect(
      cloneBomSchema.safeParse({
        sourceBomId: "00000000-0000-4000-8000-000000000001",
        targetFinishedItemId: "00000000-0000-4000-8000-000000000002",
        name: "Snack 500g",
        scaleFactor: 2.5,
        batchSizeOutput: 80,
      }).success
    ).toBe(true);

    // Rejects scrap > actualIssuedQty
    expect(
      productionRunInputSchema.safeParse({
        bomId: "00000000-0000-4000-8000-000000000001",
        mode: "COMPLETE_NOW",
        batchMultiplier: 1,
        runDate: "2026-11-25",
        actualOutput: 188,
        consumptions: [
          {
            itemId: "00000000-0000-4000-8000-000000000002",
            actualIssuedQty: 5,
            inputUnit: UnitType.PIECE,
            scrapDamagedQty: 6,
          },
        ],
      }).success
    ).toBe(false);

    expect(
      cancelRunSchema.safeParse({
        runId: "00000000-0000-4000-8000-000000000001",
        reason: "no",
      }).success
    ).toBe(false);
  });
});
