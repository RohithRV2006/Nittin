"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMode, PaymentStatus, UnitType } from "@prisma/client";
import { toast } from "sonner";
import { isIntegerUnit, PAYMENT_MODES } from "@/lib/enums";
import {
  recordPurchaseAction,
  recordSupplierPaymentAction,
  rejectGoodsReceiptAction,
} from "@/actions/procurement.actions";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR, money, toDec } from "@/lib/decimal";

export interface PurchasesPageData {
  factoryConfigured: boolean;
  factoryStateCode: string;
  suppliers: Array<{
    id: string;
    name: string;
    state: string;
    stateCode: string;
  }>;
  items: Array<{
    id: string;
    code: string;
    name: string;
    unit: UnitType;
    unitsPerCarton: number | null;
    taxRate: string;
  }>;
  purchases: Array<{
    id: string;
    purchaseNumber: string;
    supplierName: string;
    billNumber: string;
    purchaseDate: string;
    itemCount: number;
    itemsSummary: string;
    taxableAmount: string;
    taxTotal: string;
    totalAmount: string;
    paidAmount: string;
    paymentStatus: PaymentStatus;
  }>;
  pendingGrns: Array<{
    id: string;
    grnNumber: string;
    supplierId: string;
    supplierName: string;
    challanNumber: string;
    receivedDate: string;
    receivedByName: string;
    notes: string | null;
    lines: Array<{
      itemId: string;
      itemName: string;
      quantity: string;
      inputUnit: UnitType;
      taxRate: string;
      batchNumber: string;
      expiryDate: string;
    }>;
  }>;
}

interface DraftLine {
  itemId: string;
  quantity: string;
  inputUnit: UnitType;
  unitRatePerInputUnit: string;
  taxRate: string;
  batchNumber: string;
  expiryDate: string;
}

function getCompatibleUnits(baseUnit: UnitType, unitsPerCarton: number | null): UnitType[] {
  if (baseUnit === "KG" || baseUnit === "GRAM") {
    return ["KG", "GRAM"];
  }
  if (baseUnit === "LITRE" || baseUnit === "ML") {
    return ["LITRE", "ML"];
  }
  if (
    (baseUnit === "PIECE" || baseUnit === "PACKET") &&
    unitsPerCarton &&
    unitsPerCarton > 0
  ) {
    return [baseUnit, "CARTON"];
  }
  return [baseUnit];
}

const inputCls =
  "h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-secondary)]";

export function PurchasesWorkspace({ data }: { data: PurchasesPageData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [linkedGrnId, setLinkedGrnId] = useState<string>("");
  const [rejectGrnTarget, setRejectGrnTarget] = useState<
    PurchasesPageData["pendingGrns"][number] | null
  >(null);
  const [supplierId, setSupplierId] = useState(data.suppliers[0]?.id ?? "");
  const [billNumber, setBillNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [lines, setLines] = useState<DraftLine[]>(() => {
    const first = data.items[0];
    return first
      ? [
          {
            itemId: first.id,
            quantity: "",
            inputUnit: first.unit,
            unitRatePerInputUnit: "",
            taxRate: first.taxRate,
            batchNumber: "",
            expiryDate: "",
          },
        ]
      : [];
  });

  // Supplier payment drawer
  const [payPurchase, setPayPurchase] = useState<
    PurchasesPageData["purchases"][number] | null
  >(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<PaymentMode>("BANK_TRANSFER");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const itemMap = useMemo(
    () => new Map(data.items.map((i) => [i.id, i])),
    [data.items]
  );

  const totals = useMemo(() => {
    let billed = money(0);
    let paid = money(0);
    for (const p of data.purchases) {
      billed = money(billed.plus(p.totalAmount));
      paid = money(paid.plus(p.paidAmount));
    }
    return {
      count: data.purchases.length,
      billed: formatINR(billed),
      paid: formatINR(paid),
      payable: formatINR(money(billed.minus(paid))),
    };
  }, [data.purchases]);

  const draftSummary = useMemo(() => {
    let taxable = money(0);
    let tax = money(0);
    for (const l of lines) {
      const q = toDec(l.quantity || 0);
      const r = toDec(l.unitRatePerInputUnit || 0);
      const tr = toDec(l.taxRate || 0);
      const lineTaxable = money(q.mul(r));
      const lineTax = money(lineTaxable.mul(tr).div(100));
      taxable = money(taxable.plus(lineTaxable));
      tax = money(tax.plus(lineTax));
    }
    const sup = data.suppliers.find((s) => s.id === supplierId);
    const intra = sup && sup.stateCode === data.factoryStateCode;
    return {
      taxable,
      tax,
      total: money(taxable.plus(tax)),
      isIntraState: Boolean(intra),
    };
  }, [lines, supplierId, data.suppliers, data.factoryStateCode]);

  const openVerifyGrn = (grn: PurchasesPageData["pendingGrns"][number]) => {
    setLinkedGrnId(grn.id);
    setSupplierId(grn.supplierId);
    setBillNumber(grn.challanNumber);
    setPurchaseDate(grn.receivedDate);
    setLines(
      grn.lines.map((l) => ({
        itemId: l.itemId,
        quantity: isIntegerUnit(l.inputUnit) ? String(Number(l.quantity)) : l.quantity,
        inputUnit: l.inputUnit,
        unitRatePerInputUnit: "",
        taxRate: l.taxRate,
        batchNumber: l.batchNumber,
        expiryDate: l.expiryDate,
      }))
    );
    setPurchaseOpen(true);
  };

  const handleRejectGrn = async (reason?: string) => {
    if (!rejectGrnTarget || !reason) return;
    startTransition(async () => {
      const res = await rejectGoodsReceiptAction({
        grnId: rejectGrnTarget.id,
        reason,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to reject GRN");
        return;
      }
      toast.success(`GRN ${rejectGrnTarget.grnNumber} rejected.`);
      setRejectGrnTarget(null);
      router.refresh();
    });
  };

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await recordPurchaseAction({
        supplierId,
        billNumber,
        purchaseDate,
        grnId: linkedGrnId || undefined,
        lines,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save purchase");
        return;
      }
      setPurchaseOpen(false);
      setLinkedGrnId("");
      setBillNumber("");
      toast.success(
        `Purchase ${res.data?.purchaseNumber ?? ""} recorded into FIFO Stock Ledger.`
      );
      router.refresh();
    });
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payPurchase) return;
    startTransition(async () => {
      const res = await recordSupplierPaymentAction({
        purchaseId: payPurchase.id,
        amount: payAmount,
        paymentMode: payMode,
        paymentDate: payDate,
        referenceNumber: payRef,
        notes: payNotes,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Payment failed");
        return;
      }
      setPayPurchase(null);
      setPayAmount("");
      setPayRef("");
      setPayNotes("");
      toast.success("Supplier payment recorded.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inward Procurement & Bills"
        subtitle="Record raw material & packaging purchases into FIFO/FEFO lots"
        actions={
          <button
            type="button"
            disabled={!data.factoryConfigured || data.suppliers.length === 0 || data.items.length === 0}
            onClick={() => {
              setLinkedGrnId("");
              setPurchaseOpen(true);
            }}
            className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
          >
            + Record Inward Purchase
          </button>
        }
      />

      {!data.factoryConfigured ? (
        <InlineAlert variant="warning" title="Factory Profile Missing">
          Configure your factory GSTIN and state code under Masters before recording purchases.
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Purchase Bills" value={totals.count} />
        <StatCard label="Total Purchased" value={totals.billed} />
        <StatCard label="Total Paid" value={totals.paid} tone="success" />
        <StatCard label="Payable Balance" value={totals.payable} tone="warning" />
      </div>

      {data.pendingGrns.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Pending Floor Goods Receipts ({data.pendingGrns.length})
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              Logged by Floor Supervisor — verify rates & GST to inward stock
            </span>
          </div>
          <div className="space-y-2">
            {data.pendingGrns.map((g) => (
              <div
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs"
              >
                <div>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {g.grnNumber}
                  </span>{" "}
                  — {g.supplierName} (Challan: {g.challanNumber} • {g.receivedDate} • By{" "}
                  {g.receivedByName})
                  <p className="mt-0.5 text-[var(--text-muted)]">
                    {g.lines.map((l) => `${l.itemName} (${l.quantity} ${l.inputUnit})`).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!data.factoryConfigured || isPending}
                    onClick={() => openVerifyGrn(g)}
                    className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
                  >
                    Verify & Bill GRN
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setRejectGrnTarget(g)}
                    className="rounded-lg border border-red-300 px-2.5 py-1.5 font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <ResponsiveTable
        data={data.purchases}
        keyExtractor={(r) => r.id}
        emptyTitle="No inward purchases recorded"
        emptyDescription="Record a supplier bill to create FIFO stock batches and ledger receipts."
        mobileTitle={(r) => r.purchaseNumber}
        mobileSubtitle={(r) => <StatusBadge status={r.paymentStatus} />}
        mobileActions={(r) =>
          r.paymentStatus !== "PAID" ? (
            <button
              type="button"
              onClick={() => {
                setPayPurchase(r);
                const rem = money(toDec(r.totalAmount).minus(r.paidAmount));
                setPayAmount(rem.toFixed(2));
              }}
              className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--brand-primary)]"
            >
              Record Payment
            </button>
          ) : null
        }
        columns={[
          {
            key: "num",
            header: "Purchase #",
            render: (r) => (
              <span className="font-mono text-xs font-medium">{r.purchaseNumber}</span>
            ),
          },
          { key: "vendor", header: "Supplier", render: (r) => r.supplierName },
          {
            key: "bill",
            header: "Bill #",
            render: (r) => <span className="font-mono text-xs">{r.billNumber}</span>,
          },
          { key: "date", header: "Date", render: (r) => r.purchaseDate },
          {
            key: "items",
            header: "Items",
            render: (r) => (
              <span className="text-xs text-[var(--text-secondary)]">{r.itemsSummary}</span>
            ),
          },
          {
            key: "total",
            header: "Total",
            align: "right",
            render: (r) => formatINR(r.totalAmount),
          },
          {
            key: "paid",
            header: "Paid",
            align: "right",
            render: (r) => formatINR(r.paidAmount),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => <StatusBadge status={r.paymentStatus} />,
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (r) =>
              r.paymentStatus !== "PAID" ? (
                <button
                  type="button"
                  onClick={() => {
                    setPayPurchase(r);
                    const rem = money(toDec(r.totalAmount).minus(r.paidAmount));
                    setPayAmount(rem.toFixed(2));
                  }}
                  className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
                >
                  Pay Bill
                </button>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">Settled</span>
              ),
          },
        ]}
      />

      {/* Inward Purchase Drawer */}
      <SlideOverDrawer
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
        title="Record Inward Purchase"
        subtitle="Creates Purchase Bill, FIFO StockBatch lots, and StockLedger receipts atomically"
      >
        <form onSubmit={handleCreatePurchase} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Supplier</label>
              <select
                className={inputCls}
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                {data.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.state} - {s.stateCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Vendor Bill / Invoice #</label>
              <input
                className={inputCls}
                required
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Purchase Date</label>
              <input
                type="date"
                className={inputCls}
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Bill Line Items
              </span>
              <button
                type="button"
                onClick={() => {
                  const first = data.items[0];
                  if (!first) return;
                  setLines([
                    ...lines,
                    {
                      itemId: first.id,
                      quantity: "",
                      inputUnit: first.unit,
                      unitRatePerInputUnit: "",
                      taxRate: first.taxRate,
                      batchNumber: "",
                      expiryDate: "",
                    },
                  ]);
                }}
                className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
              >
                + Add Line
              </button>
            </div>

            {lines.map((line, idx) => {
              const item = itemMap.get(line.itemId);
              const unitOpts = item
                ? getCompatibleUnits(item.unit, item.unitsPerCarton)
                : [line.inputUnit];
              return (
                <div
                  key={idx}
                  className="space-y-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <select
                      className={inputCls}
                      value={line.itemId}
                      onChange={(e) => {
                        const nextItem = itemMap.get(e.target.value);
                        const next = [...lines];
                        next[idx] = {
                          ...line,
                          itemId: e.target.value,
                          inputUnit: nextItem?.unit ?? line.inputUnit,
                          taxRate: nextItem?.taxRate ?? line.taxRate,
                        };
                        setLines(next);
                      }}
                    >
                      {data.items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name} ({it.code})
                        </option>
                      ))}
                    </select>
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                        className="text-xs font-medium text-red-700 dark:text-red-400"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <label className={labelCls}>Qty ({line.inputUnit})</label>
                      <input
                        type="number"
                        step={isIntegerUnit(line.inputUnit) ? "1" : "0.001"}
                        min={isIntegerUnit(line.inputUnit) ? "1" : "0.001"}
                        inputMode={isIntegerUnit(line.inputUnit) ? "numeric" : "decimal"}
                        required
                        className={inputCls}
                        value={line.quantity}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, quantity: e.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Unit</label>
                      <select
                        className={inputCls}
                        value={line.inputUnit}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = {
                            ...line,
                            inputUnit: e.target.value as UnitType,
                          };
                          setLines(next);
                        }}
                      >
                        {unitOpts.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Rate / {line.inputUnit} (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className={inputCls}
                        value={line.unitRatePerInputUnit}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = {
                            ...line,
                            unitRatePerInputUnit: e.target.value,
                          };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>GST %</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        className={inputCls}
                        value={line.taxRate}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, taxRate: e.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>Batch # (optional)</label>
                      <input
                        className={`${inputCls} font-mono text-xs`}
                        placeholder="Auto-generated if blank"
                        value={line.batchNumber}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, batchNumber: e.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Expiry Date (optional)</label>
                      <input
                        type="date"
                        className={inputCls}
                        value={line.expiryDate}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, expiryDate: e.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Taxable Value</span>
              <span className="tabular-nums font-medium">
                {formatINR(draftSummary.taxable)}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[var(--text-secondary)]">
                {draftSummary.isIntraState ? "CGST + SGST" : "IGST"}
              </span>
              <span className="tabular-nums font-medium">
                {formatINR(draftSummary.tax)}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-[var(--border-default)] pt-2 font-semibold">
              <span>Bill Total</span>
              <span className="tabular-nums">{formatINR(draftSummary.total)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60"
          >
            {isPending ? "Posting to Ledger..." : "Save & Inward to Stock Ledger"}
          </button>
        </form>
      </SlideOverDrawer>

      {/* Supplier Payment Drawer */}
      <SlideOverDrawer
        open={Boolean(payPurchase)}
        onClose={() => setPayPurchase(null)}
        title={`Record Supplier Payment — ${payPurchase?.purchaseNumber ?? ""}`}
        subtitle={payPurchase?.supplierName}
      >
        {payPurchase ? (
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 text-sm">
              <div className="flex justify-between">
                <span>Bill Total</span>
                <span className="tabular-nums font-medium">
                  {formatINR(payPurchase.totalAmount)}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Already Paid</span>
                <span className="tabular-nums">{formatINR(payPurchase.paidAmount)}</span>
              </div>
              <div className="mt-1 flex justify-between font-semibold text-amber-700 dark:text-amber-400">
                <span>Balance Due</span>
                <span className="tabular-nums">
                  {formatINR(
                    money(toDec(payPurchase.totalAmount).minus(payPurchase.paidAmount))
                  )}
                </span>
              </div>
            </div>
            <div>
              <label className={labelCls}>Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                required
                className={inputCls}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Mode</label>
                <select
                  className={inputCls}
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value as PaymentMode)}
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="date"
                  required
                  className={inputCls}
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>UTR / Reference #</label>
              <input
                className={inputCls}
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input
                className={inputCls}
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
            >
              {isPending ? "Saving..." : "Save Supplier Payment"}
            </button>
          </form>
        ) : null}
      </SlideOverDrawer>

      <ConfirmDialog
        open={Boolean(rejectGrnTarget)}
        onClose={() => setRejectGrnTarget(null)}
        onConfirm={handleRejectGrn}
        loading={isPending}
        variant="danger"
        requireReason
        minReasonLength={5}
        reasonLabel="Rejection Reason"
        reasonPlaceholder="e.g. Duplicate challan or damaged shipment returned at gate..."
        title={`Reject GRN ${rejectGrnTarget?.grnNumber ?? ""}`}
        description="Rejected GRNs will not be added to FIFO stock batches."
        confirmLabel="Reject GRN"
      />
    </div>
  );
}
