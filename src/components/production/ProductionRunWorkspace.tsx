"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemCategory, UnitType } from "@prisma/client";
import Decimal from "decimal.js";
import { toast } from "sonner";
import { submitProductionRunAction } from "@/actions/production.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR, money, qty, toDec } from "@/lib/decimal";
import { computeRunCosting, computeVariance } from "@/lib/engines/production";
import { formatDisplayQty, isIntegerUnit } from "@/lib/enums";
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
  if (rem.gt(0) && batches.length > 0) {
    const lastRate = batches[batches.length - 1].unitRate;
    cost = money(cost.plus(rem.mul(lastRate)));
  }
  return cost;
}

const inputCls =
  "h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-base text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 sm:text-sm";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-secondary)]";

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
      const unit = existing ? item.baseUnit : item.bomUnit;
      const rawQty = existing
        ? existing.actualIssuedQty
        : toDec(item.standardQty).mul(m).toFixed(3);
      return {
        itemId: item.itemId,
        actualIssuedQty: formatDisplayQty(rawQty, unit),
        inputUnit: unit,
        scrapDamagedQty: existing
          ? formatDisplayQty(existing.scrapDamagedQty, unit)
          : "0",
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
          actualIssuedQty: formatDisplayQty(
            toDec(item.standardQty).mul(m).toFixed(3),
            item.bomUnit
          ),
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
        // mid-edit
      }

      const variance = computeVariance(plannedBase, issuedBase, tolerance);
      const estCost = estimateFifoCost(item.openBatches, issuedBase);
      if (item.category === "PACKAGING") {
        packCost = money(packCost.plus(estCost));
      } else {
        rawCost = money(rawCost.plus(estCost));
      }

      return { item, line, plannedBase, issuedBase, variance, estCost };
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
        toast.error(res.error ?? "Failed to record production run");
        return;
      }

      toast.success(
        `Production Run ${res.data?.runNumber ?? ""} ${
          mode === "START_RUN" ? "started" : "completed & stock updated"
        }.`
      );
      router.push("/production");
      router.refresh();
    });
  };

  if (!selectedBom || !liveMetrics) {
    return (
      <div className="space-y-6">
        <PageHeader title="Daily Batch Run" subtitle="Select a BOM recipe to begin" />
        <InlineAlert variant="warning" title="No Active BOM Recipes">
          Create a recipe under BOM Recipes before logging a run.
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
            : "Daily Batch Run"
        }
        subtitle="Log issued materials, good yield, packaging scrap, and overheads"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
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
                      {b.name} ({formatDisplayQty(b.batchSizeOutput, b.finishedUnit)}{" "}
                      {b.finishedUnit}/batch)
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
                <div className="flex h-11 items-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-sm font-semibold tabular-nums">
                  {liveMetrics.plannedOutput.toFixed(0)} {selectedBom.finishedUnit}
                </div>
              </div>
              <div>
                <label className={labelCls}>Actual Good Output</label>
                <input
                  type="number"
                  step={isIntegerUnit(selectedBom.finishedUnit) ? "1" : "0.001"}
                  min="0"
                  inputMode={
                    isIntegerUnit(selectedBom.finishedUnit) ? "numeric" : "decimal"
                  }
                  className={`${inputCls} tabular-nums font-semibold`}
                  value={actualOutput}
                  onChange={(e) => setActualOutput(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--bg-subtle)] px-3 py-2 text-xs">
              <span className="text-[var(--text-secondary)]">
                Yield Variance (±{selectedBom.tolerancePercent}%):{" "}
                <strong
                  className={`tabular-nums ${
                    liveMetrics.yieldVar.flagged
                      ? "text-[#B91C1C] dark:text-[#F87171]"
                      : "text-[#15803D] dark:text-[#4ADE80]"
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
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
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
                  const wholeUnit = isIntegerUnit(line.inputUnit);

                  return (
                    <div
                      key={item.itemId}
                      className={`rounded-lg border p-3.5 ${
                        variance.flagged
                          ? "border-[#FECACA] bg-[#FEF2F2]/40 dark:border-[#991B1B] dark:bg-[#450A0A]/30"
                          : "border-[var(--border-default)] bg-[var(--bg-subtle)]"
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {item.name}
                          </span>{" "}
                          <span className="font-mono text-xs text-[var(--text-muted)]">
                            ({item.code})
                          </span>
                          <p className="text-xs text-[var(--text-secondary)] tabular-nums">
                            Planned:{" "}
                            <strong>
                              {formatDisplayQty(
                                plannedBase.toFixed(3),
                                item.baseUnit
                              )}{" "}
                              {item.baseUnit}
                            </strong>{" "}
                            • Avail:{" "}
                            {formatDisplayQty(item.availableStock, item.baseUnit)}{" "}
                            {item.baseUnit} • Est. FIFO: {formatINR(estCost)}
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
                            Total Issued {isPackaging ? "(Good + Scrap)" : ""}
                          </label>
                          <input
                            type="number"
                            step={wholeUnit ? "1" : "0.001"}
                            min="0"
                            inputMode={wholeUnit ? "numeric" : "decimal"}
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
                              const nextUnit = e.target.value as UnitType;
                              setLines(
                                lines.map((l) =>
                                  l.itemId === item.itemId
                                    ? {
                                        ...l,
                                        inputUnit: nextUnit,
                                        actualIssuedQty: formatDisplayQty(
                                          l.actualIssuedQty,
                                          nextUnit
                                        ),
                                      }
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
                              step={wholeUnit ? "1" : "0.001"}
                              min="0"
                              inputMode={wholeUnit ? "numeric" : "decimal"}
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

          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
              3. Direct Overheads & Batch Expiry
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
                <label className={labelCls}>Best-Before (optional)</label>
                <input
                  type="date"
                  className={inputCls}
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <label className={labelCls}>Notes (optional)</label>
                <input
                  className={inputCls}
                  placeholder="Shift notes or wastage remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Sticky Costing Preview */}
        <div className="lg:col-span-4">
          <div className="sticky top-20 space-y-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[0_1px_2px_rgba(35,23,15,0.05)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Live Costing & Margin Preview
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--text-secondary)]">Raw Materials (FIFO)</dt>
                <dd className="tabular-nums font-medium">
                  {formatINR(liveMetrics.rawCost)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-secondary)]">Packaging</dt>
                <dd className="tabular-nums font-medium">
                  {formatINR(liveMetrics.packCost)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-secondary)]">Direct Overheads</dt>
                <dd className="tabular-nums font-medium">
                  {formatINR(liveMetrics.costing.totalOverheads)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-[var(--border-default)] pt-2 text-base font-semibold">
                <dt>Total Run Cost</dt>
                <dd className="tabular-nums">
                  {formatINR(liveMetrics.costing.totalRunCost)}
                </dd>
              </div>
              <div className="flex justify-between rounded-lg bg-[var(--brand-soft)] px-3 py-2 font-semibold text-[var(--brand-primary)]">
                <dt>Cost / Good Packet</dt>
                <dd className="tabular-nums">
                  {liveMetrics.costing.costPerPacket
                    ? formatINR(liveMetrics.costing.costPerPacket)
                    : "N/A (0 yield)"}
                </dd>
              </div>
              {liveMetrics.costing.unitGrossProfit &&
              liveMetrics.costing.grossMarginPercent ? (
                <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                  <dt>Gross Margin (vs ₹{selectedBom.sellingPrice})</dt>
                  <dd className="tabular-nums font-semibold text-[#15803D] dark:text-[#4ADE80]">
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
                  className="h-11 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
                >
                  {isPending
                    ? "Committing Stock..."
                    : "Complete Run & Credit Stock"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => submitMode("COMPLETE_NOW")}
                    className="h-11 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
                  >
                    {isPending
                      ? "Committing Stock..."
                      : "Save Production Run & Commit Stock"}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => submitMode("START_RUN")}
                    className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] disabled:opacity-60"
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
