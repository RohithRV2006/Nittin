import type { Metadata } from "next";
import { ItemCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  GoodsReceivingWorkspace,
  type GrnPageData,
} from "@/components/production/GoodsReceivingWorkspace";

export const metadata: Metadata = {
  title: "Goods Receipt (GRN)",
  description: "Log physical inward raw material & packaging deliveries from suppliers.",
};

export const dynamic = "force-dynamic";

export default async function ProductionReceivingPage() {
  const [suppliers, items, grns] = await Promise.all([
    prisma.supplier.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, state: true },
    }),
    prisma.item.findMany({
      where: {
        active: true,
        category: { in: [ItemCategory.RAW_MATERIAL, ItemCategory.PACKAGING] },
      },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, unit: true, unitsPerCarton: true },
    }),
    prisma.goodsReceipt.findMany({
      orderBy: { receivedDate: "desc" },
      take: 40,
      include: {
        supplier: { select: { name: true } },
        receivedBy: { select: { name: true } },
        purchase: { select: { purchaseNumber: true } },
        items: { include: { item: { select: { name: true, code: true } } } },
      },
    }),
  ]);

  const data: GrnPageData = {
    suppliers,
    items,
    grns: grns.map((g) => ({
      id: g.id,
      grnNumber: g.grnNumber,
      supplierName: g.supplier.name,
      challanNumber: g.challanNumber,
      receivedDate: g.receivedDate.toISOString().slice(0, 10),
      status: g.status,
      receivedByName: g.receivedBy.name,
      purchaseNumber: g.purchase?.purchaseNumber ?? null,
      rejectionReason: g.rejectionReason,
      notes: g.notes,
      itemsSummary: g.items
        .map((li) => `${li.item.name} (${li.quantity.toFixed(2)} ${li.unit})`)
        .join(", "),
    })),
  };

  return <GoodsReceivingWorkspace data={data} />;
}
