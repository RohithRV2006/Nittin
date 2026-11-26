"use server";
import { toSafeErrorMessage } from "@/lib/errors";

import { revalidatePath } from "next/cache";
import {
  DocumentType,
  MovementType,
  ProductionRunStatus,
  RefType,
  Role,
} from "@prisma/client";
import Decimal from "decimal.js";
import { requireVerifiedUser } from "@/lib/auth";
import { money, percent, qty, toDec } from "@/lib/decimal";
import { writeAuditLog } from "@/lib/engines/audit";
import { computeRunCosting, computeVariance } from "@/lib/engines/production";
import { getNextDocumentNumber } from "@/lib/engines/sequence";
import {
  consumeFifoBatches,
  recordInwardBatchAndLedger,
} from "@/lib/engines/stock";
import { prisma } from "@/lib/prisma";
import { convertUnit } from "@/lib/units";
import { isIntegerUnit } from "@/lib/enums";
import {
  bomSchema,
  cancelRunSchema,
  cloneBomSchema,
  productionRunInputSchema,
} from "@/lib/validators/phase2";
import type { ActionResult } from "./masters.actions";

const ALLOWED_ROLES = [Role.PRODUCTION_SUPERVISOR];

export async function upsertBomAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser(ALLOWED_ROLES);
    const parsed = bomSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid BOM" };
    }

    const v = parsed.data;
    const itemIds = v.items.map((i) => i.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      return { ok: false, error: "Duplicate ingredient/packaging items are not allowed in a BOM." };
    }

    await prisma.$transaction(async (tx) => {
      const finishedItem = await tx.item.findUnique({
        where: { id: v.finishedItemId },
      });
      if (!finishedItem || !finishedItem.active) {
        throw new Error("Finished product not found or inactive.");
      }

      const masterItems = await tx.item.findMany({
        where: { id: { in: itemIds }, active: true },
      });
      const masterMap = new Map(masterItems.map((m) => [m.id, m]));

      for (const line of v.items) {
        const master = masterMap.get(line.itemId);
        if (!master) {
          throw new Error("One or more BOM ingredients are inactive or missing.");
        }
        // Validate unit compatibility early
        convertUnit(line.standardQty, line.unit, master.unit, {
          unitsPerCarton: master.unitsPerCarton,
        });
      }

      if (v.id) {
        const before = await tx.bOM.findUnique({
          where: { id: v.id },
          include: { items: true },
        });
        await tx.bOMItem.deleteMany({ where: { bomId: v.id } });
        const after = await tx.bOM.update({
          where: { id: v.id },
          data: {
            finishedItemId: v.finishedItemId,
            name: v.name,
            batchSizeOutput: qty(v.batchSizeOutput),
            tolerancePercent: percent(v.tolerancePercent),
            items: {
              create: v.items.map((l) => ({
                itemId: l.itemId,
                standardQty: qty(l.standardQty),
                unit: l.unit,
              })),
            },
          },
          include: { items: true },
        });
        await writeAuditLog(tx, {
          entityType: "BOM",
          entityId: after.id,
          action: "UPDATE",
          userId: actor.id,
          changes: { before, after },
        });
      } else {
        const created = await tx.bOM.create({
          data: {
            finishedItemId: v.finishedItemId,
            name: v.name,
            batchSizeOutput: qty(v.batchSizeOutput),
            tolerancePercent: percent(v.tolerancePercent),
            items: {
              create: v.items.map((l) => ({
                itemId: l.itemId,
                standardQty: qty(l.standardQty),
                unit: l.unit,
              })),
            },
          },
          include: { items: true },
        });
        await writeAuditLog(tx, {
          entityType: "BOM",
          entityId: created.id,
          action: "CREATE",
          userId: actor.id,
          changes: { after: created },
        });
      }
    });

    revalidatePath("/production/boms");
    revalidatePath("/production");
    revalidatePath("/production/new-run");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to save BOM"),
    };
  }
}

export async function cloneBomAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser(ALLOWED_ROLES);
    const parsed = cloneBomSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid clone request" };
    }

    const v = parsed.data;
    const scale = toDec(v.scaleFactor);

    await prisma.$transaction(async (tx) => {
      const source = await tx.bOM.findUnique({
        where: { id: v.sourceBomId },
        include: { items: true },
      });
      if (!source) throw new Error("Source BOM not found.");

      const targetItem = await tx.item.findUnique({
        where: { id: v.targetFinishedItemId },
      });
      if (!targetItem || !targetItem.active) {
        throw new Error("Target finished product not found or inactive.");
      }

      const cloned = await tx.bOM.create({
        data: {
          finishedItemId: targetItem.id,
          name: v.name,
          batchSizeOutput: qty(v.batchSizeOutput),
          tolerancePercent: source.tolerancePercent,
          items: {
            create: source.items.map((item) => ({
              itemId: item.itemId,
              standardQty: qty(toDec(item.standardQty.toString()).mul(scale)),
              unit: item.unit,
            })),
          },
        },
      });

      await writeAuditLog(tx, {
        entityType: "BOM",
        entityId: cloned.id,
        action: "CREATE",
        userId: actor.id,
        changes: {
          clonedFrom: source.id,
          scaleFactor: scale.toFixed(3),
        },
      });
    });

    revalidatePath("/production/boms");
    revalidatePath("/production");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to clone BOM"),
    };
  }
}

export async function toggleBomActiveAction(
  id: string,
  active: boolean
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser(ALLOWED_ROLES);
    await prisma.$transaction(async (tx) => {
      await tx.bOM.update({ where: { id }, data: { active } });
      await writeAuditLog(tx, {
        entityType: "BOM",
        entityId: id,
        action: "UPDATE",
        userId: actor.id,
        changes: { active },
      });
    });
    revalidatePath("/production/boms");
    revalidatePath("/production");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: toSafeErrorMessage(err, "Update failed") };
  }
}

export async function submitProductionRunAction(
  input: unknown
): Promise<ActionResult<{ runNumber: string }>> {
  try {
    const actor = await requireVerifiedUser(ALLOWED_ROLES);
    const parsed = productionRunInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid run input" };
    }

    const v = parsed.data;
    const runDate = new Date(v.runDate);
    if (Number.isNaN(runDate.getTime())) {
      return { ok: false, error: "Invalid run date." };
    }

    const res = await prisma.$transaction(async (tx) => {
      const bom = await tx.bOM.findUnique({
        where: { id: v.bomId },
        include: {
          finishedItem: true,
          items: { include: { item: true } },
        },
      });
      if (!bom || !bom.active) {
        throw new Error("Selected BOM recipe is missing or inactive.");
      }

      const multiplier = toDec(v.batchMultiplier);
      const tolerance = percent(bom.tolerancePercent.toString());
      const plannedOutput = qty(
        toDec(bom.batchSizeOutput.toString()).mul(multiplier)
      );

      const inputMap = new Map(v.consumptions.map((c) => [c.itemId, c]));
      const bomItemMap = new Map(bom.items.map((bi) => [bi.itemId, bi]));

      for (const bi of bom.items) {
        const line = inputMap.get(bi.itemId);
        if (!line) {
          throw new Error(`Missing consumption entry for ${bi.item.name}.`);
        }
        if (
          isIntegerUnit(line.inputUnit) &&
          !Number.isInteger(line.actualIssuedQty)
        ) {
          throw new Error(
            `${bi.item.name} (${line.inputUnit}) requires a whole number quantity.`
          );
        }
        if (
          isIntegerUnit(line.scrapInputUnit ?? line.inputUnit) &&
          !Number.isInteger(line.scrapDamagedQty ?? 0)
        ) {
          throw new Error(
            `Damaged/scrap qty for ${bi.item.name} must be a whole number.`
          );
        }
      }
      if (
        isIntegerUnit(bom.finishedItem.unit) &&
        !Number.isInteger(v.actualOutput)
      ) {
        throw new Error(
          `Actual output (${bom.finishedItem.unit}) must be a whole number.`
        );
      }

      // Case 1: Completing an existing IN_PROGRESS run
      if (v.mode === "COMPLETE_EXISTING") {
        if (!v.runId) throw new Error("Run ID is required to complete an active run.");
        const existingRun = await tx.productionRun.findUnique({
          where: { id: v.runId },
          include: { consumptions: true },
        });
        if (!existingRun || existingRun.status !== ProductionRunStatus.IN_PROGRESS) {
          throw new Error("Production run is not in progress.");
        }

        const existingConsMap = new Map(
          existingRun.consumptions.map((c) => [c.itemId, c])
        );

        let totalMaterialCost = money(0);
        let anyVarianceFlagged = false;

        for (const bi of bom.items) {
          const lineInput = inputMap.get(bi.itemId)!;
          const prevCons = existingConsMap.get(bi.itemId);
          const prevIssued = qty(prevCons?.actualIssuedQty.toString() ?? "0");
          const prevCost = money(prevCons?.unitCostTotal.toString() ?? "0");

          const plannedBase = convertUnit(
            toDec(bi.standardQty.toString()).mul(multiplier),
            bi.unit,
            bi.item.unit,
            { unitsPerCarton: bi.item.unitsPerCarton }
          );

          const finalIssuedBase = convertUnit(
            lineInput.actualIssuedQty,
            lineInput.inputUnit,
            bi.item.unit,
            { unitsPerCarton: bi.item.unitsPerCarton }
          );

          const scrapUnit = lineInput.scrapInputUnit ?? lineInput.inputUnit;
          const scrapBase = convertUnit(
            lineInput.scrapDamagedQty ?? 0,
            scrapUnit,
            bi.item.unit,
            { unitsPerCarton: bi.item.unitsPerCarton }
          );

          if (scrapBase.gt(finalIssuedBase)) {
            throw new Error(
              `Scrap/damaged qty (${scrapBase.toFixed(3)}) cannot exceed total issued qty (${finalIssuedBase.toFixed(3)}) for ${bi.item.name}.`
            );
          }

          const delta = qty(finalIssuedBase.minus(prevIssued));
          let lineCost = prevCost;

          if (delta.gt(0)) {
            const prevScrap = qty(prevCons?.scrapDamagedQty.toString() ?? "0");
            const addedScrap = Decimal.min(
              delta,
              Decimal.max(qty(0), qty(scrapBase.minus(prevScrap)))
            );
            const addedGood = qty(delta.minus(addedScrap));

            if (addedGood.gt(0)) {
              const issuedRes = await consumeFifoBatches(tx, {
                itemId: bi.itemId,
                unit: bi.item.unit,
                requiredQty: addedGood,
                movementType: MovementType.PRODUCTION_ISSUE,
                referenceType: RefType.PRODUCTION_RUN,
                referenceId: existingRun.id,
                createdById: actor.id,
                notes: `Run ${existingRun.runNumber} completion issue`,
              });
              lineCost = money(lineCost.plus(issuedRes.totalCost));
            }

            if (addedScrap.gt(0)) {
              const scrapRes = await consumeFifoBatches(tx, {
                itemId: bi.itemId,
                unit: bi.item.unit,
                requiredQty: addedScrap,
                movementType: MovementType.SCRAP_DAMAGE,
                referenceType: RefType.PRODUCTION_RUN,
                referenceId: existingRun.id,
                createdById: actor.id,
                notes: `Run ${existingRun.runNumber} packaging/process scrap`,
              });
              lineCost = money(lineCost.plus(scrapRes.totalCost));
            }
          } else if (delta.lt(0)) {
            const returnQty = qty(delta.abs());
            const avgRate = prevIssued.gt(0)
              ? money(prevCost.div(prevIssued))
              : money(0);
            await recordInwardBatchAndLedger(tx, {
              itemId: bi.itemId,
              unit: bi.item.unit,
              quantity: returnQty,
              unitRate: avgRate,
              movementType: MovementType.STOCK_ADJUSTMENT,
              referenceType: RefType.PRODUCTION_RUN,
              referenceId: existingRun.id,
              batchNumber: `RET-${existingRun.runNumber.replace(/\//g, "-")}-${bi.item.code}`,
              createdById: actor.id,
              notes: `Returned unused material on completion of ${existingRun.runNumber}`,
            });
            lineCost = money(Decimal.max(money(0), lineCost.minus(money(returnQty.mul(avgRate)))));
          }

          const matVar = computeVariance(plannedBase, finalIssuedBase, tolerance);
          if (matVar.flagged) anyVarianceFlagged = true;
          totalMaterialCost = money(totalMaterialCost.plus(lineCost));

          if (prevCons) {
            await tx.productionConsumption.update({
              where: { id: prevCons.id },
              data: {
                plannedQty: plannedBase,
                actualIssuedQty: finalIssuedBase,
                scrapDamagedQty: scrapBase,
                unitCostTotal: lineCost,
                variancePercent: matVar.variancePercent,
                varianceFlagged: matVar.flagged,
              },
            });
          } else {
            await tx.productionConsumption.create({
              data: {
                productionRunId: existingRun.id,
                itemId: bi.itemId,
                plannedQty: plannedBase,
                actualIssuedQty: finalIssuedBase,
                scrapDamagedQty: scrapBase,
                unitCostTotal: lineCost,
                variancePercent: matVar.variancePercent,
                varianceFlagged: matVar.flagged,
              },
            });
          }
        }

        const actualOutput = qty(v.actualOutput);
        const yieldVar = computeVariance(plannedOutput, actualOutput, tolerance);
        if (yieldVar.flagged) anyVarianceFlagged = true;

        const costing = computeRunCosting({
          totalMaterialCost,
          labourCost: v.labourCost,
          powerGasCost: v.powerGasCost,
          actualOutput,
          sellingPrice: bom.finishedItem.sellingPrice?.toString() ?? null,
        });

        await tx.productionRun.update({
          where: { id: existingRun.id },
          data: {
            status: ProductionRunStatus.COMPLETED,
            completedAt: new Date(),
            actualOutput,
            yieldVariancePercent: yieldVar.variancePercent,
            varianceFlagged: anyVarianceFlagged,
            labourCost: money(v.labourCost),
            powerGasCost: money(v.powerGasCost),
            totalMaterialCost: costing.totalMaterialCost,
            totalRunCost: costing.totalRunCost,
            costPerPacket: costing.costPerPacket,
            notes: v.notes || existingRun.notes,
          },
        });

        if (actualOutput.gt(0)) {
          await recordInwardBatchAndLedger(tx, {
            itemId: bom.finishedItemId,
            unit: bom.finishedItem.unit,
            quantity: actualOutput,
            unitRate: costing.costPerPacket ?? money(0),
            movementType: MovementType.PRODUCTION_OUTPUT,
            referenceType: RefType.PRODUCTION_RUN,
            referenceId: existingRun.id,
            productionRunId: existingRun.id,
            batchNumber: `BATCH-${existingRun.runNumber.replace(/\//g, "-")}`,
            receivedDate: new Date(),
            expiryDate: v.expiryDate ? new Date(v.expiryDate) : null,
            createdById: actor.id,
            notes: `Finished output from ${existingRun.runNumber}`,
          });
        }

        await writeAuditLog(tx, {
          entityType: "PRODUCTION_RUN",
          entityId: existingRun.id,
          action: "UPDATE",
          userId: actor.id,
          changes: {
            status: ProductionRunStatus.COMPLETED,
            actualOutput: actualOutput.toFixed(3),
            totalRunCost: costing.totalRunCost.toFixed(2),
            costPerPacket: costing.costPerPacket?.toFixed(2) ?? null,
          },
        });

        return { runNumber: existingRun.runNumber };
      }

      // Case 2 & 3: Fresh run (START_RUN or COMPLETE_NOW)
      const runNumber = await getNextDocumentNumber(
        tx,
        DocumentType.PRODUCTION_RUN,
        runDate
      );
      const isCompleteNow = v.mode === "COMPLETE_NOW";
      const actualOutput = isCompleteNow ? qty(v.actualOutput) : qty(0);

      const run = await tx.productionRun.create({
        data: {
          runNumber,
          bomId: bom.id,
          supervisorId: actor.id,
          status: isCompleteNow
            ? ProductionRunStatus.COMPLETED
            : ProductionRunStatus.IN_PROGRESS,
          batchMultiplier: qty(multiplier),
          runDate,
          completedAt: isCompleteNow ? new Date() : null,
          plannedOutput,
          actualOutput,
          labourCost: money(v.labourCost),
          powerGasCost: money(v.powerGasCost),
          notes: v.notes || null,
        },
      });

      let totalMaterialCost = money(0);
      let anyVarianceFlagged = false;

      for (const bi of bom.items) {
        const lineInput = inputMap.get(bi.itemId)!;
        const plannedBase = convertUnit(
          toDec(bi.standardQty.toString()).mul(multiplier),
          bi.unit,
          bi.item.unit,
          { unitsPerCarton: bi.item.unitsPerCarton }
        );

        const issuedBase = convertUnit(
          lineInput.actualIssuedQty,
          lineInput.inputUnit,
          bi.item.unit,
          { unitsPerCarton: bi.item.unitsPerCarton }
        );

        const scrapUnit = lineInput.scrapInputUnit ?? lineInput.inputUnit;
        const scrapBase = convertUnit(
          lineInput.scrapDamagedQty ?? 0,
          scrapUnit,
          bi.item.unit,
          { unitsPerCarton: bi.item.unitsPerCarton }
        );

        if (scrapBase.gt(issuedBase)) {
          throw new Error(
            `Scrap/damaged qty (${scrapBase.toFixed(3)}) cannot exceed total issued qty (${issuedBase.toFixed(3)}) for ${bi.item.name}.`
          );
        }

        const goodBase = qty(issuedBase.minus(scrapBase));
        let lineCost = money(0);

        if (goodBase.gt(0)) {
          const goodRes = await consumeFifoBatches(tx, {
            itemId: bi.itemId,
            unit: bi.item.unit,
            requiredQty: goodBase,
            movementType: MovementType.PRODUCTION_ISSUE,
            referenceType: RefType.PRODUCTION_RUN,
            referenceId: run.id,
            createdById: actor.id,
            notes: `Production issue for ${runNumber}`,
          });
          lineCost = money(lineCost.plus(goodRes.totalCost));
        }

        if (scrapBase.gt(0)) {
          const scrapRes = await consumeFifoBatches(tx, {
            itemId: bi.itemId,
            unit: bi.item.unit,
            requiredQty: scrapBase,
            movementType: MovementType.SCRAP_DAMAGE,
            referenceType: RefType.PRODUCTION_RUN,
            referenceId: run.id,
            createdById: actor.id,
            notes: `Damaged/scrap for ${runNumber}`,
          });
          lineCost = money(lineCost.plus(scrapRes.totalCost));
        }

        const matVar = computeVariance(plannedBase, issuedBase, tolerance);
        if (matVar.flagged) anyVarianceFlagged = true;
        totalMaterialCost = money(totalMaterialCost.plus(lineCost));

        await tx.productionConsumption.create({
          data: {
            productionRunId: run.id,
            itemId: bi.itemId,
            plannedQty: plannedBase,
            actualIssuedQty: issuedBase,
            scrapDamagedQty: scrapBase,
            unitCostTotal: lineCost,
            variancePercent: matVar.variancePercent,
            varianceFlagged: matVar.flagged,
          },
        });
      }

      // Also validate any unknown items weren't slipped in
      for (const c of v.consumptions) {
        if (!bomItemMap.has(c.itemId)) {
          throw new Error("Submitted consumption contains an item not in this BOM.");
        }
      }

      if (isCompleteNow) {
        const yieldVar = computeVariance(plannedOutput, actualOutput, tolerance);
        if (yieldVar.flagged) anyVarianceFlagged = true;

        const costing = computeRunCosting({
          totalMaterialCost,
          labourCost: v.labourCost,
          powerGasCost: v.powerGasCost,
          actualOutput,
          sellingPrice: bom.finishedItem.sellingPrice?.toString() ?? null,
        });

        await tx.productionRun.update({
          where: { id: run.id },
          data: {
            yieldVariancePercent: yieldVar.variancePercent,
            varianceFlagged: anyVarianceFlagged,
            totalMaterialCost: costing.totalMaterialCost,
            totalRunCost: costing.totalRunCost,
            costPerPacket: costing.costPerPacket,
          },
        });

        if (actualOutput.gt(0)) {
          await recordInwardBatchAndLedger(tx, {
            itemId: bom.finishedItemId,
            unit: bom.finishedItem.unit,
            quantity: actualOutput,
            unitRate: costing.costPerPacket ?? money(0),
            movementType: MovementType.PRODUCTION_OUTPUT,
            referenceType: RefType.PRODUCTION_RUN,
            referenceId: run.id,
            productionRunId: run.id,
            batchNumber: `BATCH-${runNumber.replace(/\//g, "-")}`,
            receivedDate: runDate,
            expiryDate: v.expiryDate ? new Date(v.expiryDate) : null,
            createdById: actor.id,
            notes: `Finished output from ${runNumber}`,
          });
        }
      } else {
        await tx.productionRun.update({
          where: { id: run.id },
          data: {
            totalMaterialCost,
            totalRunCost: money(
              totalMaterialCost.plus(v.labourCost).plus(v.powerGasCost)
            ),
            varianceFlagged: anyVarianceFlagged,
          },
        });
      }

      await writeAuditLog(tx, {
        entityType: "PRODUCTION_RUN",
        entityId: run.id,
        action: "CREATE",
        userId: actor.id,
        changes: {
          runNumber,
          mode: v.mode,
          plannedOutput: plannedOutput.toFixed(3),
          actualOutput: actualOutput.toFixed(3),
          totalMaterialCost: totalMaterialCost.toFixed(2),
        },
      });

      return { runNumber };
    });

    revalidatePath("/production");
    revalidatePath("/production/new-run");
    revalidatePath("/admin/adjustments");
    revalidatePath("/admin");
    return { ok: true, data: res };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to save production run"),
    };
  }
}

export async function cancelProductionRunAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireVerifiedUser(ALLOWED_ROLES);
    const parsed = cancelRunSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
    }

    const { runId, reason } = parsed.data;
    await prisma.$transaction(async (tx) => {
      const run = await tx.productionRun.findUnique({
        where: { id: runId },
        include: { consumptions: { include: { item: true } } },
      });
      if (!run) throw new Error("Production run not found.");
      if (run.status !== ProductionRunStatus.IN_PROGRESS) {
        throw new Error("Only in-progress runs can be cancelled.");
      }

      for (const c of run.consumptions) {
        const issued = qty(c.actualIssuedQty.toString());
        if (issued.gt(0)) {
          const avgRate = money(toDec(c.unitCostTotal.toString()).div(issued));
          await recordInwardBatchAndLedger(tx, {
            itemId: c.itemId,
            unit: c.item.unit,
            quantity: issued,
            unitRate: avgRate,
            movementType: MovementType.STOCK_ADJUSTMENT,
            referenceType: RefType.PRODUCTION_RUN,
            referenceId: run.id,
            batchNumber: `CXL-${run.runNumber.replace(/\//g, "-")}-${c.item.code}`,
            createdById: actor.id,
            notes: `Cancelled run ${run.runNumber}: ${reason}`,
          });
        }
      }

      await tx.productionRun.update({
        where: { id: run.id },
        data: { status: ProductionRunStatus.CANCELLED },
      });

      await writeAuditLog(tx, {
        entityType: "PRODUCTION_RUN",
        entityId: run.id,
        action: "CANCEL",
        userId: actor.id,
        reason,
      });
    });

    revalidatePath("/production");
    revalidatePath("/admin/adjustments");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: toSafeErrorMessage(err, "Failed to cancel production run"),
    };
  }
}
