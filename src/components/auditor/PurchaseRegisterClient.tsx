"use client";

import { useMemo } from "react";
import { AuditorFilterBar } from "@/components/auditor/AuditorFilterBar";
import { ExportButtons } from "@/components/auditor/ExportButtons";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR, money } from "@/lib/decimal";
import {
  downloadCsv,
  downloadReportPdf,
  downloadXlsx,
} from "@/lib/exports/report-exports";

export interface PurchaseRegisterData {
  from: string;
  to: string;
  purchases: Array<{
    id: string;
    purchaseNumber: string;
    billNumber: string;
    date: string;
    supplierName: string;
    supplierGstin: string | null;
    itemsSummary: string;
    taxable: string;
    cgst: string;
    sgst: string;
    igst: string;
    total: string;
    paymentStatus: string;
  }>;
}

export function PurchaseRegisterClient({
  data,
}: {
  data: PurchaseRegisterData;
}) {
  const totals = useMemo(() => {
    let taxable = money(0);
    let cgst = money(0);
    let sgst = money(0);
    let igst = money(0);
    let total = money(0);
    for (const p of data.purchases) {
      taxable = money(taxable.plus(p.taxable));
      cgst = money(cgst.plus(p.cgst));
      sgst = money(sgst.plus(p.sgst));
      igst = money(igst.plus(p.igst));
      total = money(total.plus(p.total));
    }
    return { taxable, cgst, sgst, igst, total };
  }, [data.purchases]);

  const headers = [
    "Purchase #",
    "Bill #",
    "Date",
    "Supplier",
    "GSTIN",
    "Items",
    "Taxable",
    "CGST",
    "SGST",
    "IGST",
    "Total",
    "Status",
  ];
  const rows = data.purchases.map((p) => [
    p.purchaseNumber,
    p.billNumber,
    p.date,
    p.supplierName,
    p.supplierGstin ?? "URP",
    p.itemsSummary,
    Number(p.taxable),
    Number(p.cgst),
    Number(p.sgst),
    Number(p.igst),
    Number(p.total),
    p.paymentStatus,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Register"
        subtitle="Inward supplier bills, GSTIN details, and input tax credit breakdown"
      />

      <AuditorFilterBar
        from={data.from}
        to={data.to}
        exportActions={
          <ExportButtons
            onExcel={() =>
              downloadXlsx(
                `Purchase-Register-${data.from}-to-${data.to}.xlsx`,
                "Purchase Register",
                headers,
                rows
              )
            }
            onCsv={() =>
              downloadCsv(
                `Purchase-Register-${data.from}-to-${data.to}.csv`,
                headers,
                rows
              )
            }
            onPdf={() =>
              void downloadReportPdf(
                `Purchase-Register-${data.from}-to-${data.to}.pdf`,
                "Purchase Register",
                `Period: ${data.from} to ${data.to}`,
                headers,
                rows
              )
            }
          />
        }
      />

      <ResponsiveTable
        data={data.purchases}
        keyExtractor={(r) => r.id}
        emptyTitle="No inward purchases in this period"
        mobileTitle={(r) => r.purchaseNumber}
        mobileSubtitle={(r) => <StatusBadge status={r.paymentStatus} />}
        footer={
          <tr>
            <td colSpan={4} className="px-4 py-3 text-right text-xs uppercase">
              Totals
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              {formatINR(totals.taxable)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              {formatINR(totals.cgst)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              {formatINR(totals.sgst)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              {formatINR(totals.igst)}
            </td>
            <td className="px-4 py-3 text-right tabular-nums">
              {formatINR(totals.total)}
            </td>
            <td />
          </tr>
        }
        columns={[
          {
            key: "num",
            header: "Purchase #",
            render: (r) => <span className="font-mono text-xs">{r.purchaseNumber}</span>,
          },
          { key: "date", header: "Date", render: (r) => r.date },
          { key: "sup", header: "Supplier", render: (r) => r.supplierName },
          {
            key: "items",
            header: "Items",
            render: (r) => <span className="text-xs text-[var(--text-secondary)]">{r.itemsSummary}</span>,
          },
          {
            key: "taxable",
            header: "Taxable",
            align: "right",
            render: (r) => formatINR(r.taxable),
          },
          {
            key: "cgst",
            header: "CGST",
            align: "right",
            render: (r) => formatINR(r.cgst),
          },
          {
            key: "sgst",
            header: "SGST",
            align: "right",
            render: (r) => formatINR(r.sgst),
          },
          {
            key: "igst",
            header: "IGST",
            align: "right",
            render: (r) => formatINR(r.igst),
          },
          {
            key: "total",
            header: "Total",
            align: "right",
            render: (r) => formatINR(r.total),
          },
          {
            key: "status",
            header: "Payment",
            render: (r) => <StatusBadge status={r.paymentStatus} />,
          },
        ]}
      />
    </div>
  );
}
