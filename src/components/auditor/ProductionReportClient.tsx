"use client";

import { AuditorFilterBar } from "@/components/auditor/AuditorFilterBar";
import { ExportButtons } from "@/components/auditor/ExportButtons";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR } from "@/lib/decimal";
import {
  downloadCsv,
  downloadReportPdf,
  downloadXlsx,
} from "@/lib/exports/report-exports";

export interface ProductionReportData {
  from: string;
  to: string;
  runs: Array<{
    id: string;
    runNumber: string;
    date: string;
    productName: string;
    status: string;
    plannedOutput: string;
    actualOutput: string;
    unit: string;
    yieldVariancePercent: string;
    varianceFlagged: boolean;
    consumptionsSummary: string;
    totalScrapQty: string;
    materialCost: string;
    overheadsCost: string;
    totalRunCost: string;
    costPerPacket: string | null;
  }>;
}

export function ProductionReportClient({
  data,
}: {
  data: ProductionReportData;
}) {
  const headers = [
    "Run #",
    "Date",
    "Product",
    "Status",
    "Planned Yield",
    "Actual Yield",
    "Yield Var %",
    "Consumptions",
    "Scrap Qty",
    "Material Cost",
    "Overheads",
    "Total Cost",
    "Cost/Packet",
  ];
  const rows = data.runs.map((r) => [
    r.runNumber,
    r.date,
    r.productName,
    r.status,
    Number(r.plannedOutput),
    Number(r.actualOutput),
    Number(r.yieldVariancePercent),
    r.consumptionsSummary,
    Number(r.totalScrapQty),
    Number(r.materialCost),
    Number(r.overheadsCost),
    Number(r.totalRunCost),
    r.costPerPacket ? Number(r.costPerPacket) : 0,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Variance & Costing Report"
        subtitle="Batch-wise planned vs. actual consumption, yield variance, scrap, overheads, and cost per packet"
      />

      <AuditorFilterBar
        from={data.from}
        to={data.to}
        exportActions={
          <ExportButtons
            onExcel={() =>
              downloadXlsx(
                `Production-Report-${data.from}-to-${data.to}.xlsx`,
                "Production Report",
                headers,
                rows
              )
            }
            onCsv={() =>
              downloadCsv(
                `Production-Report-${data.from}-to-${data.to}.csv`,
                headers,
                rows
              )
            }
            onPdf={() =>
              void downloadReportPdf(
                `Production-Report-${data.from}-to-${data.to}.pdf`,
                "Production Variance & Costing Report",
                `Period: ${data.from} to ${data.to}`,
                headers,
                rows
              )
            }
          />
        }
      />

      <ResponsiveTable
        data={data.runs}
        keyExtractor={(r) => r.id}
        emptyTitle="No production runs in this period"
        mobileTitle={(r) => `${r.runNumber} — ${r.productName}`}
        mobileSubtitle={(r) => (
          <StatusBadge
            status={r.varianceFlagged ? "FLAGGED" : r.status}
            customLabel={r.varianceFlagged ? "Variance Alert" : undefined}
          />
        )}
        columns={[
          {
            key: "run",
            header: "Run #",
            render: (r) => <span className="font-mono text-xs">{r.runNumber}</span>,
          },
          { key: "date", header: "Date", render: (r) => r.date },
          { key: "prod", header: "Product", render: (r) => r.productName },
          {
            key: "yield",
            header: "Actual / Planned",
            align: "right",
            render: (r) => `${r.actualOutput} / ${r.plannedOutput} ${r.unit}`,
          },
          {
            key: "var",
            header: "Yield Var",
            align: "right",
            render: (r) => (
              <span
                className={
                  r.varianceFlagged ? "font-semibold text-red-700 dark:text-red-400" : "text-[#15803D]"
                }
              >
                {r.yieldVariancePercent}%
              </span>
            ),
          },
          {
            key: "cons",
            header: "Material Usage & Variances",
            render: (r) => (
              <span className="text-xs text-[var(--text-secondary)]">{r.consumptionsSummary}</span>
            ),
          },
          {
            key: "mat",
            header: "Material",
            align: "right",
            render: (r) => formatINR(r.materialCost),
          },
          {
            key: "ovh",
            header: "Overheads",
            align: "right",
            render: (r) => formatINR(r.overheadsCost),
          },
          {
            key: "pkt",
            header: "Cost/Pkt",
            align: "right",
            render: (r) =>
              r.costPerPacket ? formatINR(r.costPerPacket) : "N/A",
          },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <StatusBadge
                status={r.varianceFlagged ? "FLAGGED" : r.status}
                customLabel={r.varianceFlagged ? "Variance Alert" : undefined}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
