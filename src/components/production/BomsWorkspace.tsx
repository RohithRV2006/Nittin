"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ItemCategory, UnitType } from "@prisma/client";
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
  "h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#047857] focus:ring-2 focus:ring-[#047857]/20";
const labelCls = "mb-1 block text-xs font-medium text-[#475569]";

export function BomsWorkspace({ data }: { data: BomsPageData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    variant: "success" | "danger";
    text: string;
  } | null>(null);

  const ingMap = useMemo(
    () => new Map(data.ingredientItems.map((i) => [i.id, i])),
    [data.ingredientItems]
  );

  // Create / Edit BOM Drawer
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

  // Clone & Scale BOM Drawer
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
    setCloneBatchOut(bom.batchSizeOutput);
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
        // leave manual scale
      }
    }
    if (target) {
      setCloneName(`${target.name} Recipe`);
    }
  };

  const handleSaveBom = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await upsertBomAction(bomForm);
      if (!res.ok) {
        setFeedback({ variant: "danger", text: res.error ?? "Failed to save BOM" });
        return;
      }
      setBomOpen(false);
      setFeedback({ variant: "success", text: "BOM recipe saved." });
      router.refresh();
    });
  };

  const handleCloneBom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneSource) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await cloneBomAction({
        sourceBomId: cloneSource.id,
        targetFinishedItemId: cloneTargetId,
        name: cloneName,
        scaleFactor: cloneScale,
        batchSizeOutput: cloneBatchOut,
      });
      if (!res.ok) {
        setFeedback({ variant: "danger", text: res.error ?? "Clone failed" });
        return;
      }
      setCloneSource(null);
      setFeedback({ variant: "success", text: "Cloned and scaled BOM created." });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="BOM Recipe Directory & Builder"
        subtitle="Define standard ingredient/packaging ratios per batch and scale across pack sizes"
        actions={
          <button
            type="button"
            disabled={data.finishedItems.length === 0 || data.ingredientItems.length === 0}
            onClick={openCreateBom}
            className="h-10 rounded-lg bg-[#047857] px-4 text-sm font-semibold text-white hover:bg-[#065F46] disabled:opacity-50"
          >
            + Create BOM Recipe
          </button>
        }
      />

      {feedback ? (
        <InlineAlert variant={feedback.variant}>{feedback.text}</InlineAlert>
      ) : null}

      {data.boms.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#0F172A]">No BOM recipes configured</p>
          <p className="mt-1 text-xs text-[#64748B]">
            Create a Bill of Materials linking raw materials and packaging to a finished product.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.boms.map((bom) => (
            <div
              key={bom.id}
              className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-[#0F172A]">
                      {bom.name}
                    </h2>
                    <p className="mt-0.5 text-xs text-[#475569]">
                      Product: {bom.finishedItemName} (
                      <span className="font-mono">{bom.finishedItemCode}</span>) •
                      Expected Yield:{" "}
                      <strong className="tabular-nums">
                        {bom.batchSizeOutput} {bom.finishedUnit}
                      </strong>{" "}
                      • Tolerance: ±{bom.tolerancePercent}%
                    </p>
                  </div>
                  <StatusBadge
                    status={bom.active ? "SUFFICIENT" : "CANCELLED"}
                    customLabel={bom.active ? "Active" : "Inactive"}
                  />
                </div>

                <div className="mt-4 divide-y divide-[#F1F5F9] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
                  {bom.items.map((line) => (
                    <div
                      key={line.itemId}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-[#0F172A]">
                        {line.itemName}{" "}
                        <span className="font-mono text-[#64748B]">
                          ({line.itemCode})
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums text-[#0F172A]">
                        {line.standardQty} {line.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#F1F5F9] pt-3">
                <span className="text-xs text-[#64748B] tabular-nums">
                  Est. FIFO Material Cost:{" "}
                  <strong className="text-[#0F172A]">
                    {formatINR(bom.estimatedBatchCost)}
                  </strong>
                </span>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => openCloneBom(bom)}
                    className="text-xs font-medium text-[#0369A1] hover:underline"
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
                        batchSizeOutput: bom.batchSizeOutput,
                        tolerancePercent: bom.tolerancePercent,
                        items: bom.items.map((l) => ({
                          itemId: l.itemId,
                          standardQty: l.standardQty,
                          unit: l.unit,
                        })),
                      });
                      setBomOpen(true);
                    }}
                    className="text-xs font-medium text-[#047857] hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        await toggleBomActiveAction(bom.id, !bom.active);
                        router.refresh();
                      })
                    }
                    className="text-xs font-medium text-[#64748B]"
                  >
                    {bom.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit BOM Drawer */}
      <SlideOverDrawer
        open={bomOpen}
        onClose={() => setBomOpen(false)}
        title={bomForm.id ? "Edit BOM Recipe" : "Create BOM Recipe"}
        subtitle="Specify standard quantities of raw materials & packaging per batch"
      >
        <form onSubmit={handleSaveBom} className="space-y-4">
          <div>
            <label className={labelCls}>Finished Product</label>
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
                step="0.001"
                required
                className={inputCls}
                value={bomForm.batchSizeOutput}
                onChange={(e) =>
                  setBomForm({ ...bomForm, batchSizeOutput: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelCls}>Variance Tolerance (%)</label>
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
              <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                Ingredients & Packaging Lines
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
                className="text-xs font-semibold text-[#047857] hover:underline"
              >
                + Add Line
              </button>
            </div>

            {bomForm.items.map((line, idx) => {
              const ing = ingMap.get(line.itemId);
              const units = ing
                ? getCompatibleUnits(ing.unit, ing.unitsPerCarton)
                : [line.unit];
              return (
                <div
                  key={idx}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:grid-cols-12"
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
                      step="0.001"
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
            className="h-10 w-full rounded-lg bg-[#047857] text-sm font-semibold text-white hover:bg-[#065F46]"
          >
            {isPending ? "Saving..." : "Save BOM Recipe"}
          </button>
        </form>
      </SlideOverDrawer>

      {/* Clone & Scale BOM Drawer */}
      <SlideOverDrawer
        open={Boolean(cloneSource)}
        onClose={() => setCloneSource(null)}
        title={`Clone & Scale — ${cloneSource?.name ?? ""}`}
        subtitle="Reuse an existing recipe across another pack size (e.g. 200 g → 500 g)"
      >
        <form onSubmit={handleCloneBom} className="space-y-4">
          <div>
            <label className={labelCls}>Target Finished Product</label>
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
              <label className={labelCls}>Ingredient Scale Factor</label>
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
              <label className={labelCls}>Expected Batch Yield</label>
              <input
                type="number"
                step="0.001"
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
            className="h-10 w-full rounded-lg bg-[#047857] text-sm font-semibold text-white hover:bg-[#065F46]"
          >
            {isPending ? "Cloning..." : "Create Scaled BOM"}
          </button>
        </form>
      </SlideOverDrawer>
    </div>
  );
}
