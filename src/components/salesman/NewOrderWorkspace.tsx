"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UnitType } from "@prisma/client";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { submitFieldOrderAction } from "@/actions/salesman.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatINR, money, toDec } from "@/lib/decimal";
import { computeGstSplit } from "@/lib/engines/tax";
import { formatDisplayQty, isIntegerUnit } from "@/lib/enums";
import {
  enqueueOfflineOrder,
  loadSalesmanCatalogCache,
  saveSalesmanCatalogCache,
} from "@/lib/offline-orders";
import { convertUnit } from "@/lib/units";

export interface NewOrderCatalogData {
  factoryStateCode: string;
  customers: Array<{
    id: string;
    name: string;
    type: string;
    state: string;
    stateCode: string;
    gstin: string | null;
    customPrices: Record<string, string>;
  }>;
  products: Array<{
    id: string;
    code: string;
    name: string;
    unit: UnitType;
    unitsPerCarton: number | null;
    taxRate: string;
    sellingPrice: string;
    availableStock: string;
  }>;
}

interface OrderLineDraft {
  itemId: string;
  quantity: string;
  inputUnit: UnitType;
}

export function NewOrderWorkspace({
  initialData,
}: {
  initialData: NewOrderCatalogData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [catalog, setCatalog] = useState<NewOrderCatalogData>(initialData);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState(
    initialData.customers[0]?.id ?? ""
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLineDraft[]>(() =>
    initialData.products[0]
      ? [
          {
            itemId: initialData.products[0].id,
            quantity: "1",
            inputUnit: initialData.products[0].unit,
          },
        ]
      : []
  );

  useEffect(() => {
    if (initialData.customers.length > 0 && initialData.products.length > 0) {
      saveSalesmanCatalogCache(initialData);
    } else {
      const cached = loadSalesmanCatalogCache<NewOrderCatalogData>();
      if (cached) {
        setCatalog(cached);
        if (!customerId && cached.customers[0]) {
          setCustomerId(cached.customers[0].id);
        }
      }
    }
  }, [initialData, customerId]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return catalog.customers;
    return catalog.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        (c.gstin?.toLowerCase().includes(q) ?? false)
    );
  }, [catalog.customers, customerSearch]);

  const selectedCustomer = useMemo(
    () => catalog.customers.find((c) => c.id === customerId) ?? null,
    [catalog.customers, customerId]
  );

  const productMap = useMemo(
    () => new Map(catalog.products.map((p) => [p.id, p])),
    [catalog.products]
  );

  const getUnitPrice = (productId: string): string => {
    const prod = productMap.get(productId);
    if (!prod) return "0.00";
    if (selectedCustomer && selectedCustomer.customPrices[productId]) {
      return selectedCustomer.customPrices[productId];
    }
    return prod.sellingPrice;
  };

  const summary = useMemo(() => {
    let taxable = money(0);
    let cgst = money(0);
    let sgst = money(0);
    let igst = money(0);

    for (const line of lines) {
      const prod = productMap.get(line.itemId);
      if (!prod) continue;
      const q = Number(line.quantity);
      if (!Number.isFinite(q) || q <= 0) continue;

      let baseQty = toDec(q);
      try {
        baseQty = convertUnit(q, line.inputUnit, prod.unit, {
          unitsPerCarton: prod.unitsPerCarton,
        });
      } catch {
        continue;
      }

      const unitPrice =
        selectedCustomer?.customPrices[prod.id] ?? prod.sellingPrice;
      const lineTaxable = money(baseQty.mul(unitPrice));
      const split = computeGstSplit(
        lineTaxable,
        prod.taxRate,
        catalog.factoryStateCode,
        selectedCustomer?.stateCode ?? catalog.factoryStateCode
      );

      taxable = money(taxable.plus(split.taxableAmount));
      cgst = money(cgst.plus(split.cgstAmount));
      sgst = money(sgst.plus(split.sgstAmount));
      igst = money(igst.plus(split.igstAmount));
    }

    const total = money(taxable.plus(cgst).plus(sgst).plus(igst));
    return { taxable, cgst, sgst, igst, total };
  }, [lines, productMap, selectedCustomer, catalog.factoryStateCode]);

  const adjustQty = (idx: number, delta: number) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const curr = Number(l.quantity) || 0;
        const next = Math.max(1, curr + delta);
        return { ...l, quantity: String(next) };
      })
    );
  };

  const queueOffline = async (clientRequestId: string) => {
    if (!selectedCustomer) return;
    await enqueueOfflineOrder({
      clientRequestId,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      notes,
      items: lines.map((l) => {
        const p = productMap.get(l.itemId);
        return {
          itemId: l.itemId,
          itemName: p?.name ?? "Product",
          quantity: Number(l.quantity) || 0,
          inputUnit: l.inputUnit,
          unitPrice: getUnitPrice(l.itemId),
        };
      }),
      estimatedTotal: summary.total.toFixed(2),
      queuedAt: new Date().toISOString(),
    });
    toast.warning(
      `Saved offline for ${selectedCustomer.name}. Auto-syncs when online.`,
      {
        action: {
          label: "View Queue",
          onClick: () => router.push("/salesman/orders"),
        },
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      toast.error("Please select a customer.");
      return;
    }

    const clientRequestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await queueOffline(clientRequestId);
      return;
    }

    startTransition(async () => {
      try {
        const res = await submitFieldOrderAction({
          clientRequestId,
          customerId: selectedCustomer.id,
          notes,
          items: lines.map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            inputUnit: l.inputUnit,
          })),
        });

        if (!res.ok) {
          toast.error(res.error ?? "Failed to submit order.");
          return;
        }

        toast.success(`Order ${res.data?.orderNumber ?? ""} submitted!`, {
          action: {
            label: "Track Orders",
            onClick: () => router.push("/salesman/orders"),
          },
        });
        router.refresh();
      } catch {
        // Network dropped mid-submit: save safely to offline queue
        await queueOffline(clientRequestId);
      }
    });
  };

  return (
    <div className="space-y-5 pb-36 lg:pb-10">
      <PageHeader
        title="New Field Order"
        subtitle="Select customer, tap packet counts, and submit to factory"
      />

      {catalog.customers.length === 0 || catalog.products.length === 0 ? (
        <InlineAlert variant="warning" title="Catalog Not Ready">
          Ask Factory Admin to add active customers and priced finished goods under Masters.
        </InlineAlert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Customer Selection */}
          <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
              1. Select Customer
            </h2>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="search"
                placeholder="Search retailer / distributor..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] pr-3 pl-9 text-base outline-none focus:border-[var(--brand-primary)] sm:text-sm"
              />
            </div>

            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-base text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)] sm:text-sm"
            >
              {filteredCustomers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.state} ({c.stateCode}) [{c.type}]
                </option>
              ))}
            </select>

            {selectedCustomer ? (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                GSTIN:{" "}
                <span className="font-mono">
                  {selectedCustomer.gstin ?? "Unregistered"}
                </span>{" "}
                • Place of Supply: {selectedCustomer.state} (
                {selectedCustomer.stateCode === catalog.factoryStateCode
                  ? "Intra-State CGST+SGST"
                  : "Inter-State IGST"}
                )
              </p>
            ) : null}
          </section>

          {/* 2. Products */}
          <section className="space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                2. Add Products & Quantities
              </h2>
              <button
                type="button"
                onClick={() => {
                  const nextProd =
                    catalog.products.find(
                      (p) => !lines.some((l) => l.itemId === p.id)
                    ) ?? catalog.products[0];
                  if (!nextProd) return;
                  setLines([
                    ...lines,
                    { itemId: nextProd.id, quantity: "1", inputUnit: nextProd.unit },
                  ]);
                }}
                className="min-h-[36px] rounded-lg border border-[var(--border-strong)] px-3 text-xs font-semibold text-[var(--brand-primary)] hover:bg-[#ECFDF5]"
              >
                + Add Product
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => {
                const prod = productMap.get(line.itemId);
                const price = getUnitPrice(line.itemId);
                const unitOpts: UnitType[] =
                  prod && prod.unitsPerCarton && prod.unitsPerCarton > 0
                    ? [prod.unit, "CARTON"]
                    : prod
                      ? [prod.unit]
                      : ["PACKET"];

                let lineAmount = money(0);
                if (prod) {
                  try {
                    const baseQty = convertUnit(
                      line.quantity || 0,
                      line.inputUnit,
                      prod.unit,
                      { unitsPerCarton: prod.unitsPerCarton }
                    );
                    lineAmount = money(baseQty.mul(price));
                  } catch {
                    // skip mid-input
                  }
                }

                return (
                  <div
                    key={idx}
                    className="space-y-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={line.itemId}
                        onChange={(e) => {
                          const chosen = productMap.get(e.target.value);
                          setLines(
                            lines.map((l, i) =>
                              i === idx
                                ? {
                                    ...l,
                                    itemId: e.target.value,
                                    inputUnit: chosen?.unit ?? l.inputUnit,
                                  }
                                : l
                            )
                          );
                        }}
                        className="h-11 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-base font-medium text-[var(--text-primary)] sm:text-sm"
                      >
                        {catalog.products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — ₹{getUnitPrice(p.id)}/{p.unit}
                          </option>
                        ))}
                      </select>
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setLines(lines.filter((_, i) => i !== idx))
                          }
                          aria-label="Remove product"
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#FECACA] bg-[var(--bg-surface)] text-red-700 dark:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>

                    {prod ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                        <span>
                          Warehouse Stock:{" "}
                          <strong className="tabular-nums text-[var(--text-primary)]">
                            {formatDisplayQty(prod.availableStock, prod.unit)} {prod.unit}
                          </strong>
                        </span>
                        <span className="tabular-nums">
                          Rate: <strong>₹{price}</strong>/{prod.unit} (+{prod.taxRate}% GST)
                        </span>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => adjustQty(idx, -1)}
                          aria-label="Decrease quantity"
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] active:bg-[var(--bg-subtle)]"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          type="number"
                          step={isIntegerUnit(line.inputUnit) ? "1" : "0.001"}
                          min={isIntegerUnit(line.inputUnit) ? "1" : "0.001"}
                          inputMode={isIntegerUnit(line.inputUnit) ? "numeric" : "decimal"}
                          required
                          value={line.quantity}
                          onChange={(e) => {
                            setLines(
                              lines.map((l, i) =>
                                i === idx ? { ...l, quantity: e.target.value } : l
                              )
                            );
                          }}
                          className="h-11 w-24 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 text-center text-base font-semibold tabular-nums text-[var(--text-primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => adjustQty(idx, 1)}
                          aria-label="Increase quantity"
                          className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] active:bg-[var(--bg-subtle)]"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <select
                          value={line.inputUnit}
                          onChange={(e) => {
                            setLines(
                              lines.map((l, i) =>
                                i === idx
                                  ? { ...l, inputUnit: e.target.value as UnitType }
                                  : l
                              )
                            );
                          }}
                          className="h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2.5 text-sm font-medium"
                        >
                          {unitOpts.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-[var(--text-muted)]">Line Taxable</span>
                        <p className="text-base font-semibold tabular-nums text-[var(--text-primary)]">
                          {formatINR(lineAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Notes */}
          <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 sm:p-5">
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Delivery / Dealer Notes (optional)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. Evening tempo dispatch, urgent stock..."
              className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-base outline-none focus:border-[var(--brand-primary)] sm:text-sm"
            />
          </section>

          {/* Sticky Bottom Order Summary Bar */}
          <div className="fixed inset-x-0 bottom-16 z-20 border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 shadow-lg lg:static lg:rounded-xl lg:border lg:p-5 lg:shadow-none">
            <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-[var(--text-secondary)] tabular-nums">
                <div>
                  Taxable: <strong>{formatINR(summary.taxable)}</strong> • GST:{" "}
                  <strong>
                    {formatINR(
                      money(summary.cgst.plus(summary.sgst).plus(summary.igst))
                    )}
                  </strong>
                </div>
                <div className="text-base font-bold text-[var(--text-primary)]">
                  Est. Grand Total: {formatINR(summary.total)}
                </div>
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="h-12 w-full rounded-lg bg-[var(--brand-primary)] px-6 text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-60 sm:w-auto"
              >
                {isPending ? "Submitting Order..." : "Submit Order to Factory"}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
