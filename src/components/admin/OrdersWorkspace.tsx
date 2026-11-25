"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { Search } from "lucide-react";
import {
  approveAndInvoiceOrderAction,
  holdOrderAction,
  rejectOrderAction,
} from "@/actions/billing.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR, money, qty } from "@/lib/decimal";
import { computeGstSplit } from "@/lib/engines/tax";

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  orderDate: string;
  salesmanName: string;
  customerName: string;
  customerState: string;
  customerStateCode: string;
  customerGstin: string | null;
  status: OrderStatus;
  totalAmount: string;
  notes: string | null;
  invoiceNumber: string | null;
  items: Array<{
    orderItemId: string;
    itemId: string;
    itemName: string;
    itemCode: string;
    unit: string;
    taxRate: string;
    quantity: string;
    unitPrice: string;
    availableStock: string;
  }>;
}

export interface OrdersPageData {
  factoryConfigured: boolean;
  factoryStateCode: string;
  orders: AdminOrderRow[];
}

type StatusFilter = "ALL" | "PENDING" | "ON_HOLD" | "INVOICED" | "DISPATCHED" | "REJECTED";

const inputCls =
  "h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#047857]";

export function OrdersWorkspace({ data }: { data: OrdersPageData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{
    variant: "success" | "danger";
    text: string;
  } | null>(null);

  const [selected, setSelected] = useState<AdminOrderRow | null>(null);
  const [draftItems, setDraftItems] = useState<
    Array<{ orderItemId: string; quantity: string; unitPrice: string }>
  >([]);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.orders.filter((o) => {
      if (filter === "PENDING" && o.status !== "SUBMITTED" && o.status !== "APPROVED") {
        return false;
      } else if (
        filter !== "ALL" &&
        filter !== "PENDING" &&
        o.status !== filter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.salesmanName.toLowerCase().includes(q)
      );
    });
  }, [data.orders, filter, search]);

  const openVerify = (order: AdminOrderRow) => {
    setSelected(order);
    setDraftItems(
      order.items.map((li) => ({
        orderItemId: li.orderItemId,
        quantity: Number(li.quantity).toString(),
        unitPrice: li.unitPrice,
      }))
    );
    setRejectMode(false);
    setRejectReason("");
    setFeedback(null);
  };

  const verificationPreview = useMemo(() => {
    if (!selected) return null;
    let hasShortage = false;
    let taxable = money(0);
    let cgst = money(0);
    let sgst = money(0);
    let igst = money(0);

    const lines = selected.items.map((item) => {
      const d = draftItems.find((x) => x.orderItemId === item.orderItemId);
      const q = qty(d?.quantity || 0);
      const p = money(d?.unitPrice || 0);
      const avail = qty(item.availableStock);
      const deficit = q.gt(avail) ? qty(q.minus(avail)) : qty(0);
      if (deficit.gt(0)) hasShortage = true;

      const lineTaxable = money(q.mul(p));
      const split = computeGstSplit(
        lineTaxable,
        item.taxRate,
        data.factoryStateCode,
        selected.customerStateCode
      );
      taxable = money(taxable.plus(split.taxableAmount));
      cgst = money(cgst.plus(split.cgstAmount));
      sgst = money(sgst.plus(split.sgstAmount));
      igst = money(igst.plus(split.igstAmount));

      return { item, q, p, avail, deficit, lineTaxable };
    });

    return {
      lines,
      hasShortage,
      taxable,
      cgst,
      sgst,
      igst,
      total: money(taxable.plus(cgst).plus(sgst).plus(igst)),
      isIntraState: selected.customerStateCode === data.factoryStateCode,
    };
  }, [selected, draftItems, data.factoryStateCode]);

  const handleApproveAndInvoice = () => {
    if (!selected) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await approveAndInvoiceOrderAction({
        orderId: selected.id,
        items: draftItems,
      });
      if (!res.ok) {
        setFeedback({ variant: "danger", text: res.error ?? "Approval failed" });
        return;
      }
      setSelected(null);
      setFeedback({
        variant: "success",
        text: `Generated GST Invoice ${res.data?.invoiceNumber ?? ""}. Ready for PDF/Dispatch under Invoices.`,
      });
      router.refresh();
    });
  };

  const handleHold = () => {
    if (!selected) return;
    startTransition(async () => {
      const res = await holdOrderAction({ orderId: selected.id });
      if (!res.ok) {
        setFeedback({ variant: "danger", text: res.error ?? "Hold failed" });
        return;
      }
      setSelected(null);
      setFeedback({
        variant: "success",
        text: `Order ${selected.orderNumber} placed On Hold for production replenishment.`,
      });
      router.refresh();
    });
  };

  const handleReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    startTransition(async () => {
      const res = await rejectOrderAction({
        orderId: selected.id,
        reason: rejectReason,
      });
      if (!res.ok) {
        setFeedback({ variant: "danger", text: res.error ?? "Rejection failed" });
        return;
      }
      setSelected(null);
      setFeedback({
        variant: "success",
        text: `Order ${selected.orderNumber} rejected.`,
      });
      router.refresh();
    });
  };

  const canProcess = (status: OrderStatus) =>
    status === "SUBMITTED" || status === "APPROVED" || status === "ON_HOLD";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incoming Order Verification"
        subtitle="Verify finished stock sufficiency, adjust quantities/prices if needed, and raise GST tax invoices"
      />

      {!data.factoryConfigured ? (
        <InlineAlert variant="warning" title="Factory Profile Missing">
          Configure your factory GSTIN and state code under Masters before approving orders into GST invoices.
        </InlineAlert>
      ) : null}

      {feedback ? (
        <InlineAlert variant={feedback.variant}>{feedback.text}</InlineAlert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[#64748B]" />
          <input
            type="search"
            placeholder="Search order #, customer, salesman..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white pr-3 pl-9 text-sm outline-none focus:border-[#047857]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["ALL", "All"],
              ["PENDING", "Pending"],
              ["ON_HOLD", "On Hold"],
              ["INVOICED", "Invoiced"],
              ["DISPATCHED", "Dispatched"],
              ["REJECTED", "Rejected"],
            ] as Array<[StatusFilter, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`min-h-[34px] rounded-full px-3 text-xs font-medium ${
                filter === key
                  ? "bg-[#047857] text-white"
                  : "border border-[#E2E8F0] bg-white text-[#475569]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveTable
        data={filtered}
        keyExtractor={(r) => r.id}
        emptyTitle="No orders in this queue"
        emptyDescription="Field salesman orders will appear here immediately after submission."
        mobileTitle={(r) => r.orderNumber}
        mobileSubtitle={(r) => <StatusBadge status={r.status} />}
        mobileActions={(r) =>
          canProcess(r.status) ? (
            <button
              type="button"
              onClick={() => openVerify(r)}
              className="rounded-lg bg-[#047857] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Verify & Process
            </button>
          ) : null
        }
        columns={[
          {
            key: "num",
            header: "Order #",
            render: (r) => (
              <span className="font-mono text-xs font-semibold">{r.orderNumber}</span>
            ),
          },
          { key: "date", header: "Date", render: (r) => r.orderDate },
          { key: "salesman", header: "Salesman", render: (r) => r.salesmanName },
          {
            key: "customer",
            header: "Customer",
            render: (r) => `${r.customerName} (${r.customerStateCode})`,
          },
          {
            key: "items",
            header: "Items",
            render: (r) =>
              r.items
                .map((i) => `${i.itemName} × ${Number(i.quantity).toFixed(0)}`)
                .join(", "),
          },
          {
            key: "total",
            header: "Pre-Tax Value",
            align: "right",
            render: (r) => formatINR(r.totalAmount),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (r) =>
              canProcess(r.status) ? (
                <button
                  type="button"
                  onClick={() => openVerify(r)}
                  className="rounded-lg bg-[#047857] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#065F46]"
                >
                  Verify & Process
                </button>
              ) : (
                <span className="font-mono text-xs text-[#64748B]">
                  {r.invoiceNumber ?? "—"}
                </span>
              ),
          },
        ]}
      />

      {/* Order Verification Drawer */}
      <SlideOverDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={`Verify Order — ${selected?.orderNumber ?? ""}`}
        subtitle={
          selected
            ? `${selected.customerName} (${selected.customerState} - ${selected.customerStateCode})`
            : ""
        }
      >
        {selected && verificationPreview ? (
          <div className="space-y-4">
            {verificationPreview.hasShortage ? (
              <InlineAlert variant="danger" title="Insufficient Finished Goods Stock">
                One or more requested items exceed warehouse stock. Adjust quantities, place{" "}
                <strong>On Hold</strong>, or run production first.
              </InlineAlert>
            ) : (
              <InlineAlert variant="success" title="Finished Stock Sufficient">
                Warehouse inventory covers this entire order. Ready to raise GST Tax Invoice.
              </InlineAlert>
            )}

            <div className="space-y-3">
              {verificationPreview.lines.map(
                ({ item, avail, deficit, lineTaxable }) => {
                  const d = draftItems.find(
                    (x) => x.orderItemId === item.orderItemId
                  );
                  return (
                    <div
                      key={item.orderItemId}
                      className={`rounded-lg border p-3 ${
                        deficit.gt(0)
                          ? "border-[#FECACA] bg-[#FEF2F2]/50"
                          : "border-[#E2E8F0] bg-[#F8FAFC]"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">
                            {item.itemName}
                          </p>
                          <p className="text-xs text-[#475569] tabular-nums">
                            Available: <strong>{avail.toFixed(0)} {item.unit}</strong>
                            {deficit.gt(0) ? (
                              <span className="ml-2 font-semibold text-[#B91C1C]">
                                (Shortage of {deficit.toFixed(0)} {item.unit})
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatINR(lineTaxable)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-xs text-[#475569]">
                            Qty ({item.unit})
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="1"
                            className={`${inputCls} tabular-nums`}
                            value={d?.quantity ?? ""}
                            onChange={(e) =>
                              setDraftItems((prev) =>
                                prev.map((x) =>
                                  x.orderItemId === item.orderItemId
                                    ? { ...x, quantity: e.target.value }
                                    : x
                                )
                              )
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-[#475569]">
                            Unit Price (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className={`${inputCls} tabular-nums`}
                            value={d?.unitPrice ?? ""}
                            onChange={(e) =>
                              setDraftItems((prev) =>
                                prev.map((x) =>
                                  x.orderItemId === item.orderItemId
                                    ? { ...x, unitPrice: e.target.value }
                                    : x
                                )
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#475569]">Taxable Value</span>
                <span className="tabular-nums font-medium">
                  {formatINR(verificationPreview.taxable)}
                </span>
              </div>
              {verificationPreview.isIntraState ? (
                <>
                  <div className="mt-1 flex justify-between text-xs text-[#475569]">
                    <span>CGST (Intra-State)</span>
                    <span className="tabular-nums">
                      {formatINR(verificationPreview.cgst)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-[#475569]">
                    <span>SGST (Intra-State)</span>
                    <span className="tabular-nums">
                      {formatINR(verificationPreview.sgst)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-1 flex justify-between text-xs text-[#475569]">
                  <span>IGST (Inter-State)</span>
                  <span className="tabular-nums">
                    {formatINR(verificationPreview.igst)}
                  </span>
                </div>
              )}
              <div className="mt-2 flex justify-between border-t border-[#E2E8F0] pt-2 text-base font-semibold">
                <span>Invoice Total</span>
                <span className="tabular-nums">
                  {formatINR(verificationPreview.total)}
                </span>
              </div>
            </div>

            {selected.notes ? (
              <p className="text-xs text-[#475569]">
                <strong>Salesman Notes:</strong> {selected.notes}
              </p>
            ) : null}

            {rejectMode ? (
              <form onSubmit={handleReject} className="space-y-3 border-t border-[#E2E8F0] pt-3">
                <textarea
                  rows={2}
                  required
                  minLength={3}
                  placeholder="Reason for rejecting this order..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-lg border border-[#CBD5E1] p-2.5 text-sm outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="h-10 flex-1 rounded-lg bg-[#B91C1C] text-sm font-semibold text-white"
                  >
                    Confirm Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectMode(false)}
                    className="h-10 rounded-lg border border-[#CBD5E1] px-4 text-sm"
                  >
                    Back
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={
                    isPending ||
                    verificationPreview.hasShortage ||
                    !data.factoryConfigured
                  }
                  onClick={handleApproveAndInvoice}
                  className="h-11 w-full rounded-lg bg-[#047857] text-sm font-semibold text-white hover:bg-[#065F46] disabled:opacity-50"
                >
                  {isPending
                    ? "Generating Invoice..."
                    : "Approve & Raise GST Invoice"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleHold}
                    className="h-10 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] text-xs font-semibold text-[#B45309]"
                  >
                    Place On Hold
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setRejectMode(true)}
                    className="h-10 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-xs font-semibold text-[#B91C1C]"
                  >
                    Reject Order
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SlideOverDrawer>
    </div>
  );
}
