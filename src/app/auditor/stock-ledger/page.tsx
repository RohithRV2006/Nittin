import type { Metadata } from "next";
import {
  StockLedgerClient,
  type StockLedgerPageData,
} from "@/components/auditor/StockLedgerClient";
import { money, qty, toDec } from "@/lib/decimal";
import { parseDateRangeParams } from "@/lib/engines/reports";
import { getItemStockMap } from "@/lib/engines/stock";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Stock Ledger",
  description: "FIFO stock summary, movements, and batch reconciliation.",
};

export const dynamic = "force-dynamic";

export default async function AuditorStockLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; fy?: string }>;
}) {
  const filter = parseDateRangeParams(await searchParams);

  const [items, openingAgg, periodMovements, openBatches, currentStockMap] =
    await Promise.all([
      prisma.item.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
      prisma.stockLedger.groupBy({
        by: ["itemId"],
        where: { timestamp: { lt: filter.fromDate } },
        _sum: { quantity: true },
      }),
      prisma.stockLedger.findMany({
        where: { timestamp: { gte: filter.fromDate, lte: filter.toDate } },
        orderBy: { timestamp: "desc" },
        include: {
          item: { select: { code: true, name: true, category: true } },
          batch: { select: { batchNumber: true } },
        },
      }),
      prisma.stockBatch.findMany({
        where: { remainingQty: { gt: 0 } },
        select: { itemId: true, remainingQty: true, unitRate: true },
      }),
      getItemStockMap(prisma),
    ]);

  const openingMap = new Map(
    openingAgg.map((o) => [o.itemId, qty(o._sum.quantity ?? 0)])
  );

  const periodInMap = new Map<string, ReturnType<typeof qty>>();
  const periodOutMap = new Map<string, ReturnType<typeof qty>>();

  for (const m of periodMovements) {
    const q = toDec(m.quantity.toString());
    if (q.gt(0)) {
      const prev = periodInMap.get(m.itemId) ?? qty(0);
      periodInMap.set(m.itemId, qty(prev.plus(q)));
    } else if (q.lt(0)) {
      const prev = periodOutMap.get(m.itemId) ?? qty(0);
      periodOutMap.set(m.itemId, qty(prev.plus(q.abs())));
    }
  }

  const batchQtyMap = new Map<string, ReturnType<typeof qty>>();
  const batchValMap = new Map<string, ReturnType<typeof money>>();
  for (const b of openBatches) {
    const q = qty(b.remainingQty.toString());
    const v = money(q.mul(b.unitRate.toString()));
    batchQtyMap.set(b.itemId, qty((batchQtyMap.get(b.itemId) ?? qty(0)).plus(q)));
    batchValMap.set(b.itemId, money((batchValMap.get(b.itemId) ?? money(0)).plus(v)));
  }

  let reconciled = true;
  const summaryRows: StockLedgerPageData["summaryRows"] = items.map((item) => {
    const open = openingMap.get(item.id) ?? qty(0);
    const inw = periodInMap.get(item.id) ?? qty(0);
    const out = periodOutMap.get(item.id) ?? qty(0);
    const close = qty(open.plus(inw).minus(out));
    const currentLedger = currentStockMap.get(item.id) ?? qty(0);
    const batchRem = batchQtyMap.get(item.id) ?? qty(0);

    if (!currentLedger.eq(batchRem)) {
      reconciled = false;
    }

    return {
      itemId: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      unit: item.unit,
      openingQty: open.toFixed(3),
      inwardQty: inw.toFixed(3),
      outwardQty: out.toFixed(3),
      closingQty: close.toFixed(3),
      batchRemainingQty: batchRem.toFixed(3),
      fifoValuation: (batchValMap.get(item.id) ?? money(0)).toFixed(2),
    };
  });

  const data: StockLedgerPageData = {
    from: filter.from,
    to: filter.to,
    reconciled,
    summaryRows,
    movements: periodMovements.map((m) => {
      const q = toDec(m.quantity.toString());
      return {
        id: m.id,
        timestamp: m.timestamp.toISOString().replace("T", " ").slice(0, 16),
        itemId: m.itemId,
        itemCode: m.item.code,
        itemName: m.item.name,
        category: m.item.category,
        batchNumber: m.batch?.batchNumber ?? null,
        movementType: m.movementType,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        inwardQty: q.gt(0) ? q.toFixed(3) : "0.000",
        outwardQty: q.lt(0) ? q.abs().toFixed(3) : "0.000",
        unit: m.unit,
        balanceAfter: m.balanceAfter.toFixed(3),
        unitRate: m.unitRate ? m.unitRate.toFixed(2) : null,
        totalValue: m.totalValue ? m.totalValue.toFixed(2) : null,
        notes: m.notes,
      };
    }),
  };

  return <StockLedgerClient data={data} />;
}
