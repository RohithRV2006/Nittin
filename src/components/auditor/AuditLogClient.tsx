"use client";

import { useMemo, useState } from "react";
import { AuditorFilterBar } from "@/components/auditor/AuditorFilterBar";
import { ExportButtons } from "@/components/auditor/ExportButtons";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  downloadCsv,
  downloadReportPdf,
  downloadXlsx,
} from "@/lib/exports/report-exports";

export interface AuditLogPageData {
  from: string;
  to: string;
  logs: Array<{
    id: string;
    timestamp: string;
    actorName: string;
    actorRole: string;
    entityType: string;
    entityId: string;
    action: string;
    reason: string | null;
    changesPreview: string;
  }>;
}

export function AuditLogClient({ data }: { data: AuditLogPageData }) {
  const [entityFilter, setEntityFilter] = useState("ALL");

  const entityTypes = useMemo(
    () => Array.from(new Set(data.logs.map((l) => l.entityType))).sort(),
    [data.logs]
  );

  const filtered = useMemo(() => {
    if (entityFilter === "ALL") return data.logs;
    return data.logs.filter((l) => l.entityType === entityFilter);
  }, [data.logs, entityFilter]);

  const headers = [
    "Timestamp",
    "Actor",
    "Role",
    "Entity",
    "Action",
    "Reason",
    "Details",
  ];
  const rows = filtered.map((l) => [
    l.timestamp,
    l.actorName,
    l.actorRole,
    l.entityType,
    l.action,
    l.reason ?? "",
    l.changesPreview,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        subtitle="Immutable record of order edits, invoice cancellations, production runs, and stock adjustments"
      />

      <AuditorFilterBar
        from={data.from}
        to={data.to}
        exportActions={
          <ExportButtons
            onExcel={() =>
              downloadXlsx(
                `Audit-Trail-${data.from}-to-${data.to}.xlsx`,
                "Audit Trail",
                headers,
                rows
              )
            }
            onCsv={() =>
              downloadCsv(
                `Audit-Trail-${data.from}-to-${data.to}.csv`,
                headers,
                rows
              )
            }
            onPdf={() =>
              void downloadReportPdf(
                `Audit-Trail-${data.from}-to-${data.to}.pdf`,
                "System Audit Trail",
                `Period: ${data.from} to ${data.to}`,
                headers,
                rows,
                undefined,
                {
                  orientation: "landscape",
                  columnStyles: {
                    0: { cellWidth: 28 },
                    1: { cellWidth: 28 },
                    2: { cellWidth: 26 },
                    3: { cellWidth: 28 },
                    4: { cellWidth: 20 },
                    5: { cellWidth: 42 },
                    6: { cellWidth: "auto" },
                  },
                }
              )
            }
          />
        }
      />

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Entity Type:</label>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-xs"
        >
          <option value="ALL">All Entities</option>
          {entityTypes.map((et) => (
            <option key={et} value={et}>
              {et}
            </option>
          ))}
        </select>
      </div>

      <ResponsiveTable
        data={filtered}
        keyExtractor={(r) => r.id}
        emptyTitle="No audit events in this period"
        mobileTitle={(r) => `${r.action} ${r.entityType}`}
        mobileSubtitle={(r) => r.timestamp}
        columns={[
          { key: "ts", header: "Timestamp", render: (r) => r.timestamp },
          {
            key: "actor",
            header: "User",
            render: (r) => `${r.actorName} (${r.actorRole})`,
          },
          {
            key: "entity",
            header: "Entity",
            render: (r) => (
              <span className="font-mono text-xs">{r.entityType}</span>
            ),
          },
          {
            key: "action",
            header: "Action",
            render: (r) => (
              <StatusBadge
                status={
                  r.action === "CANCEL" || r.action === "REJECT"
                    ? "CANCELLED"
                    : r.action === "ADJUST"
                      ? "ON_HOLD"
                      : "SUFFICIENT"
                }
                customLabel={r.action}
              />
            ),
          },
          { key: "reason", header: "Reason", render: (r) => r.reason ?? "—" },
          {
            key: "diff",
            header: "Payload Snapshot",
            render: (r) => (
              <span className="block max-w-xs truncate font-mono text-[11px] text-[var(--text-secondary)]">
                {r.changesPreview}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
