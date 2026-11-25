"use client";

import { useMemo, useState } from "react";
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

export interface SalesRegisterData {
  from: string;
  to: string;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    date: string;
    customerName: string;
    state: string;
    gstin: string | null;
    status: string;
    taxable: string;
    cgst: string;
    sgst: string;
    igst: string;
    total: string;
  }>;
  byCustomer: Array<{
    customerId: string;
    customerName: string;
    state: string;
    invoiceCount: number;
    taxable: string;
    tax: string;
    total: string;
  }>;
  byProduct: Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    hsnCode: string;
    unit: string;
    qtySold: string;
    taxable: string;
    tax: string;
    total: string;
  }>;
}

export function SalesRegisterClient({ data }: { data: SalesRegisterData }) {
  const [tab, setTab] = useState<"invoices" | "customers" | "products">("invoices");

  const totals = useMemo(() => {
    let taxable = money(0);
    let cgst = money(0);
    let sgst = money(0);
    let igst = money(0);
    let total = money(0);
    for (const inv of data.invoices) {
      if (inv.status === "CANCELLED") continue;
      taxable = money(taxable.plus(inv.taxable));
      cgst = money(cgst.plus(inv.cgst));
      sgst = money(sgst.plus(inv.sgst));
      igst = money(igst.plus(inv.igst));
      total = money(total.plus(inv.total));
    }
    return { taxable, cgst, sgst, igst, total };
  }, [data.invoices]);

  const getExportData = () => {
    if (tab === "customers") {
      return {
        filename: `Sales-By-Customer-${data.from}-to-${data.to}`,
        title: "Customer-Wise Sales Summary",
        headers: ["Customer", "State", "Invoices", "Taxable (INR)", "GST (INR)", "Total (INR)"],
        rows: data.byCustomer.map((c) => [
          c.customerName,
          c.state,
          c.invoiceCount,
          Number(c.taxable),
          Number(c.tax),
          Number(c.total),
        ]),
      };
    }
    if (tab === "products") {
      return {
        filename: `Sales-By-Product-${data.from}-to-${data.to}`,
        title: "Product-Wise Sales Summary",
        headers: ["SKU", "Product", "HSN", "Qty Sold", "Unit", "Taxable (INR)", "GST (INR)", "Total (INR)"],
        rows: data.byProduct.map((p) => [
          p.itemCode,
          p.itemName,
          p.hsnCode,
          Number(p.qtySold),
          p.unit,
          Number(p.taxable),
          Number(p.tax),
          Number(p.total),
        ]),
      };
    }
    return {
      filename: `Sales-Register-${data.from}-to-${data.to}`,
      title: "Sales Register (Outward Supplies)",
      headers: [
        "Invoice #",
        "Date",
        "Customer",
        "State",
        "GSTIN",
        "Status",
        "Taxable",
        "CGST",
        "SGST",
        "IGST",
        "Total",
      ],
      rows: data.invoices.map((i) => [
        i.invoiceNumber,
        i.date,
        i.customerName,
        i.state,
        i.gstin ?? "URP",
        i.status,
        Number(i.taxable),
        Number(i.cgst),
        Number(i.sgst),
        Number(i.igst),
        Number(i.total),
      ]),
    };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Register"
        subtitle="Invoice-wise, customer-wise, and product-wise outward supplies"
      />

      <AuditorFilterBar
        from={data.from}
        to={data.to}
        exportActions={
          <ExportButtons
            onExcel={() => {
              const e = getExportData();
              downloadXlsx(`${e.filename}.xlsx`, "Sales Register", e.headers, e.rows);
            }}
            onCsv={() => {
              const e = getExportData();
              downloadCsv(`${e.filename}.csv`, e.headers, e.rows);
            }}
            onPdf={() => {
              const e = getExportData();
              downloadReportPdf(
                `${e.filename}.pdf`,
                e.title,
                `Period: ${data.from} to ${data.to}`,
                e.headers,
                e.rows
              );
            }}
          />
        }
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["invoices", `Invoice-Wise (${data.invoices.length})`],
            ["customers", `Customer-Wise (${data.byCustomer.length})`],
            ["products", `Product-Wise (${data.byProduct.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`h-9 rounded-lg px-3.5 text-xs font-medium ${
              tab === k
                ? "bg-[#047857] text-white"
                : "border border-[#E2E8F0] bg-white text-[#475569]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "invoices" ? (
        <ResponsiveTable
          data={data.invoices}
          keyExtractor={(r) => r.id}
          emptyTitle="No sales invoices in this period"
          mobileTitle={(r) => r.invoiceNumber}
          mobileSubtitle={(r) => <StatusBadge status={r.status} />}
          footer={
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right text-xs uppercase">
                Posted Totals
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
            </tr>
          }
          columns={[
            {
              key: "num",
              header: "Invoice #",
              render: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span>,
            },
            { key: "date", header: "Date", render: (r) => r.date },
            { key: "cust", header: "Customer", render: (r) => r.customerName },
            { key: "state", header: "State", render: (r) => r.state },
            {
              key: "status",
              header: "Status",
              render: (r) => <StatusBadge status={r.status} />,
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
          ]}
        />
      ) : null}

      {tab === "customers" ? (
        <ResponsiveTable
          data={data.byCustomer}
          keyExtractor={(r) => r.customerId}
          emptyTitle="No customer sales in this period"
          mobileTitle={(r) => r.customerName}
          columns={[
            { key: "cust", header: "Customer", render: (r) => r.customerName },
            { key: "state", header: "State", render: (r) => r.state },
            {
              key: "cnt",
              header: "Invoices",
              align: "right",
              render: (r) => r.invoiceCount,
            },
            {
              key: "taxable",
              header: "Taxable",
              align: "right",
              render: (r) => formatINR(r.taxable),
            },
            {
              key: "tax",
              header: "GST",
              align: "right",
              render: (r) => formatINR(r.tax),
            },
            {
              key: "total",
              header: "Total",
              align: "right",
              render: (r) => formatINR(r.total),
            },
          ]}
        />
      ) : null}

      {tab === "products" ? (
        <ResponsiveTable
          data={data.byProduct}
          keyExtractor={(r) => r.itemId}
          emptyTitle="No product sales in this period"
          mobileTitle={(r) => r.itemName}
          columns={[
            {
              key: "code",
              header: "SKU",
              render: (r) => <span className="font-mono text-xs">{r.itemCode}</span>,
            },
            { key: "name", header: "Product", render: (r) => r.itemName },
            {
              key: "hsn",
              header: "HSN",
              render: (r) => <span className="font-mono text-xs">{r.hsnCode}</span>,
            },
            {
              key: "qty",
              header: "Qty Sold",
              align: "right",
              render: (r) => `${Number(r.qtySold).toFixed(0)} ${r.unit}`,
            },
            {
              key: "taxable",
              header: "Taxable",
              align: "right",
              render: (r) => formatINR(r.taxable),
            },
            {
              key: "tax",
              header: "GST",
              align: "right",
              render: (r) => formatINR(r.tax),
            },
            {
              key: "total",
              header: "Total",
              align: "right",
              render: (r) => formatINR(r.total),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
