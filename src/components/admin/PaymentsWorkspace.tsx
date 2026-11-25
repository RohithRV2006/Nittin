"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMode } from "@prisma/client";
import { recordCustomerPaymentAction } from "@/actions/billing.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import { StatCard } from "@/components/ui/StatCard";
import { formatINR, money, toDec } from "@/lib/decimal";
import { PAYMENT_MODES } from "@/lib/enums";
import { downloadPaymentReceiptPdf } from "@/lib/pdf/invoice-pdf";

export interface PaymentsPageData {
  companyName: string;
  companyGstin: string;
  customers: Array<{
    id: string;
    name: string;
    state: string;
    totalInvoiced: string;
    totalPaid: string;
    outstanding: string;
    openInvoices: Array<{
      id: string;
      invoiceNumber: string;
      invoiceDate: string;
      balanceDue: string;
    }>;
  }>;
  payments: Array<{
    id: string;
    customerName: string;
    invoiceNumber: string | null;
    paymentDate: string;
    amount: string;
    paymentMode: PaymentMode;
    referenceNumber: string | null;
    notes: string | null;
  }>;
}

const inputCls =
  "h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#047857]";
const labelCls = "mb-1 block text-xs font-medium text-[#475569]";

export function PaymentsWorkspace({ data }: { data: PaymentsPageData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    variant: "success" | "danger";
    text: string;
  } | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customerId, setCustomerId] = useState(data.customers[0]?.id ?? "");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("UPI");
  const [paymentDate, setPaymentDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const selectedCustomer = useMemo(
    () => data.customers.find((c) => c.id === customerId) ?? null,
    [data.customers, customerId]
  );

  const totals = useMemo(() => {
    let invoiced = money(0);
    let collected = money(0);
    let outstanding = money(0);
    for (const c of data.customers) {
      invoiced = money(invoiced.plus(c.totalInvoiced));
      collected = money(collected.plus(c.totalPaid));
      outstanding = money(outstanding.plus(c.outstanding));
    }
    return { invoiced, collected, outstanding };
  }, [data.customers]);

  const openModalForCustomer = (custId: string, suggestedAmt?: string) => {
    setCustomerId(custId);
    setInvoiceId("");
    setAmount(suggestedAmt ?? "");
    setReferenceNumber("");
    setNotes("");
    setDrawerOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await recordCustomerPaymentAction({
        customerId,
        invoiceId: invoiceId || undefined,
        amount,
        paymentMode,
        paymentDate,
        referenceNumber,
        notes,
      });
      if (!res.ok) {
        setFeedback({ variant: "danger", text: res.error ?? "Failed to record payment" });
        return;
      }
      setDrawerOpen(false);
      setAmount("");
      setReferenceNumber("");
      setNotes("");
      setFeedback({ variant: "success", text: "Customer payment recorded and allocated." });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Collections & Customer Balances"
        subtitle="Record receipts against customer invoices and print payment vouchers"
        actions={
          <button
            type="button"
            disabled={data.customers.length === 0}
            onClick={() =>
              openModalForCustomer(
                data.customers[0]?.id ?? "",
                data.customers[0]?.outstanding
              )
            }
            className="h-10 rounded-lg bg-[#047857] px-4 text-sm font-semibold text-white hover:bg-[#065F46] disabled:opacity-50"
          >
            + Record Customer Payment
          </button>
        }
      />

      {feedback ? (
        <InlineAlert variant={feedback.variant}>{feedback.text}</InlineAlert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Posted Invoiced" value={formatINR(totals.invoiced)} />
        <StatCard
          label="Total Collections"
          value={formatINR(totals.collected)}
          tone="success"
        />
        <StatCard
          label="Total Outstanding"
          value={formatINR(totals.outstanding)}
          tone={totals.outstanding.gt(0) ? "warning" : "default"}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#0F172A]">
          Customer Receivables Summary
        </h2>
        <ResponsiveTable
          data={data.customers}
          keyExtractor={(r) => r.id}
          emptyTitle="No customers yet"
          mobileTitle={(r) => r.name}
          mobileActions={(r) =>
            toDec(r.outstanding).gt(0) ? (
              <button
                type="button"
                onClick={() => openModalForCustomer(r.id, r.outstanding)}
                className="rounded-lg bg-[#047857] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Collect Payment
              </button>
            ) : null
          }
          columns={[
            { key: "name", header: "Customer", render: (r) => r.name },
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
                <span
                  className={
                    toDec(r.outstanding).gt(0)
                      ? "font-semibold text-[#B45309]"
                      : "text-[#15803D]"
                  }
                >
                  {formatINR(r.outstanding)}
                </span>
              ),
            },
            {
              key: "actions",
              header: "Action",
              align: "right",
              render: (r) =>
                toDec(r.outstanding).gt(0) ? (
                  <button
                    type="button"
                    onClick={() => openModalForCustomer(r.id, r.outstanding)}
                    className="text-xs font-semibold text-[#047857] hover:underline"
                  >
                    + Collect
                  </button>
                ) : (
                  <span className="text-xs text-[#64748B]">Settled</span>
                ),
            },
          ]}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#0F172A]">
          Recent Payments Received
        </h2>
        <ResponsiveTable
          data={data.payments}
          keyExtractor={(r) => r.id}
          emptyTitle="No payments recorded yet"
          mobileTitle={(r) => r.customerName}
          columns={[
            { key: "date", header: "Date", render: (r) => r.paymentDate },
            { key: "cust", header: "Customer", render: (r) => r.customerName },
            {
              key: "inv",
              header: "Invoice",
              render: (r) => (
                <span className="font-mono text-xs">{r.invoiceNumber ?? "—"}</span>
              ),
            },
            {
              key: "mode",
              header: "Mode",
              render: (r) => r.paymentMode.replace("_", " "),
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
            {
              key: "receipt",
              header: "Receipt",
              align: "right",
              render: (r) => (
                <button
                  type="button"
                  onClick={() =>
                    downloadPaymentReceiptPdf({
                      receiptId: r.id,
                      companyName: data.companyName,
                      companyGstin: data.companyGstin,
                      customerName: r.customerName,
                      paymentDate: r.paymentDate,
                      amount: r.amount,
                      paymentMode: r.paymentMode,
                      referenceNumber: r.referenceNumber,
                      invoiceNumber: r.invoiceNumber,
                      notes: r.notes,
                    })
                  }
                  className="text-xs font-medium text-[#047857] hover:underline"
                >
                  Receipt PDF
                </button>
              ),
            },
          ]}
        />
      </div>

      {/* Record Payment Drawer */}
      <SlideOverDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Record Customer Payment"
        subtitle="Allocates against selected invoice or oldest unpaid invoices (FIFO)"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Customer</label>
            <select
              className={inputCls}
              required
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setInvoiceId("");
              }}
            >
              {data.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — Due: {formatINR(c.outstanding)}
                </option>
              ))}
            </select>
          </div>

          {selectedCustomer ? (
            <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[#475569]">Current Outstanding Balance</span>
                <span className="font-semibold tabular-nums text-[#B45309]">
                  {formatINR(selectedCustomer.outstanding)}
                </span>
              </div>
            </div>
          ) : null}

          <div>
            <label className={labelCls}>Apply to Invoice</label>
            <select
              className={inputCls}
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
            >
              <option value="">Auto-allocate oldest unpaid invoices (FIFO)</option>
              {selectedCustomer?.openInvoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} ({inv.invoiceDate}) — Due: {formatINR(inv.balanceDue)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount Received (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                className={`${inputCls} tabular-nums`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Payment Mode</label>
              <select
                className={inputCls}
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Payment Date</label>
              <input
                type="date"
                required
                className={inputCls}
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>UTR / Reference #</label>
              <input
                className={inputCls}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes (optional)</label>
            <input
              className={inputCls}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-lg bg-[#047857] text-sm font-semibold text-white hover:bg-[#065F46]"
          >
            {isPending ? "Saving..." : "Save Payment"}
          </button>
        </form>
      </SlideOverDrawer>
    </div>
  );
}
