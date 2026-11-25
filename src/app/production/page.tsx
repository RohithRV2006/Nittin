import { OrderStatus, ProductionRunStatus } from "@prisma/client";
import {
  ProductionOverviewClient,
  type ProductionOverviewData,
} from "@/components/production/ProductionOverviewClient";
import { qty } from "@/lib/decimal";
import { computeRecommendedBatches } from "@/lib/engines/production";
import { getItemStockMap } from "@/lib/engines/stock";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProductionOverviewPage() {
  const now = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    activeBoms,
    inProgressRuns,
    completedLast7Days,
    recentRuns,
    pendingOrderItems,
    stockMap,
  ] = await Promise.all([
    prisma.bOM.findMany({
      where: { active: true },
      include: { finishedItem: { select: { id: true, name: true, unit: true } } },
    }),
    prisma.productionRun.findMany({
      where: { status: ProductionRunStatus.IN_PROGRESS },
      orderBy: { runDate: "desc" },
      include: {
        bom: {
          include: { finishedItem: { select: { name: true, unit: true } } },
        },
      },
    }),
    prisma.productionRun.count({
      where: {
        status: ProductionRunStatus.COMPLETED,
        runDate: { gte: cutoff7d },
      },
    }),
    prisma.productionRun.findMany({
      where: { status: ProductionRunStatus.COMPLETED },
      orderBy: { runDate: "desc" },
      take: 25,
      include: {
        bom: {
          include: { finishedItem: { select: { name: true, unit: true } } },
        },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: {
            in: [OrderStatus.SUBMITTED, OrderStatus.APPROVED, OrderStatus.ON_HOLD],
          },
        },
      },
      select: { itemId: true, quantity: true },
    }),
    getItemStockMap(prisma),
  ]);

  const recentVarianceAlerts = recentRuns
    .filter((r) => r.varianceFlagged && r.runDate >= cutoff24h)
    .map((r) => ({
      id: r.id,
      runNumber: r.runNumber,
      productName: r.bom.finishedItem.name,
      yieldVariancePercent: r.yieldVariancePercent.toFixed(2),
    }));

  // Aggregate pending order demand by finished product
  const demandByItem = new Map<string, ReturnType<typeof qty>>();
  for (const oi of pendingOrderItems) {
    const prev = demandByItem.get(oi.itemId) ?? qty(0);
    demandByItem.set(oi.itemId, qty(prev.plus(oi.quantity.toString())));
  }

  const recommendations: ProductionOverviewData["recommendations"] = [];
  for (const bom of activeBoms) {
    const pending = demandByItem.get(bom.finishedItemId) ?? qty(0);
    if (pending.lte(0)) continue;
    const avail = stockMap.get(bom.finishedItemId) ?? qty(0);
    const { deficit, recommendedBatches } = computeRecommendedBatches(
      pending,
      avail,
      bom.batchSizeOutput.toString()
    );
    if (recommendedBatches > 0) {
      recommendations.push({
        bomId: bom.id,
        productName: bom.finishedItem.name,
        pendingQty: `${pending.toFixed(0)} ${bom.finishedItem.unit}`,
        availableStock: `${avail.toFixed(0)} ${bom.finishedItem.unit}`,
        deficit: `${deficit.toFixed(0)} ${bom.finishedItem.unit}`,
        recommendedBatches,
      });
    }
  }

  const data: ProductionOverviewData = {
    stats: {
      activeBoms: activeBoms.length,
      inProgressRuns: inProgressRuns.length,
      completedLast7Days,
      varianceAlerts24h: recentVarianceAlerts.length,
    },
    recentVarianceAlerts,
    recommendations,
    inProgressRuns: inProgressRuns.map((r) => ({
      id: r.id,
      runNumber: r.runNumber,
      productName: r.bom.finishedItem.name,
      runDate: r.runDate.toISOString().slice(0, 10),
      plannedOutput: r.plannedOutput.toFixed(3),
      unit: r.bom.finishedItem.unit,
      materialCost: r.totalMaterialCost.toFixed(2),
    })),
    recentRuns: recentRuns.map((r) => ({
      id: r.id,
      runNumber: r.runNumber,
      productName: r.bom.finishedItem.name,
      runDate: r.runDate.toISOString().slice(0, 10),
      status: r.status,
      plannedOutput: r.plannedOutput.toFixed(0),
      actualOutput: r.actualOutput.toFixed(0),
      unit: r.bom.finishedItem.unit,
      yieldVariancePercent: r.yieldVariancePercent.toFixed(2),
      varianceFlagged: r.varianceFlagged,
      totalRunCost: r.totalRunCost.toFixed(2),
      costPerPacket: r.costPerPacket ? r.costPerPacket.toFixed(2) : null,
    })),
  };

  return <ProductionOverviewClient data={data} />;
}
