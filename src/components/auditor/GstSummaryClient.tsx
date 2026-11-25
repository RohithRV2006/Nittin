"use client";

import { AuditorFilterBar } from "@/components/auditor/AuditorFilterBar";
import { ExportButtons } from "@/components/auditor/ExportButtons";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { StatCard } from "@/components/ui/StatCard";
import { formatINR } from "@/lib/decimal";
import {
  downloadCsv,
  downloadReportPdf,
  downloadXlsx,
} from "@/lib/exports/report-exports";

export interface GstSummaryData {
  from: string;
  to: string;
  totals: {
    taxable: string;
    cgst: string;
    sgst: string;
    igst: string;
    creditNoteTax: string;
  };
  sections: Array<{
    section: string;
    description: string;
    docCount: number;
    taxable: string;
    cgst: string;
    sgst: string;
    igst: string;
    total: string;
  }>;
  rateSummary: Array<{
    taxRate: string;
    taxable: string;
    cgst: string;
    sgst: string;
    igst: string;
    totalTax: string;
  }>;
}

export function GstSummaryClient({ data }: { data: GstSummaryData }) {
  const headers = [
    "GSTR Section",
    "Description",
    "Docs",
    "Taxable (INR)",
    "CGST (INR)",
    "SGST (INR)",
    "IGST (INR)",
    "Total (INR)",
  ];
  const rows = data.sections.map((s) => [
    s.section,
    s.description,
    s.docCount,
    Number(s.taxable),
    Number(s.cgst),
    Number(s.sgst),
    Number(s.igst),
    Number(s.total),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="GST Summary (GSTR-1 / GSTR-3B)"
        subtitle="Outward supplies grouped into statutory B2B, B2C, Credit Notes (9B), and rate slabs"
      />

      <AuditorFilterBar
        from={data.from}
        to={data.to}
        exportActions={
          <ExportButtons
            onExcel={() =>
              downloadXlsx(
                `GSTR1-Summary-${data.from}-to-${data.to}.xlsx`,
                "GSTR-1 Summary",
                headers,
                rows
              )
            }
            onCsv={() =>
              downloadCsv(
                `GSTR1-Summary-${data.from}-to-${data.to}.csv`,
                headers,
                rows
              )
            }
            onPdf={() =>
              downloadReportPdf(
                `GSTR1-Summary-${data.from}-to-${data.to}.pdf`,
                "GSTR-1 / GSTR-3B Outward Supplies Summary",
                `Period: ${data.from} to ${data.to}`,
                headers,
                rows
              )
            }
          />
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Outward Taxable" value={formatINR(data.totals.taxable)} />
        <StatCard label="Output CGST" value={formatINR(data.totals.cgst)} />
        <StatCard label="Output SGST" value={formatINR(data.totals.sgst)} />
        <StatCard label="Output IGST" value={formatINR(data.totals.igst)} />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#0F172A]">
          GSTR-1 Return Table Breakdown
        </h2>
        <ResponsiveTable
          data={data.sections}
          keyExtractor={(r) => r.section}
          mobileTitle={(r) => r.section}
          columns={[
            {
              key: "sec",
              header: "Table",
              render: (r) => <span className="font-mono text-xs font-semibold">{r.section}</span>,
            },
            { key: "desc", header: "Supply Category", render: (r) => r.description },
            {
              key: "cnt",
              header: "Docs",
              align: "right",
              render: (r) => r.docCount,
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
              key: "tot",
              header: "Total",
              align: "right",
              render: (r) => formatINR(r.total),
            },
          ]}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#0F172A]">
          Rate-Wise Tax Summary (GSTR-3B 3.1a)
        </h2>
        <ResponsiveTable
          data={data.rateSummary}
          keyExtractor={(r) => r.taxRate}
          emptyTitle="No taxable supplies in this period"
          mobileTitle={(r) => `${r.taxRate}% GST Slab`}
          columns={[
            {
              key: "rate",
              header: "GST Slab",
              render: (r) => <span className="font-semibold">{r.taxRate}%</span>,
            },
            {
              key: "taxable",
              header: "Taxable Value",
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
              key: "tot",
              header: "Total Tax",
              align: "right",
              render: (r) => formatINR(r.totalTax),
            },
          ]}
        />
      </div>
    </div>
  );
}
