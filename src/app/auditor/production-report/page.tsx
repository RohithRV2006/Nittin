import {
  ProductionReportClient,
  type ProductionReportData,
} from "@/components/auditor/ProductionReportClient";
import { money, qty } from "@/lib/decimal";
import { parseDateRangeParams } from "@/lib/engines/reports";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuditorProductionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; fy?: string }>;
}) {
  const filter = parseDateRangeParams(await searchParams);

  const runs = await prisma.productionRun.findMany({
    where: { runDate: { gte: filter.fromDate, lte: filter.toDate } },
    orderBy: { runDate: "desc" },
    include: {
      bom: { include: { finishedItem: { select: { name: true, unit: true } } } },
      consumptions: { include: { item: { select: { name: true, unit: true } } } },
    },
  });

  const data: ProductionReportData = {
    from: filter.from,
    to: filter.to,
    runs: runs.map((r) => {
      let totalScrap = qty(0);
      const summary = r.consumptions
        .map((c) => {
          totalScrap = qty(totalScrap.plus(c.scrapDamagedQty.toString()));
          const flag = c.varianceFlagged ? "!" : "";
          return `${c.item.name}: ${c.actualIssuedQty.toFixed(2)}/${c.plannedQty.toFixed(2)} ${c.item.unit} (${c.variancePercent.toFixed(1)}%${flag})`;
        })
        .join("; ");

      const ovh = money(r.labourCost.toString()).plus(r.powerGasCost.toString());

      return {
        id: r.id,
        runNumber: r.runNumber,
        date: r.runDate.toISOString().slice(0, 10),
        productName: r.bom.finishedItem.name,
        status: r.status,
        plannedOutput: r.plannedOutput.toFixed(0),
        actualOutput: r.actualOutput.toFixed(0),
        unit: r.bom.finishedItem.unit,
        yieldVariancePercent: r.yieldVariancePercent.toFixed(2),
        varianceFlagged: r.varianceFlagged,
        consumptionsSummary: summary,
        totalScrapQty: totalScrap.toFixed(3),
        materialCost: r.totalMaterialCost.toFixed(2),
        overheadsCost: ovh.toFixed(2),
        totalRunCost: r.totalRunCost.toFixed(2),
        costPerPacket: r.costPerPacket ? r.costPerPacket.toFixed(2) : null,
      };
    }),
  };

  return <ProductionReportClient data={data} />;
}
