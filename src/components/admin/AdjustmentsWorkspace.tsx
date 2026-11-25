"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UnitType } from "@prisma/client";
import { recordStockAdjustmentAction } from "@/actions/procurement.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR } from "@/lib/decimal";

export interface AdjustmentsPageData {
  items: Array<{
    id: string;
    code: string;
    name: string;
    unit: UnitType;
    balance: string;
    reorderLevel: string;
    isLowStock: boolean;
  }>;
  openBatches: Array<{
    id: string;
    batchNumber: string;
    itemCode: string;
    itemName: string;
    unit: UnitType;
    remainingQty: string;
    unitRate: string;
    value: string;
    receivedDate: string;
    expiryDate: string | null;
    expiringSoon: boolean;
  }>;
  adjustments: Array<{
    id: string;
    timestamp: string;
    itemName: string;
    quantity: string;
    unit: UnitType;
    balanceAfter: string;
    notes: string;
  }>;
}

const inputCls =
  "h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#047857] focus:ring-2 focus:ring-[#047857]/20";
const labelCls = "mb-1 block text-xs font-medium text-[#475569]";

export function AdjustmentsWorkspace({ data }: { data: AdjustmentsPageData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"batches" | "history">("batches");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: "success" | "danger";
    text: string;
  } | null>(null);

  const [itemId, setItemId] = useState(data.items[0]?.id ?? "");
  const [direction, setDirection] = useState<"INCREASE" | "DECREASE">("DECREASE");
  const [quantity, setQuantity] = useState("");
  const [unitRate, setUnitRate] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [reason, setReason] = useState("");

  const lowStockItems = data.items.filter((i) => i.isLowStock);
  const expiringBatches = data.openBatches.filter((b) => b.expiringSoon);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await recordStockAdjustmentAction({
        itemId,
        direction,
        quantity,
        unitRate: direction === "INCREASE" && unitRate ? unitRate : undefined,
        batchNumber,
        expiryDate,
        reason,
      });
      if (!res.ok) {
        setFeedback({ variant: "danger", text: res.error ?? "Adjustment failed" });
        return;
      }
      setDrawerOpen(false);
      setQuantity("");
      setReason("");
      setBatchNumber("");
      setFeedback({ variant: "success", text: "Stock adjustment recorded in ledger." });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Batches, Adjustments & Expiry Alerts"
        subtitle="Inspect open FIFO/FEFO inventory lots and record audited stock adjustments"
        actions={
          <button
            type="button"
            disabled={data.items.length === 0}
            onClick={() => setDrawerOpen(true)}
            className="h-10 rounded-lg bg-[#047857] px-4 text-sm font-semibold text-white hover:bg-[#065F46] disabled:opacity-50"
          >
            + Record Stock Adjustment
          </button>
        }
      />

      {feedback ? (
        <InlineAlert variant={feedback.variant}>{feedback.text}</InlineAlert>
      ) : null}

      {lowStockItems.length > 0 ? (
        <InlineAlert variant="warning" title="Low-Stock Reorder Alert">
          {lowStockItems
            .map((i) => `${i.name}: ${i.balance} ${i.unit} (reorder <= ${i.reorderLevel})`)
            .join(" • ")}
        </InlineAlert>
      ) : null}

      {expiringBatches.length > 0 ? (
        <InlineAlert variant="danger" title="Batches Expiring Within 15 Days">
          {expiringBatches
            .map((b) => `${b.batchNumber} (${b.itemName}) exp ${b.expiryDate}`)
            .join(" • ")}
        </InlineAlert>
      ) : null}

      <div className="flex gap-2 border-b border-[#E2E8F0] pb-3">
        <button
          type="button"
          onClick={() => setTab("batches")}
          className={`h-9 rounded-lg px-3.5 text-sm font-medium ${
            tab === "batches"
              ? "bg-[#047857] text-white"
              : "border border-[#E2E8F0] bg-white text-[#475569]"
          }`}
        >
          Open Stock Batches ({data.openBatches.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`h-9 rounded-lg px-3.5 text-sm font-medium ${
            tab === "history"
              ? "bg-[#047857] text-white"
              : "border border-[#E2E8F0] bg-white text-[#475569]"
          }`}
        >
          Adjustment History ({data.adjustments.length})
        </button>
      </div>

      {tab === "batches" ? (
        <ResponsiveTable
          data={data.openBatches}
          keyExtractor={(r) => r.id}
          emptyTitle="No open stock batches"
          emptyDescription="Record purchases or opening stock adjustments to create batches."
          mobileTitle={(r) => r.batchNumber}
          mobileSubtitle={(r) =>
            r.expiringSoon ? (
              <StatusBadge status="ON_HOLD" customLabel="Expiring Soon" />
            ) : (
              <StatusBadge status="SUFFICIENT" customLabel="Healthy" />
            )
          }
          columns={[
            {
              key: "batch",
              header: "Batch #",
              render: (r) => <span className="font-mono text-xs">{r.batchNumber}</span>,
            },
            {
              key: "item",
              header: "Item",
              render: (r) => `${r.itemName} (${r.itemCode})`,
            },
            {
              key: "qty",
              header: "Remaining",
              align: "right",
              render: (r) => `${r.remainingQty} ${r.unit}`,
            },
            {
              key: "rate",
              header: "Unit Rate",
              align: "right",
              render: (r) => formatINR(r.unitRate),
            },
            {
              key: "val",
              header: "Valuation",
              align: "right",
              render: (r) => formatINR(r.value),
            },
            { key: "rec", header: "Received", render: (r) => r.receivedDate },
            {
              key: "exp",
              header: "Expiry",
              render: (r) =>
                r.expiryDate ? (
                  <span className={r.expiringSoon ? "font-semibold text-[#B91C1C]" : ""}>
                    {r.expiryDate}
                  </span>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      ) : (
        <ResponsiveTable
          data={data.adjustments}
          keyExtractor={(r) => r.id}
          emptyTitle="No manual adjustments recorded"
          emptyDescription="Adjustments with documented reasons appear here."
          mobileTitle={(r) => r.itemName}
          columns={[
            { key: "ts", header: "Timestamp", render: (r) => r.timestamp },
            { key: "item", header: "Item", render: (r) => r.itemName },
            {
              key: "qty",
              header: "Delta Qty",
              align: "right",
              render: (r) => `${r.quantity} ${r.unit}`,
            },
            {
              key: "bal",
              header: "Balance After",
              align: "right",
              render: (r) => `${r.balanceAfter} ${r.unit}`,
            },
            { key: "notes", header: "Audit Reason", render: (r) => r.notes },
          ]}
        />
      )}

      <SlideOverDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Record Stock Adjustment"
        subtitle="Compensating ledger entry with mandatory audit rationale"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Item</label>
            <select
              className={inputCls}
              required
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              {data.items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.code}) — Bal: {i.balance} {i.unit}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Direction</label>
              <select
                className={inputCls}
                value={direction}
                onChange={(e) =>
                  setDirection(e.target.value as "INCREASE" | "DECREASE")
                }
              >
                <option value="DECREASE">Decrease (Write-Off / Spoilage)</option>
                <option value="INCREASE">Increase (Opening / Audit Gain)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Quantity</label>
              <input
                type="number"
                step="0.001"
                required
                className={inputCls}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          {direction === "INCREASE" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Unit Rate (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  className={inputCls}
                  value={unitRate}
                  onChange={(e) => setUnitRate(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Batch # (optional)</label>
                <input
                  className={inputCls}
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Expiry (optional)</label>
                <input
                  type="date"
                  className={inputCls}
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div>
            <label className={labelCls}>Mandatory Audit Reason</label>
            <textarea
              rows={3}
              required
              minLength={5}
              className="w-full rounded-lg border border-[#CBD5E1] bg-white p-3 text-sm text-[#0F172A] outline-none focus:border-[#047857] focus:ring-2 focus:ring-[#047857]/20"
              placeholder="Explain why stock is being adjusted..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-lg bg-[#047857] text-sm font-semibold text-white hover:bg-[#065F46]"
          >
            {isPending ? "Recording..." : "Commit Stock Adjustment"}
          </button>
        </form>
      </SlideOverDrawer>
    </div>
  );
}
