"use client";

import Link from "next/link";
import { Download } from "lucide-react";
import { AuditorFilterBar } from "@/components/auditor/AuditorFilterBar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { formatINR } from "@/lib/decimal";
import {
  generateTallyExcelRows,
  generateTallyXml,
  type TallyInvoiceInput,
  type TallyPurchaseInput,
  type TallyReceiptInput,
} from "@/lib/engines/tally";
import { downloadXlsx, downloadXmlFile } from "@/lib/exports/report-exports";

export interface AuditorCenterData {
  from: string;
  to: string;
  companyName: string;
  kpis: {
    salesTotal: string;
    purchaseTotal: string;
    collectionsTotal: string;
    productionRunsCount: number;
    varianceFlaggedCount: number;
    stockValuation: string;
  };
  tallyInvoices: TallyInvoiceInput[];
  tallyPurchases: TallyPurchaseInput[];
  tallyReceipts: TallyReceiptInput[];
}

const REPORTS = [
  {
    href: "/auditor/sales-register",
    title: "Sales Register",
    desc: "Invoice-wise, customer-wise & product-wise outward supplies",
  },
  {
    href: "/auditor/gst-summary",
    title: "GST Summary (GSTR-1 / 3B)",
    desc: "B2B, B2C, Table 9B Credit Notes & rate-wise CGST/SGST/IGST",
  },
  {
    href: "/auditor/purchase-register",
    title: "Purchase Register",
    desc: "Inward supplier bills, GSTIN & input tax credits",
  },
  {
    href: "/auditor/stock-ledger",
    title: "Stock Summary & Ledger",
    desc: "Opening + Inward - Outward = Closing & FIFO batch reconciliation",
  },
  {
    href: "/auditor/production-report",
    title: "Production Variance & Costing",
    desc: "Planned vs actual consumption, yield, scrap & cost per packet",
  },
  {
    href: "/auditor/receivables",
    title: "Receivables & Collections",
    desc: "Payments register & 0-30 / 31-60 / 61-90 / 90+ day ageing",
  },
  {
    href: "/auditor/audit-log",
    title: "Audit Trail",
    desc: "Immutable log of edits, overrides & cancellations with user/reason",
  },
];

export function AuditorCenterClient({ data }: { data: AuditorCenterData }) {
  const qs = `?from=${encodeURIComponent(data.from)}&to=${encodeURIComponent(data.to)}`;

  const handleTallyXml = () => {
    const xml = generateTallyXml({
      companyName: data.companyName,
      invoices: data.tallyInvoices,
      purchases: data.tallyPurchases,
      receipts: data.tallyReceipts,
    });
    downloadXmlFile(`Tally-Vouchers-${data.from}-to-${data.to}.xml`, xml);
  };

  const handleTallyExcel = () => {
    const rows = generateTallyExcelRows({
      invoices: data.tallyInvoices,
      purchases: data.tallyPurchases,
      receipts: data.tallyReceipts,
    });
    downloadXlsx(
      `Tally-Vouchers-${data.from}-to-${data.to}.xlsx`,
      "Tally Vouchers",
      [
        "Date",
        "Voucher Type",
        "Voucher No",
        "Party Ledger",
        "GSTIN",
        "Particulars",
        "Taxable",
        "CGST",
        "SGST",
        "IGST",
        "Total",
      ],
      rows
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditor Workspace & Report Center"
        subtitle="Read-only statutory statements, ledger reconciliations, and Tally exports"
      />

      <AuditorFilterBar
        from={data.from}
        to={data.to}
        exportActions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTallyExcel}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#0F172A] hover:bg-[#F1F5F9]"
            >
              <Download className="h-3.5 w-3.5" />
              Export Tally Excel
            </button>
            <button
              type="button"
              onClick={handleTallyXml}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#047857] px-3 text-xs font-semibold text-white hover:bg-[#065F46]"
            >
              <Download className="h-3.5 w-3.5" />
              Export Tally XML
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Period Sales (Inv)" value={formatINR(data.kpis.salesTotal)} />
        <StatCard label="Period Purchases" value={formatINR(data.kpis.purchaseTotal)} />
        <StatCard
          label="Collections"
          value={formatINR(data.kpis.collectionsTotal)}
          tone="success"
        />
        <StatCard
          label="Production Runs"
          value={data.kpis.productionRunsCount}
          sublabel={`${data.kpis.varianceFlaggedCount} variance flagged`}
          tone={data.kpis.varianceFlaggedCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="FIFO Stock Valuation"
          value={formatINR(data.kpis.stockValuation)}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={`${r.href}${qs}`}
            className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-[#047857]"
          >
            <h2 className="text-sm font-semibold text-[#0F172A]">{r.title}</h2>
            <p className="mt-1 text-xs text-[#64748B]">{r.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
