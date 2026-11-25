import Decimal from "decimal.js";
import { money, percent, qty, toDec, type DecimalInput } from "@/lib/decimal";

export interface VarianceResult {
  variancePercent: Decimal;
  flagged: boolean;
}

/**
 * Computes percentage variance: ((actual - planned) / planned) * 100.
 * Flags whenever |variancePercent| > tolerancePercent.
 */
export function computeVariance(
  plannedInput: DecimalInput,
  actualInput: DecimalInput,
  toleranceInput: DecimalInput
): VarianceResult {
  const planned = qty(plannedInput);
  const actual = qty(actualInput);
  const tolerance = percent(toleranceInput);

  if (planned.lte(0)) {
    return { variancePercent: percent(0), flagged: false };
  }

  const variancePercent = percent(
    actual.minus(planned).div(planned).mul(100)
  );
  const flagged = variancePercent.abs().gt(tolerance);

  return { variancePercent, flagged };
}

export interface RunCostingResult {
  totalMaterialCost: Decimal;
  totalOverheads: Decimal;
  totalRunCost: Decimal;
  costPerPacket: Decimal | null;
  unitGrossProfit: Decimal | null;
  grossMarginPercent: Decimal | null;
}

/**
 * Computes total batch cost, cost per marketable good packet (with zero-yield guard),
 * and unit gross margin against selling price.
 */
export function computeRunCosting(params: {
  totalMaterialCost: DecimalInput;
  labourCost: DecimalInput;
  powerGasCost: DecimalInput;
  actualOutput: DecimalInput;
  sellingPrice?: DecimalInput | null;
}): RunCostingResult {
  const totalMaterialCost = money(params.totalMaterialCost);
  const labourCost = money(params.labourCost);
  const powerGasCost = money(params.powerGasCost);
  const totalOverheads = money(labourCost.plus(powerGasCost));
  const totalRunCost = money(totalMaterialCost.plus(totalOverheads));
  const actualOutput = qty(params.actualOutput);

  if (actualOutput.lte(0)) {
    return {
      totalMaterialCost,
      totalOverheads,
      totalRunCost,
      costPerPacket: null,
      unitGrossProfit: null,
      grossMarginPercent: null,
    };
  }

  const costPerPacket = money(totalRunCost.div(actualOutput));

  if (params.sellingPrice === null || params.sellingPrice === undefined) {
    return {
      totalMaterialCost,
      totalOverheads,
      totalRunCost,
      costPerPacket,
      unitGrossProfit: null,
      grossMarginPercent: null,
    };
  }

  const sellingPrice = money(params.sellingPrice);
  if (sellingPrice.lte(0)) {
    return {
      totalMaterialCost,
      totalOverheads,
      totalRunCost,
      costPerPacket,
      unitGrossProfit: null,
      grossMarginPercent: null,
    };
  }

  const unitGrossProfit = money(sellingPrice.minus(costPerPacket));
  const grossMarginPercent = percent(unitGrossProfit.div(sellingPrice).mul(100));

  return {
    totalMaterialCost,
    totalOverheads,
    totalRunCost,
    costPerPacket,
    unitGrossProfit,
    grossMarginPercent,
  };
}

/**
 * Calculates recommended production batches to satisfy pending demand deficit.
 */
export function computeRecommendedBatches(
  pendingOrderedQty: DecimalInput,
  availableFinishedStock: DecimalInput,
  batchSizeOutput: DecimalInput
): { deficit: Decimal; recommendedBatches: number } {
  const ordered = qty(pendingOrderedQty);
  const available = qty(availableFinishedStock);
  const batchSize = qty(batchSizeOutput);

  const rawDeficit = ordered.minus(available);
  const deficit = rawDeficit.gt(0) ? qty(rawDeficit) : qty(0);

  if (deficit.lte(0) || batchSize.lte(0)) {
    return { deficit, recommendedBatches: 0 };
  }

  const batches = toDec(deficit).div(batchSize).ceil().toNumber();
  return { deficit, recommendedBatches: batches };
}
