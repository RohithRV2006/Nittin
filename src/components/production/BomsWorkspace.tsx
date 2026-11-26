"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ItemCategory, UnitType } from "@prisma/client";
import { toast } from "sonner";
import {
  cloneBomAction,
  toggleBomActiveAction,
  upsertBomAction,
} from "@/actions/production.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR } from "@/lib/decimal";
import { formatDisplayQty, isIntegerUnit } from "@/lib/enums";
import { computePackScaleFactor } from "@/lib/units";

export interface BomsPageData {
  defaultTolerancePercent: string;
  finishedItems: Array<{
    id: string;
    code: string;
    name: string;
    unit: UnitType;
    packWeightGrams: string | null;
  }>;
  ingredientItems: Array<{
    id: string;
    code: string;
    name: string;
    category: ItemCategory;
    unit: UnitType;
    unitsPerCarton: number | null;
  }>;
  boms: Array<{
    id: string;
    name: string;
    finishedItemId: string;
    finishedItemName: string;
    finishedItemCode: string;
    finishedUnit: UnitType;
    finishedPackGrams: string | null;
    batchSizeOutput: string;
    tolerancePercent: string;
    active: boolean;
    estimatedBatchCost: string;
    items: Array<{
      itemId: string;
      itemName: string;
      itemCode: string;
      standardQty: string;
      unit: UnitType;
    }>;
  }>;
}

function getCompatibleUnits(baseUnit: UnitType, unitsPerCarton: number | null): UnitType[] {
  if (baseUnit === "KG" || baseUnit === "GRAM") return ["KG", "GRAM"];
  if (baseUnit === "LITRE" || baseUnit === "ML") return ["LITRE", "ML"];
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
  "h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-primary)]";
const labelCls = "mb-1 block text-xs font-medium text-[var(--text-secondary)]";

export function BomsWorkspace({
  data,
  readOnly = false,
}: {
  data: BomsPageData;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const ingMap = useMemo(
    () => new Map(data.ingredientItems.map((i) => [i.id, i])),
    [data.ingredientItems]
  );

  const [bomOpen, setBomOpen] = useState(false);
  const [bomForm, setBomForm] = useState<{
    id?: string;
    finishedItemId: string;
    name: string;
    batchSizeOutput: string;
    tolerancePercent: string;
    items: Array<{ itemId: string; standardQty: string; unit: UnitType }>;
  }>({
    finishedItemId: data.finishedItems[0]?.id ?? "",
    name: "",
    batchSizeOutput: "200",
    tolerancePercent: data.defaultTolerancePercent,
    items: [],
  });

  const [cloneSource, setCloneSource] = useState<
    BomsPageData["boms"][number] | null
  >(null);
  const [cloneTargetId, setCloneTargetId] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [cloneScale, setCloneScale] = useState("1.000");
  const [cloneBatchOut, setCloneBatchOut] = useState("");

  const openCreateBom = () => {
    const firstIng = data.ingredientItems[0];
    setBomForm({
      finishedItemId: data.finishedItems[0]?.id ?? "",
      name: "",
      batchSizeOutput: "",
      tolerancePercent: data.defaultTolerancePercent,
      items: firstIng
        ? [{ itemId: firstIng.id, standardQty: "", unit: firstIng.unit }]
        : [],
    });
    setBomOpen(true);
  };

  const openCloneBom = (bom: BomsPageData["boms"][number]) => {
    setCloneSource(bom);
    const defaultTarget =
      data.finishedItems.find((f) => f.id !== bom.finishedItemId) ??
      data.finishedItems[0];
    setCloneTargetId(defaultTarget?.id ?? "");
    let scale = "1.000";
    if (bom.finishedPackGrams && defaultTarget?.packWeightGrams) {
      try {
        scale = computePackScaleFactor(
          bom.finishedPackGrams,
          defaultTarget.packWeightGrams
        ).toFixed(3);
      } catch {
        scale = "1.000";
      }
    }
    setCloneScale(scale);
    setCloneBatchOut(formatDisplayQty(bom.batchSizeOutput, bom.finishedUnit));
    setCloneName(
      defaultTarget ? `${defaultTarget.name} Recipe` : `${bom.name} (Scaled)`
    );
  };

  const handleTargetChange = (targetId: string) => {
    setCloneTargetId(targetId);
    const target = data.finishedItems.find((f) => f.id === targetId);
    if (cloneSource?.finishedPackGrams && target?.packWeightGrams) {
      try {
        setCloneScale(
          computePackScaleFactor(
            cloneSource.finishedPackGrams,
            target.packWeightGrams
          ).toFixed(3)
        );
      } catch {
        // manual
      }
    }
    if (target) setCloneName(`${target.name} Recipe`);
  };

  const handleSaveBom = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await upsertBomAction(bomForm);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to save BOM");
        return;
      }
      setBomOpen(false);
      toast.success("BOM recipe saved.");
      router.refresh();
    });
  };

  const handleCloneBom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneSource) return;
    startTransition(async () => {
      const res = await cloneBomAction({
        sourceBomId: cloneSource.id,
        targetFinishedItemId: cloneTargetId,
        name: cloneName,
        scaleFactor: cloneScale,
        batchSizeOutput: cloneBatchOut,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Clone failed");
        return;
      }
      setCloneSource(null);
      toast.success("Cloned and scaled BOM created.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="BOM Recipes"
        subtitle="Standard batch ratios and pack-size scaling"
        actions={
          readOnly ? (
            <Link
              href="/admin/masters"
              className="inline-flex h-10 items-center rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            >
              Add Finished Good SKU →
            </Link>
          ) : (
            <button
              type="button"
              disabled={data.finishedItems.length === 0 || data.ingredientItems.length === 0}
              onClick={openCreateBom}
              className="h-10 rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)] disabled:opacity-50"
            >
              + Create BOM Recipe
            </button>
          )
        }
      />

      {readOnly ? (
        <InlineAlert variant="info" title="Read-Only BOM Directory">
          To create a recipe for a new snack or pack size, first add the{" "}
          <strong>Finished Good</strong> item under{" "}
          <Link href="/admin/masters" className="font-semibold underline">
            Masters &amp; Staff → Items
          </Link>
          ; the Floor Supervisor can then configure its BOM recipe under Production.
        </InlineAlert>
      ) : null}

      {data.boms.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-12 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No BOM recipes configured
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Create a Bill of Materials linking ingredients to a finished product.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.boms.map((bom) => (
            <div
              key={bom.id}
              className="flex flex-col justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-[0_1px_2px_rgba(35,23,15,0.04)]"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--text-primary)]">
                      {bom.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      {bom.finishedItemName} (
                      <span className="font-mono">{bom.finishedItemCode}</span>) •
                      Yield:{" "}
                      <strong className="tabular-nums">
                        {formatDisplayQty(bom.batchSizeOutput, bom.finishedUnit)}{" "}
                        {bom.finishedUnit}
                      </strong>{" "}
                      • Tol: ±{bom.tolerancePercent}%
                    </p>
                  </div>
                  <StatusBadge
                    status={bom.active ? "SUFFICIENT" : "CANCELLED"}
                    customLabel={bom.active ? "Active" : "Inactive"}
                  />
                </div>

                <div className="mt-4 divide-y divide-[var(--border-default)] rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)]">
                  {bom.items.map((line) => (
                    <div
                      key={line.itemId}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-[var(--text-primary)]">
                        {line.itemName}{" "}
                        <span className="font-mono text-[var(--text-muted)]">
                          ({line.itemCode})
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                        {formatDisplayQty(line.standardQty, line.unit)} {line.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-default)] pt-3">
                <span className="text-xs text-[var(--text-muted)] tabular-nums">
                  Est. FIFO Material:{" "}
                  <strong className="text-[var(--text-primary)]">
                    {formatINR(bom.estimatedBatchCost)}
                  </strong>
                </span>
                {!readOnly ? (
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => openCloneBom(bom)}
                      className="text-xs font-medium text-[var(--accent-gold)] hover:underline"
                    >
                      Clone & Scale
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBomForm({
                          id: bom.id,
                          finishedItemId: bom.finishedItemId,
                          name: bom.name,
                          batchSizeOutput: formatDisplayQty(
                            bom.batchSizeOutput,
                            bom.finishedUnit
                          ),
                          tolerancePercent: bom.tolerancePercent,
                          items: bom.items.map((l) => ({
                            itemId: l.itemId,
                            standardQty: formatDisplayQty(l.standardQty, l.unit),
                            unit: l.unit,
                          })),
                        });
                        setBomOpen(true);
                      }}
                      className="text-xs font-medium text-[var(--brand-primary)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          const res = await toggleBomActiveAction(bom.id, !bom.active);
                          if (res.ok) toast.success("BOM status updated.");
                          else toast.error(res.error ?? "Update failed");
                          router.refresh();
                        })
                      }
                      className="text-xs font-medium text-[var(--text-muted)]"
                    >
                      {bom.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <SlideOverDrawer
        open={bomOpen}
        onClose={() => setBomOpen(false)}
        title={bomForm.id ? "Edit BOM Recipe" : "Create BOM Recipe"}
        subtitle="Ingredient & packaging ratios per batch"
      >
        <form onSubmit={handleSaveBom} className="space-y-4">
          <div>
            <label className={labelCls}>Finished Product SKU</label>
            <select
              className={inputCls}
              required
              value={bomForm.finishedItemId}
              onChange={(e) =>
                setBomForm({ ...bomForm, finishedItemId: e.target.value })
              }
            >
              {data.finishedItems.map((fi) => (
                <option key={fi.id} value={fi.id}>
                  {fi.name} ({fi.code})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Output stock from runs goes into this Finished Good SKU. Need a new product (e.g., Adhirasam 200 g)? Have Factory Admin add it under Masters → Items first.
            </p>
            {!bomForm.id &&
            data.boms.some(
              (b) => b.active && b.finishedItemId === bomForm.finishedItemId
            ) ? (
              <div className="mt-2">
                <InlineAlert variant="warning">
                  This SKU already has an active BOM. Only save if this is an alternate recipe for the exact same product—do not link a different snack here.
                </InlineAlert>
              </div>
            ) : null}
          </div>
          <div>
            <label className={labelCls}>Recipe Name</label>
            <input
              className={inputCls}
              required
              value={bomForm.name}
              onChange={(e) => setBomForm({ ...bomForm, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Expected Output / Batch</label>
              <input
                type="number"
                step="1"
                required
                className={inputCls}
                value={bomForm.batchSizeOutput}
                onChange={(e) =>
                  setBomForm({ ...bomForm, batchSizeOutput: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Tolerance (%)</label>
              <input
                type="number"
                step="0.01"
                required
                className={inputCls}
                value={bomForm.tolerancePercent}
                onChange={(e) =>
                  setBomForm({ ...bomForm, tolerancePercent: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Ingredients & Packaging
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextIng =
                    data.ingredientItems.find(
                      (i) => !bomForm.items.some((l) => l.itemId === i.id)
                    ) ?? data.ingredientItems[0];
                  if (!nextIng) return;
                  setBomForm({
                    ...bomForm,
                    items: [
                      ...bomForm.items,
                      { itemId: nextIng.id, standardQty: "", unit: nextIng.unit },
                    ],
                  });
                }}
                className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
              >
                + Add Line
              </button>
            </div>

            {bomForm.items.map((line, idx) => {
              const ing = ingMap.get(line.itemId);
              const units = ing
                ? getCompatibleUnits(ing.unit, ing.unitsPerCarton)
                : [line.unit];
              const whole = isIntegerUnit(line.unit);
              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] p-3 sm:grid-cols-12"
                >
                  <div className="sm:col-span-6">
                    <select
                      className={inputCls}
                      value={line.itemId}
                      onChange={(e) => {
                        const chosen = ingMap.get(e.target.value);
                        const next = [...bomForm.items];
                        next[idx] = {
                          ...line,
                          itemId: e.target.value,
                          unit: chosen?.unit ?? line.unit,
                        };
                        setBomForm({ ...bomForm, items: next });
                      }}
                    >
                      {data.ingredientItems.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.category === "PACKAGING" ? "Pack" : "Raw"})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="number"
                      step={whole ? "1" : "0.001"}
                      required
                      placeholder="Qty"
                      className={inputCls}
                      value={line.standardQty}
                      onChange={(e) => {
                        const next = [...bomForm.items];
                        next[idx] = { ...line, standardQty: e.target.value };
                        setBomForm({ ...bomForm, items: next });
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-3">
                    <select
                      className={inputCls}
                      value={line.unit}
                      onChange={(e) => {
                        const next = [...bomForm.items];
                        next[idx] = { ...line, unit: e.target.value as UnitType };
                        setBomForm({ ...bomForm, items: next });
                      }}
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    {bomForm.items.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setBomForm({
                            ...bomForm,
                            items: bomForm.items.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-xs font-medium text-[#B91C1C]"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
          >
            {isPending ? "Saving..." : "Save BOM Recipe"}
          </button>
        </form>
      </SlideOverDrawer>

      <SlideOverDrawer
        open={Boolean(cloneSource)}
        onClose={() => setCloneSource(null)}
        title={`Clone & Scale — ${cloneSource?.name ?? ""}`}
        subtitle="Scale recipe across pack sizes"
      >
        <form onSubmit={handleCloneBom} className="space-y-4">
          <div>
            <label className={labelCls}>Target Product</label>
            <select
              className={inputCls}
              required
              value={cloneTargetId}
              onChange={(e) => handleTargetChange(e.target.value)}
            >
              {data.finishedItems.map((fi) => (
                <option key={fi.id} value={fi.id}>
                  {fi.name} ({fi.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>New Recipe Name</label>
            <input
              className={inputCls}
              required
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Scale Factor</label>
              <input
                type="number"
                step="0.001"
                required
                className={inputCls}
                value={cloneScale}
                onChange={(e) => setCloneScale(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Expected Yield</label>
              <input
                type="number"
                step="1"
                required
                className={inputCls}
                value={cloneBatchOut}
                onChange={(e) => setCloneBatchOut(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-lg bg-[var(--brand-primary)] text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
          >
            {isPending ? "Cloning..." : "Create Scaled BOM"}
          </button>
        </form>
      </SlideOverDrawer>
    </div>
  );
}
