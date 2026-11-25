"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DispatchStatus, InvoiceStatus, PaymentStatus } from "@prisma/client";
import {
  cancelInvoiceWithCreditNoteAction,
  generateMockEInvoiceAction,
  recordDispatchAction,
} from "@/actions/billing.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR } from "@/lib/decimal";
import {
  downloadGstInvoicePdf,
  type PrintableInvoice,
} from "@/lib/pdf/invoice-pdf";

export interface InvoiceRow extends PrintableInvoice {
  id: string;
  status: InvoiceStatus;
  dispatchStatus: DispatchStatus;
  paymentStatus: PaymentStatus;
  creditNoteNumber: string | null;
}

function downloadJsonFile(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function InvoicesWorkspace({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    variant: "success" | "danger";
    text: string;
  } | null>(null);

  const [cancelTarget, setCancelTarget] = useState<InvoiceRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [eInvoicePreview, setEInvoicePreview] = useState<{
    invoiceNumber: string;
    irn: string;
    eInvoiceJson: unknown;
    eWayBillJson: unknown;
  } | null>(null);

  const handleDispatch = (inv: InvoiceRow) => {
    if (
      !window.confirm(
        `Confirm physical dispatch for ${inv.invoiceNumber}? This deducts finished goods from the Stock Ledger.`
      )
    ) {
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const res = await recordDispatchAction({
        invoiceId: inv.id,
        preferFefo: true,
      });
      if (!res.ok) {
        setFeedback({ variant: "danger", text: res.error ?? "Dispatch failed" });
        return;
      }
      setFeedback({
        variant: "success",
        text: `Dispatch recorded for ${inv.invoiceNumber}. Finished-goods stock updated.`,
      });
      router.refresh();
    });
  };

  const handleCancelInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await cancelInvoiceWithCreditNoteAction({
        invoiceId: cancelTarget.id,
        reason: cancelReason,
      });
      if (!res.ok) {
        setFeedback({ variant: "danger", text: res.error ?? "Cancellation failed" });
        return;
      }
      setCancelTarget(null);
      setCancelReason("");
      setFeedback({
        variant: "success",
        text: `Issued Credit Note ${res.data?.creditNoteNumber ?? ""}. ${
          res.data?.restocked
            ? "Dispatched stock was restocked into Stock Ledger."
            : "Invoice was not dispatched, so no stock adjustment was needed."
        }`,
      });
      router.refresh();
    });
  };

  const handleEInvoice = (inv: InvoiceRow) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await generateMockEInvoiceAction(inv.id);
      if (!res.ok || !res.data) {
        setFeedback({ variant: "danger", text: res.error ?? "Failed" });
        return;
      }
      setEInvoicePreview({
        invoiceNumber: inv.invoiceNumber,
        irn: res.data.irn,
        eInvoiceJson: res.data.eInvoiceJson,
        eWayBillJson: res.data.eWayBillJson,
      });
      router.refresh();
    });
  };

  const openWhatsApp = (inv: InvoiceRow) => {
    const cleanPhone = inv.buyer.phone.replace(/[^\d]/g, "");
    const text = encodeURIComponent(
      `Hello ${inv.buyer.name}, GST Invoice ${inv.invoiceNumber} dated ${inv.invoiceDate} from ${inv.seller.companyName} for ${formatINR(inv.totalAmount)} (Taxable: ${formatINR(inv.taxableAmount)}) has been generated. Thank you for your business.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="GST Invoicing & Dispatch Desk"
        subtitle="Download A4 GST tax invoices, share via WhatsApp, record dispatches, and export e-Invoice / e-Way Bill JSON"
      />

      {feedback ? (
        <InlineAlert variant={feedback.variant}>{feedback.text}</InlineAlert>
      ) : null}

      <ResponsiveTable
        data={invoices}
        keyExtractor={(r) => r.id}
        emptyTitle="No GST invoices generated yet"
        emptyDescription="Approve a pending order under Incoming Orders to generate a GST tax invoice."
        mobileTitle={(r) => r.invoiceNumber}
        mobileSubtitle={(r) => (
          <StatusBadge
            status={r.status === "CANCELLED" ? "CANCELLED" : r.dispatchStatus}
          />
        )}
        mobileActions={(r) => (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadGstInvoicePdf(r)}
              className="rounded-lg border border-[#CBD5E1] px-2.5 py-1 text-xs font-medium"
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => openWhatsApp(r)}
              className="rounded-lg border border-[#CBD5E1] px-2.5 py-1 text-xs font-medium"
            >
              WhatsApp
            </button>
            {r.status === "POSTED" && r.dispatchStatus === "PENDING_DISPATCH" ? (
              <button
                type="button"
                onClick={() => handleDispatch(r)}
                className="rounded-lg bg-[#047857] px-2.5 py-1 text-xs font-semibold text-white"
              >
                Dispatch
              </button>
            ) : null}
          </div>
        )}
        columns={[
          {
            key: "num",
            header: "Invoice #",
            render: (r) => (
              <div>
                <span className="font-mono text-xs font-semibold">{r.invoiceNumber}</span>
                {r.creditNoteNumber ? (
                  <p className="font-mono text-[10px] text-[#B91C1C]">
                    CN: {r.creditNoteNumber}
                  </p>
                ) : null}
              </div>
            ),
          },
          { key: "cust", header: "Customer", render: (r) => r.buyer.name },
          {
            key: "pos",
            header: "Supply",
            render: (r) => `${r.placeOfSupply} (${r.placeOfSupplyCode})`,
          },
          {
            key: "taxable",
            header: "Taxable",
            align: "right",
            render: (r) => formatINR(r.taxableAmount),
          },
          {
            key: "gst",
            header: "GST",
            align: "right",
            render: (r) =>
              Number(r.igstAmount) > 0
                ? `IGST ${formatINR(r.igstAmount)}`
                : `C+S ${formatINR(Number(r.cgstAmount) + Number(r.sgstAmount))}`,
          },
          {
            key: "total",
            header: "Total",
            align: "right",
            render: (r) => formatINR(r.totalAmount),
          },
          {
            key: "dispatch",
            header: "Dispatch",
            render: (r) => (
              <StatusBadge
                status={r.status === "CANCELLED" ? "CANCELLED" : r.dispatchStatus}
              />
            ),
          },
          {
            key: "pay",
            header: "Payment",
            render: (r) => <StatusBadge status={r.paymentStatus} />,
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (r) => (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => downloadGstInvoicePdf(r)}
                  className="text-xs font-medium text-[#047857] hover:underline"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => openWhatsApp(r)}
                  className="text-xs font-medium text-[#0369A1] hover:underline"
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleEInvoice(r)}
                  className="text-xs font-medium text-[#475569] hover:underline"
                >
                  e-Inv JSON
                </button>
                {r.status === "POSTED" && r.dispatchStatus === "PENDING_DISPATCH" ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDispatch(r)}
                    className="rounded bg-[#047857] px-2 py-0.5 text-xs font-semibold text-white"
                  >
                    Dispatch
                  </button>
                ) : null}
                {r.status === "POSTED" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelTarget(r);
                      setCancelReason("");
                    }}
                    className="text-xs font-medium text-[#B91C1C] hover:underline"
                  >
                    Credit Note
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
      />

      {/* Credit Note Cancellation Drawer */}
      <SlideOverDrawer
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title={`Cancel Invoice (Credit Note) — ${cancelTarget?.invoiceNumber ?? ""}`}
        subtitle="Posted invoices are never deleted; cancellation issues a permanent Credit Note"
      >
        {cancelTarget ? (
          <form onSubmit={handleCancelInvoice} className="space-y-4">
            <InlineAlert
              variant={
                cancelTarget.dispatchStatus === "DISPATCHED" ? "warning" : "info"
              }
            >
              {cancelTarget.dispatchStatus === "DISPATCHED"
                ? "This invoice was already dispatched. Issuing a Credit Note will restock the dispatched finished goods into Stock Ledger."
                : "This invoice is still Pending Dispatch. Issuing a Credit Note will cancel the invoice without altering stock."}
            </InlineAlert>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#475569]">
                Mandatory Audit Reason
              </label>
              <textarea
                rows={3}
                required
                minLength={5}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Explain why this invoice is being reversed..."
                className="w-full rounded-lg border border-[#CBD5E1] p-3 text-sm outline-none focus:border-[#047857]"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="h-10 w-full rounded-lg bg-[#B91C1C] text-sm font-semibold text-white hover:bg-[#991B1B]"
            >
              {isPending ? "Issuing Credit Note..." : "Issue Credit Note & Cancel Invoice"}
            </button>
          </form>
        ) : null}
      </SlideOverDrawer>

      {/* Mock e-Invoice & e-Way Bill JSON Drawer */}
      <SlideOverDrawer
        open={Boolean(eInvoicePreview)}
        onClose={() => setEInvoicePreview(null)}
        title={`e-Invoice & e-Way Bill (Mock NIC) — ${eInvoicePreview?.invoiceNumber ?? ""}`}
        subtitle="NIC GST v1.1 JSON payloads & deterministic IRN metadata"
      >
        {eInvoicePreview ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs">
              <p className="font-semibold text-[#0F172A]">Mocked IRN:</p>
              <p className="mt-1 font-mono break-all text-[#475569]">
                {eInvoicePreview.irn}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  downloadJsonFile(
                    `eInvoice-${eInvoicePreview.invoiceNumber.replace(/\//g, "-")}.json`,
                    eInvoicePreview.eInvoiceJson
                  )
                }
                className="h-10 rounded-lg bg-[#047857] text-xs font-semibold text-white"
              >
                Download e-Invoice JSON
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadJsonFile(
                    `eWayBill-${eInvoicePreview.invoiceNumber.replace(/\//g, "-")}.json`,
                    eInvoicePreview.eWayBillJson
                  )
                }
                className="h-10 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#0F172A]"
              >
                Download e-Way Bill JSON
              </button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg border border-[#E2E8F0] bg-[#0F172A] p-3 text-[11px] text-[#F8FAFC]">
              {JSON.stringify(eInvoicePreview.eInvoiceJson, null, 2)}
            </pre>
          </div>
        ) : null}
      </SlideOverDrawer>
    </div>
  );
}
