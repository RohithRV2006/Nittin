import type { Metadata } from "next";
import { GrnStatus, ItemCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PurchasesWorkspace,
  type PurchasesPageData,
} from "@/components/admin/PurchasesWorkspace";

export const metadata: Metadata = {
  title: "Procurement & Bills",
  description: "Record supplier purchases into FIFO/FEFO stock lots.",
};

export const dynamic = "force-dynamic";

export default async function AdminPurchasesPage() {
  const [settings, suppliers, items, purchases, pendingGrns] = await Promise.all([
    prisma.companySettings.findUnique({ where: { id: "default" } }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.item.findMany({
      where: {
        active: true,
        category: { in: [ItemCategory.RAW_MATERIAL, ItemCategory.PACKAGING] },
      },
      orderBy: { name: "asc" },
    }),
    prisma.purchase.findMany({
      orderBy: { purchaseDate: "desc" },
      include: {
        supplier: { select: { name: true } },
        items: { include: { item: { select: { name: true } } } },
      },
    }),
    prisma.goodsReceipt.findMany({
      where: { status: GrnStatus.PENDING_BILLING },
      orderBy: { receivedDate: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        receivedBy: { select: { name: true } },
        items: {
          include: {
            item: { select: { id: true, name: true, taxRate: true } },
          },
        },
      },
    }),
  ]);

  const data: PurchasesPageData = {
    factoryConfigured: Boolean(settings?.isConfigured && settings.stateCode),
    factoryStateCode: settings?.stateCode ?? "",
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      state: s.state,
      stateCode: s.stateCode,
    })),
    items: items.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      unit: i.unit,
      unitsPerCarton: i.unitsPerCarton,
      taxRate: i.taxRate.toFixed(2),
    })),
    pendingGrns: pendingGrns.map((g) => ({
      id: g.id,
      grnNumber: g.grnNumber,
      supplierId: g.supplierId,
      supplierName: g.supplier.name,
      challanNumber: g.challanNumber,
      receivedDate: g.receivedDate.toISOString().slice(0, 10),
      receivedByName: g.receivedBy.name,
      notes: g.notes,
      lines: g.items.map((li) => ({
        itemId: li.itemId,
        itemName: li.item.name,
        quantity: li.quantity.toFixed(3),
        inputUnit: li.unit,
        taxRate: li.item.taxRate.toFixed(2),
        batchNumber: li.batchNumber ?? "",
        expiryDate: li.expiryDate ? li.expiryDate.toISOString().slice(0, 10) : "",
      })),
    })),
    purchases: purchases.map((p) => ({
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      supplierName: p.supplier.name,
      billNumber: p.billNumber,
      purchaseDate: p.purchaseDate.toISOString().slice(0, 10),
      itemCount: p.items.length,
      itemsSummary: p.items
        .map((li) => `${li.item.name} (${li.quantity.toFixed(2)} ${li.unit})`)
        .join(", "),
      taxableAmount: p.taxableAmount.toFixed(2),
      taxTotal: p.cgstAmount.add(p.sgstAmount).add(p.igstAmount).toFixed(2),
      totalAmount: p.totalAmount.toFixed(2),
      paidAmount: p.paidAmount.toFixed(2),
      paymentStatus: p.paymentStatus,
    })),
  };

  return <PurchasesWorkspace data={data} />;
}
