import { ProductionRunStatus } from "@prisma/client";
import {
  ProductionRunWorkspace,
  type ExistingRunData,
  type RunBomOption,
} from "@/components/production/ProductionRunWorkspace";
import { qty } from "@/lib/decimal";
import { getItemStockMap } from "@/lib/engines/stock";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProductionNewRunPage({
  searchParams,
}: {
  searchParams: Promise<{ bomId?: string; multiplier?: string; runId?: string }>;
}) {
  const params = await searchParams;

  const [boms, stockMap, openBatches, existingRunRecord] = await Promise.all([
    prisma.bOM.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      include: {
        finishedItem: true,
        items: { include: { item: true } },
      },
    }),
    getItemStockMap(prisma),
    prisma.stockBatch.findMany({
      where: { remainingQty: { gt: 0 } },
      orderBy: [{ receivedDate: "asc" }, { createdAt: "asc" }],
      select: { itemId: true, remainingQty: true, unitRate: true },
    }),
    params.runId
      ? prisma.productionRun.findUnique({
          where: { id: params.runId },
          include: { consumptions: true },
        })
      : Promise.resolve(null),
  ]);

  const batchMap = new Map<
    string,
    Array<{ remainingQty: string; unitRate: string }>
  >();
  for (const b of openBatches) {
    const arr = batchMap.get(b.itemId) ?? [];
    arr.push({
      remainingQty: b.remainingQty.toString(),
      unitRate: b.unitRate.toString(),
    });
    batchMap.set(b.itemId, arr);
  }

  const bomOptions: RunBomOption[] = boms.map((b) => ({
    id: b.id,
    name: b.name,
    finishedItemName: b.finishedItem.name,
    finishedUnit: b.finishedItem.unit,
    sellingPrice: b.finishedItem.sellingPrice?.toFixed(2) ?? null,
    batchSizeOutput: b.batchSizeOutput.toFixed(3),
    tolerancePercent: b.tolerancePercent.toFixed(2),
    items: b.items.map((bi) => ({
      itemId: bi.itemId,
      code: bi.item.code,
      name: bi.item.name,
      category: bi.item.category,
      baseUnit: bi.item.unit,
      unitsPerCarton: bi.item.unitsPerCarton,
      standardQty: bi.standardQty.toFixed(3),
      bomUnit: bi.unit,
      availableStock: (stockMap.get(bi.itemId) ?? qty(0)).toFixed(3),
      openBatches: batchMap.get(bi.itemId) ?? [],
    })),
  }));

  let existingRun: ExistingRunData | null = null;
  if (
    existingRunRecord &&
    existingRunRecord.status === ProductionRunStatus.IN_PROGRESS
  ) {
    existingRun = {
      runId: existingRunRecord.id,
      runNumber: existingRunRecord.runNumber,
      bomId: existingRunRecord.bomId,
      batchMultiplier: existingRunRecord.batchMultiplier.toFixed(3),
      runDate: existingRunRecord.runDate.toISOString().slice(0, 10),
      labourCost: existingRunRecord.labourCost.toFixed(2),
      powerGasCost: existingRunRecord.powerGasCost.toFixed(2),
      notes: existingRunRecord.notes ?? "",
      consumptions: existingRunRecord.consumptions.map((c) => ({
        itemId: c.itemId,
        actualIssuedQty: c.actualIssuedQty.toFixed(3),
        scrapDamagedQty: c.scrapDamagedQty.toFixed(3),
      })),
    };
  }

  return (
    <ProductionRunWorkspace
      boms={bomOptions}
      initialBomId={params.bomId ?? bomOptions[0]?.id ?? ""}
      initialMultiplier={params.multiplier ?? "1"}
      existingRun={existingRun}
    />
  );
}
