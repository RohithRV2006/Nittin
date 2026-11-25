"use client";

import { useState } from "react";
import { AuditorFilterBar } from "@/components/auditor/AuditorFilterBar";
import { ExportButtons } from "@/components/auditor/ExportButtons";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { formatINR } from "@/lib/decimal";
import {
  downloadCsv,
  downloadReportPdf,
  downloadXlsx,
} from "@/lib/exports/report-exports";

export interface ReceivablesPageData {
  from: string;
  to: string;
  debtors: Array<{
    customerId: string;
    customerName: string;
    state: string;
    totalInvoiced: string;
    totalPaid: string;
    outstanding: string;
    bucket0_30: string;
    bucket31_60: string;
    bucket61_90: string;
    bucket90Plus: string;
  }>;
  payments: Array<{
    id: string;
    date: string;
    customerName: string;
    invoiceNumber: string | null;
    mode: string;
    referenceNumber: string | null;
    amount: string;
  }>;
}

export function ReceivablesClient({ data }: { data: ReceivablesPageData }) {
  const [tab, setTab] = useState<"ageing" | "collections">("ageing");

  const getExport = () => {
    if (tab === "collections") {
      return {
        filename: `Collections-Register-${data.from}-to-${data.to}`,
        title: "Customer Payments & Collections Register",
        headers: ["Date", "Customer", "Invoice #", "Mode", "UTR / Ref", "Amount (INR)"],
        rows: data.payments.map((p) => [
          p.date,
          p.customerName,
          p.invoiceNumber ?? "",
          p.mode,
          p.referenceNumber ?? "",
          Number(p.amount),
        ]),
      };
    }
    return {
      filename: `Receivables-Ageing-${data.to}`,
      title: "Customer Receivables & Ageing Analysis",
      headers: [
        "Customer",
        "State",
        "Total Invoiced",
        "Total Paid",
        "Outstanding",
        "0-30 Days",
        "31-60 Days",
        "61-90 Days",
        "90+ Days",
      ],
      rows: data.debtors.map((d) => [
        d.customerName,
        d.state,
        Number(d.totalInvoiced),
        Number(d.totalPaid),
        Number(d.outstanding),
        Number(d.bucket0_30),
        Number(d.bucket31_60),
        Number(d.bucket61_90),
        Number(d.bucket90Plus),
      ]),
    };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments, Collections & Receivables Ageing"
        subtitle="Customer dues across 0-30, 31-60, 61-90, and 90+ day ageing buckets"
      />

      <AuditorFilterBar
        from={data.from}
        to={data.to}
        exportActions={
          <ExportButtons
            onExcel={() => {
              const e = getExport();
              downloadXlsx(`${e.filename}.xlsx`, "Receivables", e.headers, e.rows);
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
                `As of ${data.to}`,
                e.headers,
                e.rows
              );
            }}
          />
        }
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("ageing")}
          className={`h-9 rounded-lg px-3.5 text-xs font-medium ${
            tab === "ageing"
              ? "bg-[var(--brand-primary)] text-white"
              : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
          }`}
        >
          Debtors Ageing ({data.debtors.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("collections")}
          className={`h-9 rounded-lg px-3.5 text-xs font-medium ${
            tab === "collections"
              ? "bg-[var(--brand-primary)] text-white"
              : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
          }`}
        >
          Collections Register ({data.payments.length})
        </button>
      </div>

      {tab === "ageing" ? (
        <ResponsiveTable
          data={data.debtors}
          keyExtractor={(r) => r.customerId}
          emptyTitle="No customer receivables"
          mobileTitle={(r) => r.customerName}
          columns={[
            { key: "cust", header: "Customer", render: (r) => r.customerName },
            { key: "state", header: "State", render: (r) => r.state },
            {
              key: "inv",
              header: "Invoiced",
              align: "right",
              render: (r) => formatINR(r.totalInvoiced),
            },
            {
              key: "paid",
              header: "Collected",
              align: "right",
              render: (r) => formatINR(r.totalPaid),
            },
            {
              key: "due",
              header: "Outstanding",
              align: "right",
              render: (r) => (
                <strong className="text-amber-700 dark:text-amber-400">{formatINR(r.outstanding)}</strong>
              ),
            },
            {
              key: "b1",
              header: "0-30d",
              align: "right",
              render: (r) => formatINR(r.bucket0_30),
            },
            {
              key: "b2",
              header: "31-60d",
              align: "right",
              render: (r) => formatINR(r.bucket31_60),
            },
            {
              key: "b3",
              header: "61-90d",
              align: "right",
              render: (r) => formatINR(r.bucket61_90),
            },
            {
              key: "b4",
              header: "90+d",
              align: "right",
              render: (r) => formatINR(r.bucket90Plus),
            },
          ]}
        />
      ) : (
        <ResponsiveTable
          data={data.payments}
          keyExtractor={(r) => r.id}
          emptyTitle="No payments received in this period"
          mobileTitle={(r) => r.customerName}
          columns={[
            { key: "date", header: "Date", render: (r) => r.date },
            { key: "cust", header: "Customer", render: (r) => r.customerName },
            {
              key: "inv",
              header: "Invoice #",
              render: (r) => (
                <span className="font-mono text-xs">{r.invoiceNumber ?? "—"}</span>
              ),
            },
            {
              key: "mode",
              header: "Mode",
              render: (r) => r.mode.replace("_", " "),
            },
            {
              key: "ref",
              header: "UTR / Ref",
              render: (r) => r.referenceNumber ?? "—",
            },
            {
              key: "amt",
              header: "Amount",
              align: "right",
              render: (r) => formatINR(r.amount),
            },
          ]}
        />
      )}
    </div>
  );
}
