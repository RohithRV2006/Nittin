import { ItemCategory } from "@prisma/client";
import { BomsWorkspace, type BomsPageData } from "@/components/production/BomsWorkspace";
import { money, toDec } from "@/lib/decimal";
import { prisma } from "@/lib/prisma";
import { convertUnit } from "@/lib/units";

export const dynamic = "force-dynamic";

export default async function ProductionBomsPage() {
  const [settings, items, boms, latestBatches] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.item.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.bOM.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: {
        finishedItem: true,
        items: { include: { item: true } },
      },
    }),
    prisma.stockBatch.findMany({
      where: { remainingQty: { gt: 0 } },
      orderBy: [{ receivedDate: "asc" }, { createdAt: "asc" }],
      select: { itemId: true, remainingQty: true, unitRate: true },
    }),
  ]);

  // Group open batches by itemId for FIFO batch cost estimate
  const batchesByItem = new Map<
    string,
    Array<{ remainingQty: string; unitRate: string }>
  >();
  for (const b of latestBatches) {
    const arr = batchesByItem.get(b.itemId) ?? [];
    arr.push({
      remainingQty: b.remainingQty.toString(),
      unitRate: b.unitRate.toString(),
    });
    batchesByItem.set(b.itemId, arr);
  }

  const estimateCost = (itemId: string, reqQtyStr: string): string => {
    const batches = batchesByItem.get(itemId) ?? [];
    let need = toDec(reqQtyStr);
    let cost = money(0);
    for (const b of batches) {
      if (need.lte(0)) break;
      const avail = toDec(b.remainingQty);
      const take = avail.lt(need) ? avail : need;
      cost = money(cost.plus(take.mul(b.unitRate)));
      need = need.minus(take);
    }
    return cost.toFixed(2);
  };

  const data: BomsPageData = {
    defaultTolerancePercent: settings
      ? settings.defaultTolerancePercent.toFixed(2)
      : "3.00",
    finishedItems: items
      .filter((i) => i.category === ItemCategory.FINISHED_GOOD)
      .map((i) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        unit: i.unit,
        packWeightGrams: i.packWeightGrams?.toFixed(3) ?? null,
      })),
    ingredientItems: items
      .filter((i) => i.category !== ItemCategory.FINISHED_GOOD)
      .map((i) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        category: i.category,
        unit: i.unit,
        unitsPerCarton: i.unitsPerCarton,
      })),
    boms: boms.map((b) => {
      let totalCost = money(0);
      for (const bi of b.items) {
        const baseQty = convertUnit(bi.standardQty.toString(), bi.unit, bi.item.unit, {
          unitsPerCarton: bi.item.unitsPerCarton,
        });
        totalCost = money(totalCost.plus(estimateCost(bi.itemId, baseQty.toFixed(3))));
      }
      return {
        id: b.id,
        name: b.name,
        finishedItemId: b.finishedItemId,
        finishedItemName: b.finishedItem.name,
        finishedItemCode: b.finishedItem.code,
        finishedUnit: b.finishedItem.unit,
        finishedPackGrams: b.finishedItem.packWeightGrams?.toFixed(3) ?? null,
        batchSizeOutput: b.batchSizeOutput.toFixed(3),
        tolerancePercent: b.tolerancePercent.toFixed(2),
        active: b.active,
        estimatedBatchCost: totalCost.toFixed(2),
        items: b.items.map((bi) => ({
          itemId: bi.itemId,
          itemName: bi.item.name,
          itemCode: bi.item.code,
          standardQty: bi.standardQty.toFixed(3),
          unit: bi.unit,
        })),
      };
    }),
  };

  return <BomsWorkspace data={data} />;
}
