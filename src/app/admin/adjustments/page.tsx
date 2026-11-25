import type { Metadata } from "next";
import { MovementType } from "@prisma/client";
import {
  AdjustmentsWorkspace,
  type AdjustmentsPageData,
} from "@/components/admin/AdjustmentsWorkspace";
import { money, qty } from "@/lib/decimal";
import { getItemStockMap } from "@/lib/engines/stock";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Stock Adjustments",
  description: "Inspect open batches, expiry alerts, and audited stock adjustments.",
};

export const dynamic = "force-dynamic";

export default async function AdminAdjustmentsPage() {
  const [items, stockMap, batches, adjustments] = await Promise.all([
    prisma.item.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getItemStockMap(prisma),
    prisma.stockBatch.findMany({
      where: { remainingQty: { gt: 0 } },
      orderBy: [{ receivedDate: "asc" }, { createdAt: "asc" }],
      include: { item: { select: { code: true, name: true, unit: true } } },
    }),
    prisma.stockLedger.findMany({
      where: { movementType: MovementType.STOCK_ADJUSTMENT },
      orderBy: { timestamp: "desc" },
      take: 50,
      include: { item: { select: { name: true } } },
    }),
  ]);

  const soonCutoff = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

  const data: AdjustmentsPageData = {
    items: items.map((i) => {
      const bal = stockMap.get(i.id) ?? qty(0);
      const reorder = qty(i.reorderLevel.toString());
      return {
        id: i.id,
        code: i.code,
        name: i.name,
        unit: i.unit,
        balance: bal.toFixed(3),
        reorderLevel: reorder.toFixed(3),
        isLowStock: reorder.gt(0) && bal.lte(reorder),
      };
    }),
    openBatches: batches.map((b) => {
      const rem = qty(b.remainingQty.toString());
      const rate = money(b.unitRate.toString());
      return {
        id: b.id,
        batchNumber: b.batchNumber,
        itemCode: b.item.code,
        itemName: b.item.name,
        unit: b.item.unit,
        remainingQty: rem.toFixed(3),
        unitRate: rate.toFixed(2),
        value: money(rem.mul(rate)).toFixed(2),
        receivedDate: b.receivedDate.toISOString().slice(0, 10),
        expiryDate: b.expiryDate ? b.expiryDate.toISOString().slice(0, 10) : null,
        expiringSoon: Boolean(b.expiryDate && b.expiryDate <= soonCutoff),
      };
    }),
    adjustments: adjustments.map((a) => ({
      id: a.id,
      timestamp: a.timestamp.toISOString().replace("T", " ").slice(0, 16),
      itemName: a.item.name,
      quantity: a.quantity.toFixed(3),
      unit: a.unit,
      balanceAfter: a.balanceAfter.toFixed(3),
      notes: a.notes ?? "—",
    })),
  };

  return <AdjustmentsWorkspace data={data} />;
}
