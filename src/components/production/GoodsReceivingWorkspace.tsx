"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GrnStatus, UnitType } from "@prisma/client";
import { toast } from "sonner";
import { createGoodsReceiptAction } from "@/actions/procurement.actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { isIntegerUnit } from "@/lib/enums";

export interface GrnPageData {
  suppliers: Array<{ id: string; name: string; state: string }>;
  items: Array<{
    id: string;
    code: string;
    name: string;
    unit: UnitType;
    unitsPerCarton: number | null;
  }>;
  grns: Array<{
    id: string;
    grnNumber: string;
    supplierName: string;
    challanNumber: string;
    receivedDate: string;
    status: GrnStatus;
    receivedByName: string;
    purchaseNumber: string | null;
    rejectionReason: string | null;
    notes: string | null;
    itemsSummary: string;
  }>;
}

interface DraftGrnLine {
  itemId: string;
  quantity: string;
  inputUnit: UnitType;
  batchNumber: string;
  expiryDate: string;
}

function getCompatibleUnits(baseUnit: UnitType, unitsPerCarton: number | null): UnitType[] {
  if (baseUnit === "KG" || baseUnit === "GRAM") return ["KG", "GRAM"];
  if (baseUnit === "LITRE" || baseUnit === "ML") return ["LITRE", "ML"];
  if ((baseUnit === "PIECE" || baseUnit === "PACKET") && unitsPerCarton && unitsPerCarton > 0) {
    return [baseUnit, "CARTON"];
  }
  return [baseUnit];
}

const inputCls =
  "h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-secondary)]";

export function GoodsReceivingWorkspace({ data }: { data: GrnPageData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const [supplierId, setSupplierId] = useState(data.suppliers[0]?.id ?? "");
  const [challanNumber, setChallanNumber] = useState("");
  const [receivedDate, setReceivedDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftGrnLine[]>(() =>
    data.items[0]
      ? [
          {
            itemId: data.items[0].id,
            quantity: "1",
            inputUnit: data.items[0].unit,
            batchNumber: "",
            expiryDate: "",
          },
        ]
      : []
  );

  const itemMap = useMemo(
    () => new Map(data.items.map((i) => [i.id, i])),
    [data.items]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createGoodsReceiptAction({
        supplierId,
        challanNumber,
        receivedDate,
        notes,
        lines,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Failed to record GRN");
        return;
      }
      setOpen(false);
      setChallanNumber("");
      setNotes("");
      toast.success(
        `GRN ${res.data?.grnNumber ?? ""} logged. Sent to Factory Admin for bill verification.`
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Floor Goods Receipt (GRN)"
        subtitle="Log physical inward raw material & packaging counts for Admin verification"
        actions={
          <button
            type="button"
            disabled={data.suppliers.length === 0 || data.items.length === 0}
            onClick={() => setOpen(true)}
            className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
          >
            + Log Inward Delivery (GRN)
          </button>
        }
      />

      <ResponsiveTable
        data={data.grns}
        keyExtractor={(r) => r.id}
        emptyTitle="No floor goods receipts yet"
        emptyDescription="Log physical supplier deliveries arriving at the store or factory gate."
        mobileTitle={(r) => r.grnNumber}
        mobileSubtitle={(r) => <StatusBadge status={r.status} />}
        columns={[
          {
            key: "grn",
            header: "GRN #",
            render: (r) => <span className="font-mono text-xs font-semibold">{r.grnNumber}</span>,
          },
          { key: "date", header: "Received", render: (r) => r.receivedDate },
          { key: "sup", header: "Supplier", render: (r) => r.supplierName },
          { key: "chal", header: "Challan #", render: (r) => r.challanNumber },
          {
            key: "items",
            header: "Received Materials",
            render: (r) => (
              <span className="text-xs text-[var(--text-secondary)]">{r.itemsSummary}</span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => (
              <div>
                <StatusBadge status={r.status} />
                {r.purchaseNumber ? (
                  <p className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
                    Bill: {r.purchaseNumber}
                  </p>
                ) : null}
                {r.rejectionReason ? (
                  <p className="mt-1 text-[10px] text-red-700 dark:text-red-400">
                    {r.rejectionReason}
                  </p>
                ) : null}
              </div>
            ),
          },
        ]}
      />

      <SlideOverDrawer
        open={open}
        onClose={() => setOpen(false)}
        title="Log Floor Goods Receipt (GRN)"
        subtitle="Physical quantity & batch intake only — pricing & GST bills remain with Factory Admin"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Supplier</label>
              <select
                className={inputCls}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                {data.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.state})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Received Date</label>
              <input
                type="date"
                required
                className={inputCls}
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Supplier Delivery Challan #</label>
              <input
                required
                className={inputCls}
                placeholder="DC-4421"
                value={challanNumber}
                onChange={(e) => setChallanNumber(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Gate / Quality Note (optional)</label>
              <input
                className={inputCls}
                placeholder="Sealed bags verified"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Received Raw Materials / Packaging
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
                      quantity: "1",
                      inputUnit: first.unit,
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
              const intUnit = isIntegerUnit(line.inputUnit);
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
                        step={intUnit ? "1" : "0.001"}
                        min={intUnit ? "1" : "0.001"}
                        inputMode={intUnit ? "numeric" : "decimal"}
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
                      <label className={labelCls}>Lot / Batch #</label>
                      <input
                        className={inputCls}
                        placeholder="Optional"
                        value={line.batchNumber}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...line, batchNumber: e.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Expiry</label>
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

          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
          >
            {isPending ? "Submitting GRN..." : "Submit GRN to Admin"}
          </button>
        </form>
      </SlideOverDrawer>
    </div>
  );
}
