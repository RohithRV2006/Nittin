"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemCategory, UnitType } from "@prisma/client";
import Decimal from "decimal.js";
import { submitProductionRunAction } from "@/actions/production.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR, money, qty, toDec } from "@/lib/decimal";
import { computeRunCosting, computeVariance } from "@/lib/engines/production";
import { convertUnit } from "@/lib/units";

export interface RunBomOption {
  id: string;
  name: string;
  finishedItemName: string;
  finishedUnit: UnitType;
  sellingPrice: string | null;
  batchSizeOutput: string;
  tolerancePercent: string;
  items: Array<{
    itemId: string;
    code: string;
    name: string;
    category: ItemCategory;
    baseUnit: UnitType;
    unitsPerCarton: number | null;
    standardQty: string;
    bomUnit: UnitType;
    availableStock: string;
    openBatches: Array<{ remainingQty: string; unitRate: string }>;
  }>;
}

export interface ExistingRunData {
  runId: string;
  runNumber: string;
  bomId: string;
  batchMultiplier: string;
  runDate: string;
  labourCost: string;
  powerGasCost: string;
  notes: string;
  consumptions: Array<{
    itemId: string;
    actualIssuedQty: string;
    scrapDamagedQty: string;
  }>;
}

interface LineState {
  itemId: string;
  actualIssuedQty: string;
  inputUnit: UnitType;
  scrapDamagedQty: string;
}

function getCompatibleUnits(baseUnit: UnitType, unitsPerCarton: number | null): UnitType[] {
  if (baseUnit === "KG" || baseUnit === "GRAM") {
    return ["KG", "GRAM"];
  }
  if (baseUnit === "LITRE" || baseUnit === "ML") {
    return ["LITRE", "ML"];
  }
  if (
    (baseUnit === "PIECE" || baseUnit === "PACKET") &&
    unitsPerCarton &&
    unitsPerCarton > 0
  ) {
    return [baseUnit, "CARTON"];
  }
  return [baseUnit];
}

function estimateFifoCost(
  batches: Array<{ remainingQty: string; unitRate: string }>,
  baseQty: Decimal
): Decimal {
  let rem = baseQty;
  let cost = money(0);
  for (const b of batches) {
    if (rem.lte(0)) break;
    const avail = toDec(b.remainingQty);
    const take = Decimal.min(avail, rem);
    cost = money(cost.plus(take.mul(b.unitRate)));
    rem = rem.minus(take);
  }
  // If requested exceeds current open batches, extrapolate at last batch rate for preview
  if (rem.gt(0) && batches.length > 0) {
    const lastRate = batches[batches.length - 1].unitRate;
    cost = money(cost.plus(rem.mul(lastRate)));
  }
  return cost;
}

const inputCls =
  "h-11 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-base text-[#0F172A] outline-none focus:border-[#047857] focus:ring-2 focus:ring-[#047857]/20 sm:text-sm";
const labelCls = "mb-1 block text-xs font-medium text-[#475569]";

export function ProductionRunWorkspace({
  boms,
  initialBomId,
  initialMultiplier,
  existingRun,
}: {
  boms: RunBomOption[];
  initialBomId: string;
  initialMultiplier: string;
  existingRun: ExistingRunData | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [bomId, setBomId] = useState(existingRun?.bomId ?? initialBomId);
  const selectedBom = useMemo(
    () => boms.find((b) => b.id === bomId) ?? boms[0],
    [boms, bomId]
  );

  const [multiplier, setMultiplier] = useState(
    existingRun?.batchMultiplier ?? initialMultiplier
  );
  const [runDate, setRunDate] = useState(
    existingRun?.runDate ?? new Date().toISOString().slice(0, 10)
  );
  const [actualOutput, setActualOutput] = useState(
    selectedBom
      ? toDec(selectedBom.batchSizeOutput)
          .mul(toDec(existingRun?.batchMultiplier ?? initialMultiplier))
          .toFixed(0)
      : "0"
  );
  const [labourCost, setLabourCost] = useState(existingRun?.labourCost ?? "0");
  const [powerGasCost, setPowerGasCost] = useState(existingRun?.powerGasCost ?? "0");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState(existingRun?.notes ?? "");

  const buildInitialLines = (
    bom: RunBomOption | undefined,
    mult: string
  ): LineState[] => {
    if (!bom) return [];
    const m = toDec(mult || 1);
    return bom.items.map((item) => {
      const existing = existingRun?.consumptions.find(
        (c) => c.itemId === item.itemId
      );
      return {
        itemId: item.itemId,
        actualIssuedQty: existing
          ? existing.actualIssuedQty
          : toDec(item.standardQty).mul(m).toFixed(3),
        inputUnit: existing ? item.baseUnit : item.bomUnit,
        scrapDamagedQty: existing ? existing.scrapDamagedQty : "0",
      };
    });
  };

  const [lines, setLines] = useState<LineState[]>(() =>
    buildInitialLines(selectedBom, existingRun?.batchMultiplier ?? initialMultiplier)
  );

  const handleBomOrMultiplierChange = (nextBomId: string, nextMult: string) => {
    setBomId(nextBomId);
    setMultiplier(nextMult);
    const nextBom = boms.find((b) => b.id === nextBomId);
    if (nextBom) {
      const m = toDec(nextMult || 1);
      setActualOutput(toDec(nextBom.batchSizeOutput).mul(m).toFixed(0));
      setLines(
        nextBom.items.map((item) => ({
          itemId: item.itemId,
          actualIssuedQty: toDec(item.standardQty).mul(m).toFixed(3),
          inputUnit: item.bomUnit,
          scrapDamagedQty: "0",
        }))
      );
    }
  };

  const liveMetrics = useMemo(() => {
    if (!selectedBom) return null;
    const m = toDec(multiplier || 1);
    const tolerance = toDec(selectedBom.tolerancePercent);
    const plannedOutput = qty(toDec(selectedBom.batchSizeOutput).mul(m));
    const yieldVar = computeVariance(plannedOutput, actualOutput || 0, tolerance);

    let rawCost = money(0);
    let packCost = money(0);
    const lineDetails = selectedBom.items.map((item) => {
      const line = lines.find((l) => l.itemId === item.itemId) ?? {
        itemId: item.itemId,
        actualIssuedQty: "0",
        inputUnit: item.bomUnit,
        scrapDamagedQty: "0",
      };

      let plannedBase = qty(0);
      let issuedBase = qty(0);
      try {
        plannedBase = convertUnit(
          toDec(item.standardQty).mul(m),
          item.bomUnit,
          item.baseUnit,
          { unitsPerCarton: item.unitsPerCarton }
        );
        issuedBase = convertUnit(
          line.actualIssuedQty || 0,
          line.inputUnit,
          item.baseUnit,
          { unitsPerCarton: item.unitsPerCarton }
        );
      } catch {
        // Fallback if mid-edit
      }

      const variance = computeVariance(plannedBase, issuedBase, tolerance);
      const estCost = estimateFifoCost(item.openBatches, issuedBase);
      if (item.category === "PACKAGING") {
        packCost = money(packCost.plus(estCost));
      } else {
        rawCost = money(rawCost.plus(estCost));
      }

      return {
        item,
        line,
        plannedBase,
        issuedBase,
        variance,
        estCost,
      };
    });

    const costing = computeRunCosting({
      totalMaterialCost: money(rawCost.plus(packCost)),
      labourCost: labourCost || 0,
      powerGasCost: powerGasCost || 0,
      actualOutput: actualOutput || 0,
      sellingPrice: selectedBom.sellingPrice,
    });

    return {
      plannedOutput,
      yieldVar,
      rawCost,
      packCost,
      lineDetails,
      costing,
    };
  }, [selectedBom, multiplier, actualOutput, labourCost, powerGasCost, lines]);

  const submitMode = (mode: "COMPLETE_NOW" | "START_RUN" | "COMPLETE_EXISTING") => {
    if (!selectedBom) return;
    setError(null);
    startTransition(async () => {
      const res = await submitProductionRunAction({
        runId: existingRun?.runId,
        bomId: selectedBom.id,
        mode,
        batchMultiplier: multiplier,
        runDate,
        actualOutput: mode === "START_RUN" ? 0 : actualOutput,
        labourCost,
        powerGasCost,
        expiryDate,
        notes,
        consumptions: lines.map((l) => ({
          itemId: l.itemId,
          actualIssuedQty: l.actualIssuedQty || 0,
          inputUnit: l.inputUnit,
          scrapDamagedQty: l.scrapDamagedQty || 0,
        })),
      });

      if (!res.ok) {
        setError(res.error ?? "Failed to record production run");
        return;
      }

      router.push("/production");
      router.refresh();
    });
  };

  if (!selectedBom || !liveMetrics) {
    return (
      <div className="space-y-6">
        <PageHeader title="Daily Batch Run" />
        <InlineAlert variant="warning" title="No Active BOM Recipes">
          Create at least one BOM recipe under Production → BOM Recipes before logging a run.
        </InlineAlert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          existingRun
            ? `Complete Batch Run — ${existingRun.runNumber}`
            : "Daily Batch Run & Scrap Logger"
        }
        subtitle="Record raw material & packaging consumption, good yield, scrap, and batch overheads"
      />

      {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Worksheet */}
        <div className="space-y-5 lg:col-span-8">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-[#0F172A]">
              1. Recipe & Batch Size
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className={labelCls}>BOM Recipe</label>
                <select
                  className={inputCls}
                  disabled={Boolean(existingRun)}
                  value={bomId}
                  onChange={(e) =>
                    handleBomOrMultiplierChange(e.target.value, multiplier)
                  }
                >
                  {boms.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.batchSizeOutput} {b.finishedUnit}/batch)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Batch Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  disabled={Boolean(existingRun)}
                  className={`${inputCls} tabular-nums`}
                  value={multiplier}
                  onChange={(e) =>
                    handleBomOrMultiplierChange(bomId, e.target.value)
                  }
                />
              </div>
              <div>
                <label className={labelCls}>Run Date</label>
                <input
                  type="date"
                  disabled={Boolean(existingRun)}
                  className={inputCls}
                  value={runDate}
                  onChange={(e) => setRunDate(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Expected Output</label>
                <div className="flex h-11 items-center rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-sm font-semibold tabular-nums">
                  {liveMetrics.plannedOutput.toFixed(0)} {selectedBom.finishedUnit}
                </div>
              </div>
              <div>
                <label className={labelCls}>Actual Good Output</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  inputMode="decimal"
                  className={`${inputCls} tabular-nums font-semibold`}
                  value={actualOutput}
                  onChange={(e) => setActualOutput(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs">
              <span className="text-[#475569]">
                Yield Variance (Tolerance ±{selectedBom.tolerancePercent}%):{" "}
                <strong
                  className={`tabular-nums ${
                    liveMetrics.yieldVar.flagged
                      ? "text-[#B91C1C]"
                      : "text-[#15803D]"
                  }`}
                >
                  {liveMetrics.yieldVar.variancePercent.toFixed(2)}%
                </strong>
              </span>
              <StatusBadge
                status={liveMetrics.yieldVar.flagged ? "FLAGGED" : "NORMAL"}
              />
            </div>
          </div>

          {/* Consumption Table */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-[#0F172A]">
              2. Raw Materials & Packaging Consumption
            </h2>
            <div className="space-y-3">
              {liveMetrics.lineDetails.map(
                ({ item, line, plannedBase, variance, estCost }) => {
                  const units = getCompatibleUnits(
                    item.baseUnit,
                    item.unitsPerCarton
                  );
                  const isPackaging = item.category === "PACKAGING";

                  return (
                    <div
                      key={item.itemId}
                      className={`rounded-lg border p-3.5 ${
                        variance.flagged
                          ? "border-[#FECACA] bg-[#FEF2F2]/40"
                          : "border-[#E2E8F0] bg-[#F8FAFC]"
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-semibold text-[#0F172A]">
                            {item.name}
                          </span>{" "}
                          <span className="font-mono text-xs text-[#64748B]">
                            ({item.code})
                          </span>
                          <p className="text-xs text-[#475569] tabular-nums">
                            Planned: <strong>{plannedBase.toFixed(3)} {item.baseUnit}</strong>{" "}
                            • Available: {item.availableStock} {item.baseUnit} • Est. FIFO:{" "}
                            {formatINR(estCost)}
                          </p>
                        </div>
                        <StatusBadge
                          status={variance.flagged ? "FLAGGED" : "NORMAL"}
                          customLabel={`${variance.variancePercent.gt(0) ? "+" : ""}${variance.variancePercent.toFixed(2)}%`}
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div>
                          <label className={labelCls}>
                            Total Issued Qty {isPackaging ? "(Good + Scrap)" : ""}
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            inputMode="decimal"
                            className={`${inputCls} tabular-nums`}
                            value={line.actualIssuedQty}
                            onChange={(e) => {
                              setLines(
                                lines.map((l) =>
                                  l.itemId === item.itemId
                                    ? { ...l, actualIssuedQty: e.target.value }
                                    : l
                                )
                              );
                            }}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Input Unit</label>
                          <select
                            className={inputCls}
                            value={line.inputUnit}
                            onChange={(e) => {
                              setLines(
                                lines.map((l) =>
                                  l.itemId === item.itemId
                                    ? { ...l, inputUnit: e.target.value as UnitType }
                                    : l
                                )
                              );
                            }}
                          >
                            {units.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </div>
                        {isPackaging ? (
                          <div>
                            <label className={labelCls}>
                              Damaged / Scrap (Subset)
                            </label>
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              inputMode="decimal"
                              className={`${inputCls} tabular-nums`}
                              value={line.scrapDamagedQty}
                              onChange={(e) => {
                                setLines(
                                  lines.map((l) =>
                                    l.itemId === item.itemId
                                      ? { ...l, scrapDamagedQty: e.target.value }
                                      : l
                                  )
                                );
                              }}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Overheads & Expiry */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-[#0F172A]">
              3. Direct Overheads & Finished Batch Details
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Direct Labour Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className={`${inputCls} tabular-nums`}
                  value={labourCost}
                  onChange={(e) => setLabourCost(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Power & Gas Cost (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className={`${inputCls} tabular-nums`}
                  value={powerGasCost}
                  onChange={(e) => setPowerGasCost(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Batch Best-Before (optional)</label>
                <input
                  type="date"
                  className={inputCls}
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <label className={labelCls}>Floor Notes (optional)</label>
                <input
                  className={inputCls}
                  placeholder="Shift supervisor notes or wastage remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Sticky Costing Preview */}
        <div className="lg:col-span-4">
          <div className="sticky top-20 space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Live Costing & Margin Preview
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#475569]">Raw Materials (FIFO)</dt>
                <dd className="tabular-nums font-medium">
                  {formatINR(liveMetrics.rawCost)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#475569]">Packaging (Good + Scrap)</dt>
                <dd className="tabular-nums font-medium">
                  {formatINR(liveMetrics.packCost)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#475569]">Direct Overheads</dt>
                <dd className="tabular-nums font-medium">
                  {formatINR(liveMetrics.costing.totalOverheads)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-[#E2E8F0] pt-2 text-base font-semibold">
                <dt>Total Run Cost</dt>
                <dd className="tabular-nums">
                  {formatINR(liveMetrics.costing.totalRunCost)}
                </dd>
              </div>
              <div className="flex justify-between rounded-lg bg-[#ECFDF5] px-3 py-2 font-semibold text-[#047857]">
                <dt>Cost / Good Packet</dt>
                <dd className="tabular-nums">
                  {liveMetrics.costing.costPerPacket
                    ? formatINR(liveMetrics.costing.costPerPacket)
                    : "N/A (0 yield)"}
                </dd>
              </div>
              {liveMetrics.costing.unitGrossProfit &&
              liveMetrics.costing.grossMarginPercent ? (
                <div className="flex justify-between text-xs text-[#475569]">
                  <dt>Gross Margin (vs ₹{selectedBom.sellingPrice})</dt>
                  <dd className="tabular-nums font-semibold text-[#15803D]">
                    {formatINR(liveMetrics.costing.unitGrossProfit)} (
                    {liveMetrics.costing.grossMarginPercent.toFixed(1)}%)
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="space-y-2 pt-2">
              {existingRun ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => submitMode("COMPLETE_EXISTING")}
                  className="h-11 w-full rounded-lg bg-[#047857] text-sm font-semibold text-white hover:bg-[#065F46] disabled:opacity-60"
                >
                  {isPending
                    ? "Committing Stock..."
                    : "Complete Run & Credit Finished Stock"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => submitMode("COMPLETE_NOW")}
                    className="h-11 w-full rounded-lg bg-[#047857] text-sm font-semibold text-white hover:bg-[#065F46] disabled:opacity-60"
                  >
                    {isPending
                      ? "Committing Stock..."
                      : "Save Production Run & Commit Stock"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => submitMode("START_RUN")}
                    className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#0F172A] hover:bg-[#F1F5F9] disabled:opacity-60"
                  >
                    Start Run Now (Issue Materials Only)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
