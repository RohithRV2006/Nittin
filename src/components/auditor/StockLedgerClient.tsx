"use client";

import { useMemo, useState } from "react";
import type { ItemCategory } from "@prisma/client";
import { AuditorFilterBar } from "@/components/auditor/AuditorFilterBar";
import { ExportButtons } from "@/components/auditor/ExportButtons";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR } from "@/lib/decimal";
import {
  downloadCsv,
  downloadReportPdf,
  downloadXlsx,
} from "@/lib/exports/report-exports";

export interface StockLedgerPageData {
  from: string;
  to: string;
  reconciled: boolean;
  summaryRows: Array<{
    itemId: string;
    code: string;
    name: string;
    category: ItemCategory;
    unit: string;
    openingQty: string;
    inwardQty: string;
    outwardQty: string;
    closingQty: string;
    batchRemainingQty: string;
    fifoValuation: string;
  }>;
  movements: Array<{
    id: string;
    timestamp: string;
    itemId: string;
    itemCode: string;
    itemName: string;
    category: ItemCategory;
    batchNumber: string | null;
    movementType: string;
    referenceType: string;
    referenceId: string;
    inwardQty: string;
    outwardQty: string;
    unit: string;
    balanceAfter: string;
    unitRate: string | null;
    totalValue: string | null;
    notes: string | null;
  }>;
}

export function StockLedgerClient({ data }: { data: StockLedgerPageData }) {
  const [tab, setTab] = useState<"summary" | "ledger">("summary");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [itemFilter, setItemFilter] = useState<string>("ALL");

  const filteredSummary = useMemo(() => {
    return data.summaryRows.filter((r) => {
      if (categoryFilter !== "ALL" && r.category !== categoryFilter) return false;
      if (itemFilter !== "ALL" && r.itemId !== itemFilter) return false;
      return true;
    });
  }, [data.summaryRows, categoryFilter, itemFilter]);

  const filteredMovements = useMemo(() => {
    return data.movements.filter((m) => {
      if (categoryFilter !== "ALL" && m.category !== categoryFilter) return false;
      if (itemFilter !== "ALL" && m.itemId !== itemFilter) return false;
      return true;
    });
  }, [data.movements, categoryFilter, itemFilter]);

  const getExport = () => {
    if (tab === "summary") {
      return {
        filename: `Stock-Summary-${data.from}-to-${data.to}`,
        title: "Stock Summary (Opening + Inward - Outward = Closing)",
        headers: [
          "SKU",
          "Item",
          "Category",
          "Unit",
          "Opening",
          "Inward (+)",
          "Outward (-)",
          "Closing",
          "FIFO Value (INR)",
        ],
        rows: filteredSummary.map((r) => [
          r.code,
          r.name,
          r.category,
          r.unit,
          Number(r.openingQty),
          Number(r.inwardQty),
          Number(r.outwardQty),
          Number(r.closingQty),
          Number(r.fifoValuation),
        ]),
      };
    }
    return {
      filename: `Stock-Ledger-${data.from}-to-${data.to}`,
      title: "Stock Movement Ledger",
      headers: [
        "Timestamp",
        "SKU",
        "Item",
        "Batch #",
        "Movement",
        "Ref Type",
        "Inward (+)",
        "Outward (-)",
        "Unit",
        "Balance After",
        "Unit Rate",
        "Notes",
      ],
      rows: filteredMovements.map((m) => [
        m.timestamp,
        m.itemCode,
        m.itemName,
        m.batchNumber ?? "",
        m.movementType,
        m.referenceType,
        Number(m.inwardQty),
        Number(m.outwardQty),
        m.unit,
        Number(m.balanceAfter),
        m.unitRate ? Number(m.unitRate) : 0,
        m.notes ?? "",
      ]),
    };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Summary & Movement Ledger"
        subtitle="Ledger-derived opening, inward, outward, closing balances and FIFO batch valuation"
      />

      <AuditorFilterBar
        from={data.from}
        to={data.to}
        exportActions={
          <ExportButtons
            onExcel={() => {
              const e = getExport();
              downloadXlsx(`${e.filename}.xlsx`, "Stock Report", e.headers, e.rows);
            }}
            onCsv={() => {
              const e = getExport();
              downloadCsv(`${e.filename}.csv`, e.headers, e.rows);
            }}
            onPdf={() => {
              const e = getExport();
              void downloadReportPdf(
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

      <InlineAlert
        variant={data.reconciled ? "success" : "danger"}
        title={
          data.reconciled
            ? "Ledger Reconciled: ΣΔQ Matches Open FIFO Batches 100%"
            : "Ledger Reconciliation Mismatch Detected"
        }
      >
        Every stock balance is derived mathematically from immutable signed ledger movements.
      </InlineAlert>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("summary")}
            className={`h-9 rounded-lg px-3.5 text-xs font-medium ${
              tab === "summary"
                ? "bg-[var(--brand-primary)] text-white"
                : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
            }`}
          >
            Stock Summary ({filteredSummary.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("ledger")}
            className={`h-9 rounded-lg px-3.5 text-xs font-medium ${
              tab === "ledger"
                ? "bg-[var(--brand-primary)] text-white"
                : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
            }`}
          >
            Movement Ledger ({filteredMovements.length})
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setItemFilter("ALL");
            }}
            className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 text-xs"
          >
            <option value="ALL">All Categories</option>
            <option value="RAW_MATERIAL">Raw Materials</option>
            <option value="PACKAGING">Packaging</option>
            <option value="FINISHED_GOOD">Finished Goods</option>
          </select>
          <select
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 text-xs"
          >
            <option value="ALL">All Items</option>
            {data.summaryRows.map((i) => (
              <option key={i.itemId} value={i.itemId}>
                {i.name} ({i.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {tab === "summary" ? (
        <ResponsiveTable
          data={filteredSummary}
          keyExtractor={(r) => r.itemId}
          emptyTitle="No items in catalog"
          mobileTitle={(r) => `${r.name} (${r.code})`}
          columns={[
            {
              key: "code",
              header: "SKU",
              render: (r) => <span className="font-mono text-xs">{r.code}</span>,
            },
            { key: "name", header: "Item", render: (r) => r.name },
            {
              key: "cat",
              header: "Category",
              render: (r) => (
                <span className="text-xs text-[var(--text-muted)]">
                  {r.category.replace("_", " ")}
                </span>
              ),
            },
            {
              key: "open",
              header: "Opening",
              align: "right",
              render: (r) => `${r.openingQty} ${r.unit}`,
            },
            {
              key: "in",
              header: "Inward (+)",
              align: "right",
              render: (r) => (
                <span className="text-[#15803D]">+{r.inwardQty}</span>
              ),
            },
            {
              key: "out",
              header: "Outward (-)",
              align: "right",
              render: (r) => (
                <span className="text-red-700 dark:text-red-400">-{r.outwardQty}</span>
              ),
            },
            {
              key: "close",
              header: "Closing",
              align: "right",
              render: (r) => (
                <strong>
                  {r.closingQty} {r.unit}
                </strong>
              ),
            },
            {
              key: "val",
              header: "Current FIFO Value",
              align: "right",
              render: (r) => formatINR(r.fifoValuation),
            },
          ]}
        />
      ) : (
        <ResponsiveTable
          data={filteredMovements}
          keyExtractor={(r) => r.id}
          emptyTitle="No stock movements in this period"
          mobileTitle={(r) => `${r.itemName} (${r.movementType})`}
          columns={[
            { key: "ts", header: "Timestamp", render: (r) => r.timestamp },
            {
              key: "sku",
              header: "Item",
              render: (r) => (
                <span>
                  {r.itemName}{" "}
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    ({r.itemCode})
                  </span>
                </span>
              ),
            },
            {
              key: "batch",
              header: "Batch #",
              render: (r) => (
                <span className="font-mono text-xs">{r.batchNumber ?? "—"}</span>
              ),
            },
            {
              key: "type",
              header: "Movement",
              render: (r) => (
                <StatusBadge
                  status={
                    Number(r.inwardQty) > 0
                      ? "SUFFICIENT"
                      : r.movementType === "SCRAP_DAMAGE"
                        ? "FLAGGED"
                        : "INVOICED"
                  }
                  customLabel={r.movementType.replace("_", " ")}
                />
              ),
            },
            {
              key: "in",
              header: "In (+)",
              align: "right",
              render: (r) =>
                Number(r.inwardQty) > 0 ? `+${r.inwardQty}` : "—",
            },
            {
              key: "out",
              header: "Out (-)",
              align: "right",
              render: (r) =>
                Number(r.outwardQty) > 0 ? `-${r.outwardQty}` : "—",
            },
            {
              key: "bal",
              header: "Balance After",
              align: "right",
              render: (r) => `${r.balanceAfter} ${r.unit}`,
            },
            {
              key: "rate",
              header: "Rate",
              align: "right",
              render: (r) => (r.unitRate ? formatINR(r.unitRate) : "—"),
            },
            {
              key: "notes",
              header: "Source / Notes",
              render: (r) => (
                <span className="text-xs text-[var(--text-secondary)]">{r.notes ?? r.referenceType}</span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
