"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { Search, Trash2 } from "lucide-react";
import { cancelFieldOrderAction } from "@/actions/salesman.actions";
import { OfflineSyncBanner } from "@/components/salesman/OfflineSyncBanner";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR } from "@/lib/decimal";
import {
  removeQueuedOfflineOrder,
  type QueuedOfflineOrder,
} from "@/lib/offline-orders";

export interface SalesmanOrdersPageData {
  orders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    customerState: string;
    orderDate: string;
    status: OrderStatus;
    totalAmount: string;
    notes: string | null;
    rejectionReason: string | null;
    items: Array<{
      itemName: string;
      quantity: string;
      unit: string;
      unitPrice: string;
      totalAmount: string;
    }>;
  }>;
  customerSummary: Array<{
    customerId: string;
    customerName: string;
    state: string;
    orderCount: number;
    totalBooked: string;
    invoicedOrDispatched: string;
    lastOrderDate: string;
  }>;
}

type StatusFilter =
  | "ALL"
  | "SUBMITTED"
  | "ON_HOLD"
  | "INVOICED"
  | "DISPATCHED"
  | "OFFLINE";

export function SalesmanOrdersWorkspace({
  data,
}: {
  data: SalesmanOrdersPageData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [viewTab, setViewTab] = useState<"history" | "customer-sales">("history");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [offlineOrders, setOfflineOrders] = useState<QueuedOfflineOrder[]>([]);
  const [feedback, setFeedback] = useState<{
    variant: "success" | "danger";
    text: string;
  } | null>(null);

  const handleQueueChanged = useCallback((rows: QueuedOfflineOrder[]) => {
    setOfflineOrders(rows);
  }, []);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "OFFLINE") return [];
    const q = search.trim().toLowerCase();
    return data.orders.filter((o) => {
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q)
      );
    });
  }, [data.orders, statusFilter, search]);

  const handleCancelSubmitted = (orderId: string, orderNumber: string) => {
    const reason = window.prompt(
      `Cancel submitted order ${orderNumber}? Enter reason:`
    );
    if (!reason) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await cancelFieldOrderAction({ orderId, reason });
      if (!res.ok) {
        setFeedback({ variant: "danger", text: res.error ?? "Failed to cancel" });
        return;
      }
      setFeedback({ variant: "success", text: `Order ${orderNumber} cancelled.` });
      router.refresh();
    });
  };

  const handleDiscardOffline = async (clientRequestId: string) => {
    await removeQueuedOfflineOrder(clientRequestId);
    setOfflineOrders((prev) =>
      prev.filter((o) => o.clientRequestId !== clientRequestId)
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders & Customer-Wise Sales"
        subtitle="Track order approvals, dispatches, offline queue, and customer totals"
      />

      <OfflineSyncBanner onQueueChanged={handleQueueChanged} />

      {feedback ? (
        <InlineAlert variant={feedback.variant}>{feedback.text}</InlineAlert>
      ) : null}

      <div className="flex gap-2 border-b border-[#E2E8F0] pb-3">
        <button
          type="button"
          onClick={() => setViewTab("history")}
          className={`min-h-[40px] rounded-lg px-4 text-sm font-medium ${
            viewTab === "history"
              ? "bg-[#047857] text-white"
              : "border border-[#E2E8F0] bg-white text-[#475569]"
          }`}
        >
          Order History ({data.orders.length + offlineOrders.length})
        </button>
        <button
          type="button"
          onClick={() => setViewTab("customer-sales")}
          className={`min-h-[40px] rounded-lg px-4 text-sm font-medium ${
            viewTab === "customer-sales"
              ? "bg-[#047857] text-white"
              : "border border-[#E2E8F0] bg-white text-[#475569]"
          }`}
        >
          Customer-Wise Sales ({data.customerSummary.length})
        </button>
      </div>

      {viewTab === "history" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[#64748B]" />
              <input
                type="search"
                placeholder="Search customer or order #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white pr-3 pl-9 text-sm outline-none focus:border-[#047857]"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["ALL", "All"],
                  ["SUBMITTED", "Submitted"],
                  ["ON_HOLD", "On Hold"],
                  ["INVOICED", "Invoiced"],
                  ["DISPATCHED", "Dispatched"],
                  ["OFFLINE", `Offline (${offlineOrders.length})`],
                ] as Array<[StatusFilter, string]>
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`min-h-[34px] rounded-full px-3 text-xs font-medium ${
                    statusFilter === key
                      ? "bg-[#047857] text-white"
                      : "border border-[#E2E8F0] bg-white text-[#475569]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Offline Queued Cards */}
          {(statusFilter === "ALL" || statusFilter === "OFFLINE") &&
          offlineOrders.length > 0 ? (
            <div className="space-y-2.5">
              {offlineOrders.map((oq) => (
                <div
                  key={oq.clientRequestId}
                  className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#B45309]">
                          OFFLINE-QUEUE
                        </span>
                        <StatusBadge
                          status="ON_HOLD"
                          customLabel="Pending Sync"
                        />
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#0F172A]">
                        {oq.customerName}
                      </p>
                      <p className="text-xs text-[#475569]">
                        {oq.items.map((i) => `${i.itemName} × ${i.quantity} ${i.inputUnit}`).join(", ")}
                      </p>
                      {oq.lastError ? (
                        <p className="mt-1 text-xs font-medium text-[#B91C1C]">
                          Sync error: {oq.lastError}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatINR(oq.estimatedTotal)}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleDiscardOffline(oq.clientRequestId)}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#B91C1C]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Discard
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Online Server Orders */}
          {filteredOrders.length === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-10 text-center text-sm text-[#64748B]">
              No matching orders found.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredOrders.map((o) => {
                const expanded = expandedId === o.id;
                return (
                  <div
                    key={o.id}
                    className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedId(expanded ? null : o.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setExpandedId(expanded ? null : o.id);
                        }
                      }}
                      className="flex cursor-pointer flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold">
                            {o.orderNumber}
                          </span>
                          <StatusBadge status={o.status} />
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[#0F172A]">
                          {o.customerName}{" "}
                          <span className="text-xs font-normal text-[#64748B]">
                            ({o.customerState})
                          </span>
                        </p>
                        <p className="text-xs text-[#64748B]">{o.orderDate}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold tabular-nums">
                          {formatINR(o.totalAmount)}
                        </p>
                        <span className="text-[11px] text-[#047857]">
                          {expanded ? "Hide details ▲" : "View items ▼"}
                        </span>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-3 space-y-2 border-t border-[#F1F5F9] pt-3 text-xs">
                        {o.items.map((li, i) => (
                          <div key={i} className="flex justify-between">
                            <span>
                              {li.itemName} ({li.quantity} {li.unit} × ₹{li.unitPrice})
                            </span>
                            <span className="font-medium tabular-nums">
                              {formatINR(li.totalAmount)}
                            </span>
                          </div>
                        ))}
                        {o.notes ? (
                          <p className="text-[#475569]">Notes: {o.notes}</p>
                        ) : null}
                        {o.rejectionReason ? (
                          <p className="font-medium text-[#B91C1C]">
                            Reason: {o.rejectionReason}
                          </p>
                        ) : null}
                        {o.status === "SUBMITTED" ? (
                          <div className="pt-1">
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                handleCancelSubmitted(o.id, o.orderNumber)
                              }
                              className="text-xs font-medium text-[#B91C1C] hover:underline"
                            >
                              Cancel Submitted Order
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <ResponsiveTable
          data={data.customerSummary}
          keyExtractor={(r) => r.customerId}
          emptyTitle="No customer sales yet"
          emptyDescription="Customer-wise sales totals will appear as you submit orders."
          mobileTitle={(r) => r.customerName}
          mobileSubtitle={(r) => (
            <span className="text-xs text-[#64748B]">{r.state}</span>
          )}
          columns={[
            { key: "cust", header: "Customer", render: (r) => r.customerName },
            { key: "state", header: "State", render: (r) => r.state },
            {
              key: "count",
              header: "Orders",
              align: "right",
              render: (r) => r.orderCount,
            },
            {
              key: "inv",
              header: "Invoiced / Dispatched",
              align: "right",
              render: (r) => formatINR(r.invoicedOrDispatched),
            },
            {
              key: "booked",
              header: "Total Booked (Pre-tax)",
              align: "right",
              render: (r) => formatINR(r.totalBooked),
            },
            { key: "last", header: "Last Order", render: (r) => r.lastOrderDate },
          ]}
        />
      )}
    </div>
  );
}
