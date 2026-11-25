import {
  PurchaseRegisterClient,
  type PurchaseRegisterData,
} from "@/components/auditor/PurchaseRegisterClient";
import { parseDateRangeParams } from "@/lib/engines/reports";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuditorPurchaseRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; fy?: string }>;
}) {
  const filter = parseDateRangeParams(await searchParams);

  const purchases = await prisma.purchase.findMany({
    where: {
      purchaseDate: { gte: filter.fromDate, lte: filter.toDate },
    },
    orderBy: { purchaseDate: "desc" },
    include: {
      supplier: true,
      items: { include: { item: true } },
    },
  });

  const data: PurchaseRegisterData = {
    from: filter.from,
    to: filter.to,
    purchases: purchases.map((p) => ({
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      billNumber: p.billNumber,
      date: p.purchaseDate.toISOString().slice(0, 10),
      supplierName: p.supplier.name,
      supplierGstin: p.supplier.gstin,
      itemsSummary: p.items
        .map((li) => `${li.item.name} (${li.quantity.toFixed(2)} ${li.unit})`)
        .join(", "),
      taxable: p.taxableAmount.toFixed(2),
      cgst: p.cgstAmount.toFixed(2),
      sgst: p.sgstAmount.toFixed(2),
      igst: p.igstAmount.toFixed(2),
      total: p.totalAmount.toFixed(2),
      paymentStatus: p.paymentStatus,
    })),
  };

  return <PurchaseRegisterClient data={data} />;
}
