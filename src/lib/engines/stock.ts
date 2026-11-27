import {
  MovementType,
  Prisma,
  PrismaClient,
  RefType,
  UnitType,
} from "@prisma/client";
import Decimal from "decimal.js";
import { money, qty, type DecimalInput } from "@/lib/decimal";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function getItemStockMap(
  db: DbClient,
  itemIds?: string[]
): Promise<Map<string, Decimal>> {
  const grouped = await db.stockBatch.groupBy({
    by: ["itemId"],
    where: itemIds
      ? { itemId: { in: itemIds }, remainingQty: { gt: 0 } }
      : { remainingQty: { gt: 0 } },
    _sum: { remainingQty: true },
  });

  const map = new Map<string, Decimal>();
  for (const row of grouped) {
    map.set(row.itemId, qty(row._sum.remainingQty ?? 0));
  }
  return map;
}

export async function getItemClosingBalance(
  db: DbClient,
  itemId: string
): Promise<Decimal> {
  const agg = await db.stockLedger.aggregate({
    where: { itemId },
    _sum: { quantity: true },
  });
  return qty(agg._sum.quantity ?? 0);
}

export interface InwardBatchInput {
  itemId: string;
  unit: UnitType;
  quantity: DecimalInput;
  unitRate: DecimalInput;
  movementType: MovementType;
  referenceType: RefType;
  referenceId: string;
  batchNumber: string;
  purchaseItemId?: string | null;
  productionRunId?: string | null;
  receivedDate?: Date;
  expiryDate?: Date | null;
  createdById?: string | null;
  notes?: string | null;
}

export async function recordInwardBatchAndLedger(
  tx: Prisma.TransactionClient,
  input: InwardBatchInput
) {
  const quantity = qty(input.quantity);
  if (quantity.lte(0)) {
    throw new Error("Inward stock quantity must be positive.");
  }
  const unitRate = money(input.unitRate);
  const currentBalance = await getItemClosingBalance(tx, input.itemId);
  const balanceAfter = qty(currentBalance.plus(quantity));

  const batch = await tx.stockBatch.create({
    data: {
      batchNumber: input.batchNumber,
      itemId: input.itemId,
      purchaseItemId: input.purchaseItemId ?? null,
      productionRunId: input.productionRunId ?? null,
      receivedDate: input.receivedDate ?? new Date(),
      expiryDate: input.expiryDate ?? null,
      initialQty: quantity,
      remainingQty: quantity,
      unitRate,
    },
  });

  const ledger = await tx.stockLedger.create({
    data: {
      itemId: input.itemId,
      batchId: batch.id,
      movementType: input.movementType,
      quantity,
      unit: input.unit,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      balanceAfter,
      unitRate,
      totalValue: money(quantity.mul(unitRate)),
      createdById: input.createdById ?? null,
      notes: input.notes ?? null,
    },
  });

  return { batch, ledger, balanceAfter };
}

interface LockedBatchRow {
  id: string;
  batchNumber: string;
  remainingQty: Prisma.Decimal;
  unitRate: Prisma.Decimal;
  expiryDate: Date | null;
}

export interface FifoConsumeInput {
  itemId: string;
  unit: UnitType;
  requiredQty: DecimalInput;
  movementType: MovementType;
  referenceType: RefType;
  referenceId: string;
  createdById?: string | null;
  notes?: string | null;
  preferFefo?: boolean;
}

export interface FifoConsumeResult {
  totalCost: Decimal;
  balanceAfter: Decimal;
  allocations: Array<{
    batchId: string;
    batchNumber: string;
    consumedQty: Decimal;
    unitRate: Decimal;
    lineCost: Decimal;
  }>;
}

/**
 * Atomically locks open `StockBatch` rows (`FOR UPDATE`), consumes in FIFO (or FEFO) order,
 * decrements `remainingQty`, and writes signed negative `StockLedger` records.
 */
export async function consumeFifoBatches(
  tx: Prisma.TransactionClient,
  input: FifoConsumeInput
): Promise<FifoConsumeResult> {
  const required = qty(input.requiredQty);
  if (required.lte(0)) {
    throw new Error("Outward consumption quantity must be positive.");
  }

  const batches = input.preferFefo
    ? await tx.$queryRaw<LockedBatchRow[]>`
        SELECT id, "batchNumber", "remainingQty", "unitRate", "expiryDate"
        FROM "StockBatch"
        WHERE "itemId" = ${input.itemId} AND "remainingQty" > 0
        ORDER BY "expiryDate" ASC NULLS LAST, "receivedDate" ASC, "createdAt" ASC
        FOR UPDATE
      `
    : await tx.$queryRaw<LockedBatchRow[]>`
        SELECT id, "batchNumber", "remainingQty", "unitRate", "expiryDate"
        FROM "StockBatch"
        WHERE "itemId" = ${input.itemId} AND "remainingQty" > 0
        ORDER BY "receivedDate" ASC, "createdAt" ASC
        FOR UPDATE
      `;

  let remainingToTake = required;
  let runningBalance = await getItemClosingBalance(tx, input.itemId);
  let totalCost = money(0);
  const allocations: FifoConsumeResult["allocations"] = [];

  for (const batch of batches) {
    if (remainingToTake.lte(0)) break;

    const avail = qty(batch.remainingQty.toString());
    if (avail.lte(0)) continue;

    const take = Decimal.min(avail, remainingToTake);
    const rate = money(batch.unitRate.toString());
    const lineCost = money(take.mul(rate));

    await tx.stockBatch.update({
      where: { id: batch.id },
      data: { remainingQty: qty(avail.minus(take)) },
    });

    runningBalance = qty(runningBalance.minus(take));
    totalCost = money(totalCost.plus(lineCost));

    await tx.stockLedger.create({
      data: {
        itemId: input.itemId,
        batchId: batch.id,
        movementType: input.movementType,
        quantity: qty(take.negated()),
        unit: input.unit,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        balanceAfter: runningBalance,
        unitRate: rate,
        totalValue: money(lineCost.negated()),
        createdById: input.createdById ?? null,
        notes: input.notes ?? null,
      },
    });

    allocations.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      consumedQty: take,
      unitRate: rate,
      lineCost,
    });

    remainingToTake = qty(remainingToTake.minus(take));
  }

  if (remainingToTake.gt(0)) {
    const item = await tx.item.findUnique({
      where: { id: input.itemId },
      select: { name: true, code: true, unit: true },
    });
    throw new Error(
      `Insufficient stock for ${item?.name ?? input.itemId} (${item?.code ?? ""}): short by ${remainingToTake.toFixed(3)} ${item?.unit ?? input.unit}.`
    );
  }

  return {
    totalCost,
    balanceAfter: runningBalance,
    allocations,
  };
}
