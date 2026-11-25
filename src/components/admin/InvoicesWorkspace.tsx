"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  DispatchStatus,
  InvoiceStatus,
  PaymentStatus,
  ReturnCondition,
} from "@prisma/client";
import { Search } from "lucide-react";
import { toast } from "sonner";
import {
  cancelInvoiceWithCreditNoteAction,
  generateMockEInvoiceAction,
  recordDispatchAction,
  recordSalesReturnAction,
} from "@/actions/billing.actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR } from "@/lib/decimal";
import { formatDisplayQty, isIntegerUnit } from "@/lib/enums";
import {
  downloadCreditNotePdf,
  downloadDeliveryChallanPdf,
  downloadGstInvoicePdf,
  type PrintableInvoice,
} from "@/lib/pdf/invoice-pdf";

export interface InvoiceLineRow {
  invoiceItemId: string;
  itemName: string;
  hsnCode: string;
  quantity: string;
  dispatchedQty: string;
  returnedQty: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalAmount: string;
}

export interface ChallanRow {
  id: string;
  challanNumber: string;
  dispatchedDate: string;
  vehicleNumber: string | null;
  notes: string | null;
  items: Array<{ itemName: string; quantity: string; unit: string }>;
}

export interface CreditNoteRow {
  id: string;
  creditNoteNumber: string;
  issuedDate: string;
  type: string;
  reason: string;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  amount: string;
  items: Array<{
    itemName: string;
    returnedQty: string;
    unit: string;
    condition: string;
    totalAmount: string;
  }>;
}

export interface InvoiceRow extends Omit<PrintableInvoice, "items"> {
  id: string;
  status: InvoiceStatus;
  dispatchStatus: DispatchStatus;
  paymentStatus: PaymentStatus;
  creditTotal: string;
  creditNoteNumber: string | null;
  items: InvoiceLineRow[];
  challans: ChallanRow[];
  creditNotes: CreditNoteRow[];
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

const PAGE_SIZE = 20;
const inputCls =
  "h-9 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]";

export function InvoicesWorkspace({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING_DISPATCH" | "PARTIALLY_DISPATCHED" | "DISPATCHED" | "CANCELLED"
  >("ALL");
  const [page, setPage] = useState(1);

  // Dispatch drawer state (partial or full remaining)
  const [dispatchTarget, setDispatchTarget] = useState<InvoiceRow | null>(null);
  const [dispatchQtys, setDispatchQtys] = useState<Record<string, string>>({});
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [confirmFullDispatch, setConfirmFullDispatch] = useState<InvoiceRow | null>(null);

  // Sales return drawer state
  const [returnTarget, setReturnTarget] = useState<InvoiceRow | null>(null);
  const [returnLines, setReturnLines] = useState<
    Record<string, { qty: string; condition: ReturnCondition }>
  >({});
  const [returnReason, setReturnReason] = useState("");

  // Cancellation drawer
  const [cancelTarget, setCancelTarget] = useState<InvoiceRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // e-Invoice preview drawer
  const [eInvoicePreview, setEInvoicePreview] = useState<{
    invoiceNumber: string;
    irn: string;
    eInvoiceJson: unknown;
    eWayBillJson: unknown;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter === "CANCELLED") {
        if (inv.status !== "CANCELLED") return false;
      } else if (statusFilter !== "ALL") {
        if (inv.status !== "POSTED" || inv.dispatchStatus !== statusFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.orderNumber.toLowerCase().includes(q) ||
        inv.buyer.name.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDownloadPdf = (inv: InvoiceRow) => {
    void downloadGstInvoicePdf(inv).catch(() => {
      toast.error("Failed to generate invoice PDF.");
    });
  };

  const openDispatchDrawer = (inv: InvoiceRow) => {
    const next: Record<string, string> = {};
    for (const li of inv.items) {
      const rem = Math.max(0, Number(li.quantity) - Number(li.dispatchedQty));
      next[li.invoiceItemId] =
        rem > 0 ? formatDisplayQty(rem, li.unit) : "0";
    }
    setDispatchQtys(next);
    setVehicleNumber("");
    setDispatchNotes("");
    setDispatchTarget(inv);
  };

  const handleDispatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchTarget) return;
    const lines = dispatchTarget.items
      .map((li) => ({
        invoiceItemId: li.invoiceItemId,
        quantity: Number(dispatchQtys[li.invoiceItemId] ?? "0"),
      }))
      .filter((x) => x.quantity > 0);

    if (lines.length === 0) {
      toast.error("Enter a positive dispatch quantity for at least one item.");
      return;
    }

    startTransition(async () => {
      const res = await recordDispatchAction({
        invoiceId: dispatchTarget.id,
        preferFefo: true,
        vehicleNumber,
        notes: dispatchNotes,
        items: lines,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Dispatch failed");
        return;
      }
      toast.success(
        `Challan ${res.data?.challanNumber ?? ""} recorded (${res.data?.dispatchStatus === "PARTIALLY_DISPATCHED" ? "Partial Dispatch" : "Dispatched"}).`
      );
      setDispatchTarget(null);
      router.refresh();
    });
  };

  const handleQuickFullDispatch = () => {
    if (!confirmFullDispatch) return;
    startTransition(async () => {
      const res = await recordDispatchAction({
        invoiceId: confirmFullDispatch.id,
        preferFefo: true,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Dispatch failed");
        return;
      }
      toast.success(`Challan ${res.data?.challanNumber ?? ""} dispatched.`);
      setConfirmFullDispatch(null);
      router.refresh();
    });
  };

  const openReturnDrawer = (inv: InvoiceRow) => {
    const next: Record<string, { qty: string; condition: ReturnCondition }> = {};
    for (const li of inv.items) {
      next[li.invoiceItemId] = { qty: "0", condition: "RESALEABLE" };
    }
    setReturnLines(next);
    setReturnReason("");
    setReturnTarget(inv);
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnTarget) return;
    const items = returnTarget.items
      .map((li) => {
        const entry = returnLines[li.invoiceItemId];
        return {
          invoiceItemId: li.invoiceItemId,
          quantity: Number(entry?.qty ?? "0"),
          condition: entry?.condition ?? ("RESALEABLE" as ReturnCondition),
        };
      })
      .filter((x) => x.quantity > 0);

    if (items.length === 0) {
      toast.error("Enter a return quantity > 0 for at least one dispatched item.");
      return;
    }

    startTransition(async () => {
      const res = await recordSalesReturnAction({
        invoiceId: returnTarget.id,
        reason: returnReason,
        items,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Sales return failed");
        return;
      }
      toast.success(
        `Sales Return ${res.data?.creditNoteNumber ?? ""} issued (${formatINR(res.data?.totalCredit ?? "0")}).`
      );
      setReturnTarget(null);
      router.refresh();
    });
  };

  const handleCancelInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    startTransition(async () => {
      const res = await cancelInvoiceWithCreditNoteAction({
        invoiceId: cancelTarget.id,
        reason: cancelReason,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Cancellation failed");
        return;
      }
      setCancelTarget(null);
      setCancelReason("");
      toast.success(
        `Issued Credit Note ${res.data?.creditNoteNumber ?? ""}. ${
          res.data?.restocked
            ? "Dispatched stock was restocked."
            : "No stock adjustment needed."
        }`
      );
      router.refresh();
    });
  };

  const handleEInvoice = (inv: InvoiceRow) => {
    startTransition(async () => {
      const res = await generateMockEInvoiceAction(inv.id);
      if (!res.ok || !res.data) {
        toast.error(res.error ?? "Failed to generate e-Invoice");
        return;
      }
      setEInvoicePreview({
        invoiceNumber: inv.invoiceNumber,
        irn: res.data.irn,
        eInvoiceJson: res.data.eInvoiceJson,
        eWayBillJson: res.data.eWayBillJson,
      });
      toast.success(`e-Invoice generated for ${inv.invoiceNumber}.`);
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
        title="GST Invoicing, Partial Dispatch & Returns"
        subtitle="Manage GST invoices, split dispatches, sales returns, and credit notes"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="search"
            placeholder="Search invoice #, order #, customer..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] pr-3 pl-9 text-sm outline-none focus:border-[var(--brand-primary)]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["ALL", "All"],
              ["PENDING_DISPATCH", "Pending Dispatch"],
              ["PARTIALLY_DISPATCHED", "Partial Dispatch"],
              ["DISPATCHED", "Dispatched"],
              ["CANCELLED", "Cancelled"],
            ] as const
          ).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setStatusFilter(k);
                setPage(1);
              }}
              className={`h-8 rounded-lg px-3 text-xs font-medium ${
                statusFilter === k
                  ? "bg-[var(--brand-primary)] text-white"
                  : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveTable
        data={paged}
        keyExtractor={(r) => r.id}
        emptyTitle="No GST invoices found"
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
              onClick={() => handleDownloadPdf(r)}
              className="rounded-lg border border-[var(--border-strong)] px-2.5 py-1 text-xs font-medium"
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => openWhatsApp(r)}
              className="rounded-lg border border-[var(--border-strong)] px-2.5 py-1 text-xs font-medium"
            >
              WhatsApp
            </button>
            {r.status === "POSTED" && r.dispatchStatus !== "DISPATCHED" ? (
              <button
                type="button"
                onClick={() => openDispatchDrawer(r)}
                className="rounded-lg bg-[var(--brand-primary)] px-2.5 py-1 text-xs font-semibold text-white"
              >
                Dispatch
              </button>
            ) : null}
            {r.status === "POSTED" && r.dispatchStatus !== "PENDING_DISPATCH" ? (
              <button
                type="button"
                onClick={() => openReturnDrawer(r)}
                className="rounded-lg border border-amber-400 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300"
              >
                Return
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
                {r.challans.length > 0 ? (
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {r.challans.length} Challan(s)
                  </p>
                ) : null}
                {r.creditNotes.length > 0 ? (
                  <p className="font-mono text-[10px] text-red-700 dark:text-red-400">
                    CN ({r.creditNotes.length}): -{formatINR(r.creditTotal)}
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
                  onClick={() => handleDownloadPdf(r)}
                  className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => openWhatsApp(r)}
                  className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleEInvoice(r)}
                  className="text-xs font-medium text-[var(--text-secondary)] hover:underline"
                >
                  e-Inv
                </button>
                {r.status === "POSTED" && r.dispatchStatus !== "DISPATCHED" ? (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => openDispatchDrawer(r)}
                    className="rounded bg-[var(--brand-primary)] px-2 py-0.5 text-xs font-semibold text-white"
                  >
                    {r.dispatchStatus === "PARTIALLY_DISPATCHED"
                      ? "Dispatch Bal."
                      : "Dispatch"}
                  </button>
                ) : null}
                {r.status === "POSTED" && r.dispatchStatus !== "PENDING_DISPATCH" ? (
                  <button
                    type="button"
                    onClick={() => openReturnDrawer(r)}
                    className="text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    Sales Return
                  </button>
                ) : null}
                {r.status === "POSTED" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCancelTarget(r);
                      setCancelReason("");
                    }}
                    className="text-xs font-medium text-red-700 dark:text-red-400 hover:underline"
                  >
                    Cancel CN
                  </button>
                ) : null}
              </div>
            ),
          },
        ]}
      />

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[var(--border-default)] px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {/* Partial / Full Dispatch & Challans Drawer */}
      <SlideOverDrawer
        open={Boolean(dispatchTarget)}
        onClose={() => setDispatchTarget(null)}
        title={`Dispatch Goods — ${dispatchTarget?.invoiceNumber ?? ""}`}
        subtitle="Dispatch full or partial quantities via FEFO and print Delivery Challan"
      >
        {dispatchTarget ? (
          <div className="space-y-5">
            <form onSubmit={handleDispatchSubmit} className="space-y-4">
              <div className="space-y-2.5">
                {dispatchTarget.items.map((li) => {
                  const ordered = Number(li.quantity);
                  const sent = Number(li.dispatchedQty);
                  const remaining = Math.max(0, ordered - sent);
                  const intUnit = isIntegerUnit(li.unit);
                  return (
                    <div
                      key={li.invoiceItemId}
                      className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3"
                    >
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {li.itemName}
                        </span>
                        <span className="tabular-nums text-[var(--text-muted)]">
                          Sent: {formatDisplayQty(sent, li.unit)} /{" "}
                          {formatDisplayQty(ordered, li.unit)} {li.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-[var(--text-secondary)]">
                          Dispatch Now ({li.unit}):
                        </label>
                        <input
                          type="number"
                          step={intUnit ? "1" : "0.001"}
                          min="0"
                          max={remaining}
                          inputMode={intUnit ? "numeric" : "decimal"}
                          disabled={remaining <= 0}
                          value={dispatchQtys[li.invoiceItemId] ?? "0"}
                          onChange={(e) =>
                            setDispatchQtys((prev) => ({
                              ...prev,
                              [li.invoiceItemId]: e.target.value,
                            }))
                          }
                          className={`${inputCls} max-w-[130px] tabular-nums`}
                        />
                        <span className="text-[11px] text-[var(--text-muted)]">
                          (Rem: {formatDisplayQty(remaining, li.unit)})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                    Vehicle / Transport # (optional)
                  </label>
                  <input
                    className={inputCls}
                    placeholder="TN-45-AB-1234"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                    Challan Notes (optional)
                  </label>
                  <input
                    className={inputCls}
                    placeholder="Trip / gate pass note"
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-10 flex-1 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
                >
                  {isPending ? "Dispatching..." : "Confirm Dispatch & Generate Challan"}
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    const t = dispatchTarget;
                    setDispatchTarget(null);
                    setConfirmFullDispatch(t);
                  }}
                  className="h-10 rounded-lg border border-[var(--border-strong)] px-3 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                >
                  Send All Remaining
                </button>
              </div>
            </form>

            {dispatchTarget.challans.length > 0 ? (
              <div className="border-t border-[var(--border-default)] pt-4">
                <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
                  Issued Delivery Challans
                </p>
                <div className="space-y-2">
                  {dispatchTarget.challans.map((ch) => (
                    <div
                      key={ch.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold">{ch.challanNumber}</span>
                        <span className="ml-2 text-[var(--text-muted)]">
                          {ch.dispatchedDate}
                          {ch.vehicleNumber ? ` • ${ch.vehicleNumber}` : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void downloadDeliveryChallanPdf({
                            challanNumber: ch.challanNumber,
                            invoiceNumber: dispatchTarget.invoiceNumber,
                            dispatchedDate: ch.dispatchedDate,
                            vehicleNumber: ch.vehicleNumber,
                            notes: ch.notes,
                            seller: {
                              companyName: dispatchTarget.seller.companyName,
                              gstin: dispatchTarget.seller.gstin,
                              address: dispatchTarget.seller.address,
                            },
                            buyer: {
                              name: dispatchTarget.buyer.name,
                              address: dispatchTarget.buyer.address,
                              phone: dispatchTarget.buyer.phone,
                            },
                            items: ch.items,
                          }).catch(() => toast.error("Failed to export Challan PDF"))
                        }
                        className="font-medium text-[var(--brand-primary)] hover:underline"
                      >
                        Challan PDF
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </SlideOverDrawer>

      {/* Sales Return (Partial Credit Note) Drawer */}
      <SlideOverDrawer
        open={Boolean(returnTarget)}
        onClose={() => setReturnTarget(null)}
        title={`Record Sales Return — ${returnTarget?.invoiceNumber ?? ""}`}
        subtitle="Issue a partial credit note and route resaleable stock back to inventory"
      >
        {returnTarget ? (
          <div className="space-y-5">
            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div className="space-y-2.5">
                {returnTarget.items.map((li) => {
                  const maxReturnable = Math.max(
                    0,
                    Number(li.dispatchedQty) - Number(li.returnedQty)
                  );
                  const intUnit = isIntegerUnit(li.unit);
                  const entry = returnLines[li.invoiceItemId] ?? {
                    qty: "0",
                    condition: "RESALEABLE" as ReturnCondition,
                  };
                  return (
                    <div
                      key={li.invoiceItemId}
                      className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3"
                    >
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-[var(--text-primary)]">
                          {li.itemName}
                        </span>
                        <span className="tabular-nums text-[var(--text-muted)]">
                          Returnable: {formatDisplayQty(maxReturnable, li.unit)} {li.unit}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[11px] text-[var(--text-secondary)]">
                            Return Qty ({li.unit})
                          </label>
                          <input
                            type="number"
                            step={intUnit ? "1" : "0.001"}
                            min="0"
                            max={maxReturnable}
                            inputMode={intUnit ? "numeric" : "decimal"}
                            disabled={maxReturnable <= 0}
                            value={entry.qty}
                            onChange={(e) =>
                              setReturnLines((prev) => ({
                                ...prev,
                                [li.invoiceItemId]: { ...entry, qty: e.target.value },
                              }))
                            }
                            className={`${inputCls} tabular-nums`}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-[var(--text-secondary)]">
                            Stock Condition
                          </label>
                          <select
                            disabled={maxReturnable <= 0}
                            value={entry.condition}
                            onChange={(e) =>
                              setReturnLines((prev) => ({
                                ...prev,
                                [li.invoiceItemId]: {
                                  ...entry,
                                  condition: e.target.value as ReturnCondition,
                                },
                              }))
                            }
                            className={inputCls}
                          >
                            <option value="RESALEABLE">Resaleable (Restock)</option>
                            <option value="DAMAGED">Damaged (Scrap / No Restock)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Mandatory Return Reason
                </label>
                <textarea
                  rows={2}
                  required
                  minLength={5}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Damaged cartons during transit / customer rejected..."
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] p-2.5 text-sm outline-none focus:border-[var(--brand-primary)]"
                />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
              >
                {isPending ? "Issuing Return Credit..." : "Issue Sales Return Credit Note"}
              </button>
            </form>

            {returnTarget.creditNotes.length > 0 ? (
              <div className="border-t border-[var(--border-default)] pt-4">
                <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
                  Existing Credit Notes
                </p>
                <div className="space-y-2">
                  {returnTarget.creditNotes.map((cn) => (
                    <div
                      key={cn.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold">{cn.creditNoteNumber}</span>
                        <span className="ml-2 text-[var(--text-muted)]">
                          {cn.issuedDate} • {formatINR(cn.amount)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void downloadCreditNotePdf({
                            creditNoteNumber: cn.creditNoteNumber,
                            invoiceNumber: returnTarget.invoiceNumber,
                            issuedDate: cn.issuedDate,
                            type: cn.type,
                            reason: cn.reason,
                            seller: {
                              companyName: returnTarget.seller.companyName,
                              gstin: returnTarget.seller.gstin,
                            },
                            buyer: {
                              name: returnTarget.buyer.name,
                              gstin: returnTarget.buyer.gstin,
                            },
                            taxableAmount: cn.taxableAmount,
                            cgstAmount: cn.cgstAmount,
                            sgstAmount: cn.sgstAmount,
                            igstAmount: cn.igstAmount,
                            amount: cn.amount,
                            items: cn.items,
                          }).catch(() => toast.error("Failed to generate Credit Note PDF"))
                        }
                        className="font-medium text-[var(--brand-primary)] hover:underline"
                      >
                        CN PDF
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </SlideOverDrawer>

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
                cancelTarget.dispatchStatus !== "PENDING_DISPATCH" ? "warning" : "info"
              }
            >
              {cancelTarget.dispatchStatus !== "PENDING_DISPATCH"
                ? "Dispatched quantities on this invoice will be restocked into the Stock Ledger."
                : "This invoice is still Pending Dispatch. Cancellation will not alter stock."}
            </InlineAlert>

            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                Mandatory Audit Reason
              </label>
              <textarea
                rows={3}
                required
                minLength={5}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Explain why this invoice is being reversed..."
                className="w-full rounded-lg border border-[var(--border-strong)] p-3 text-sm outline-none focus:border-[var(--brand-primary)]"
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
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-xs">
              <p className="font-semibold text-[var(--text-primary)]">Mocked IRN:</p>
              <p className="mt-1 font-mono break-all text-[var(--text-secondary)]">
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
                className="h-10 rounded-lg bg-[var(--brand-primary)] text-xs font-semibold text-white"
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
                className="h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)]"
              >
                Download e-Way Bill JSON
              </button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-lg border border-[var(--border-default)] bg-[#0F172A] p-3 text-[11px] text-[#F8FAFC]">
              {JSON.stringify(eInvoicePreview.eInvoiceJson, null, 2)}
            </pre>
          </div>
        ) : null}
      </SlideOverDrawer>

      <ConfirmDialog
        open={Boolean(confirmFullDispatch)}
        onClose={() => setConfirmFullDispatch(null)}
        onConfirm={handleQuickFullDispatch}
        loading={isPending}
        title={`Dispatch All Remaining — ${confirmFullDispatch?.invoiceNumber ?? ""}`}
        description="This deducts all remaining invoice quantities from finished-goods batches using FEFO and creates a Delivery Challan."
        confirmLabel="Dispatch All"
      />
    </div>
  );
}
