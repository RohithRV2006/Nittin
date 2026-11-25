"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProductionRunStatus } from "@prisma/client";
import { toast } from "sonner";
import { cancelProductionRunAction } from "@/actions/production.actions";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { SlideOverDrawer } from "@/components/ui/SlideOverDrawer";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatINR } from "@/lib/decimal";

export interface ProductionOverviewData {
  stats: {
    activeBoms: number;
    inProgressRuns: number;
    completedLast7Days: number;
    varianceAlerts24h: number;
  };
  recentVarianceAlerts: Array<{
    id: string;
    runNumber: string;
    productName: string;
    yieldVariancePercent: string;
  }>;
  recommendations: Array<{
    bomId: string;
    productName: string;
    pendingQty: string;
    availableStock: string;
    deficit: string;
    recommendedBatches: number;
  }>;
  inProgressRuns: Array<{
    id: string;
    runNumber: string;
    productName: string;
    runDate: string;
    plannedOutput: string;
    unit: string;
    materialCost: string;
  }>;
  recentRuns: Array<{
    id: string;
    runNumber: string;
    productName: string;
    runDate: string;
    status: ProductionRunStatus;
    plannedOutput: string;
    actualOutput: string;
    unit: string;
    yieldVariancePercent: string;
    varianceFlagged: boolean;
    totalRunCost: string;
    costPerPacket: string | null;
  }>;
}

export function ProductionOverviewClient({
  data,
}: {
  data: ProductionOverviewData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelRun, setCancelRun] = useState<{
    id: string;
    runNumber: string;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelRun) return;
    startTransition(async () => {
      const res = await cancelProductionRunAction({
        runId: cancelRun.id,
        reason: cancelReason,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Cancellation failed");
        return;
      }
      const num = cancelRun.runNumber;
      setCancelRun(null);
      setCancelReason("");
      toast.success(`Run ${num} cancelled and materials returned to stock.`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Floor"
        subtitle="BOM planning, daily batch runs, and variance alerts"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/production/boms"
              className="inline-flex min-h-[40px] items-center rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
            >
              Manage BOMs
            </Link>
            <Link
              href="/production/new-run"
              className="inline-flex min-h-[40px] items-center rounded-lg bg-[var(--brand-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--brand-hover)]"
            >
              + Start Production Run
            </Link>
          </div>
        }
      />

      {data.recentVarianceAlerts.length > 0 ? (
        <InlineAlert
          variant="danger"
          title="Variance Alert (> Tolerance in Last 24 Hours)"
        >
          {data.recentVarianceAlerts
            .map(
              (a) =>
                `${a.runNumber} (${a.productName}): Yield ${a.yieldVariancePercent}%`
            )
            .join(" • ")}
        </InlineAlert>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active BOMs" value={data.stats.activeBoms} />
        <StatCard
          label="In-Progress Runs"
          value={data.stats.inProgressRuns}
          tone={data.stats.inProgressRuns > 0 ? "warning" : "default"}
        />
        <StatCard label="Completed (7d)" value={data.stats.completedLast7Days} />
        <StatCard
          label="Variance Alerts (24h)"
          value={data.stats.varianceAlerts24h}
          tone={data.stats.varianceAlerts24h > 0 ? "danger" : "success"}
        />
      </div>

      {data.recommendations.length > 0 ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            Production Requirement Planner
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.recommendations.map((rec) => (
              <div
                key={rec.bomId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3.5 dark:border-[#92400E] dark:bg-[#451A03]/40"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {rec.productName}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)] tabular-nums">
                    Pending: {rec.pendingQty} • Stock: {rec.availableStock} •{" "}
                    <strong className="text-[#B45309] dark:text-[#FBBF24]">
                      Deficit: {rec.deficit}
                    </strong>
                  </p>
                </div>
                <Link
                  href={`/production/new-run?bomId=${rec.bomId}&multiplier=${rec.recommendedBatches}`}
                  className="inline-flex min-h-[38px] items-center rounded-lg bg-[var(--brand-primary)] px-3 text-xs font-semibold text-white hover:bg-[var(--brand-hover)]"
                >
                  Run {rec.recommendedBatches} Batch(es) →
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {data.inProgressRuns.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            In-Progress Batch Runs
          </h2>
          <ResponsiveTable
            data={data.inProgressRuns}
            keyExtractor={(r) => r.id}
            mobileTitle={(r) => r.runNumber}
            mobileSubtitle={() => <StatusBadge status="IN_PROGRESS" />}
            mobileActions={(r) => (
              <>
                <Link
                  href={`/production/new-run?runId=${r.id}`}
                  className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Complete Run
                </Link>
                <button
                  type="button"
                  onClick={() => setCancelRun({ id: r.id, runNumber: r.runNumber })}
                  className="rounded-lg border border-[#FECACA] px-3 py-1.5 text-xs font-medium text-[#B91C1C]"
                >
                  Cancel
                </button>
              </>
            )}
            columns={[
              {
                key: "run",
                header: "Run #",
                render: (r) => (
                  <span className="font-mono text-xs font-medium">{r.runNumber}</span>
                ),
              },
              { key: "prod", header: "Product", render: (r) => r.productName },
              { key: "date", header: "Started", render: (r) => r.runDate },
              {
                key: "planned",
                header: "Expected",
                align: "right",
                render: (r) => `${Number(r.plannedOutput).toFixed(0)} ${r.unit}`,
              },
              {
                key: "cost",
                header: "Issued Cost",
                align: "right",
                render: (r) => formatINR(r.materialCost),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (r) => (
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/production/new-run?runId=${r.id}`}
                      className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                    >
                      Complete Run
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        setCancelRun({ id: r.id, runNumber: r.runNumber })
                      }
                      className="text-xs font-medium text-[#B91C1C] hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
          Recent Production Runs
        </h2>
        <ResponsiveTable
          data={data.recentRuns}
          keyExtractor={(r) => r.id}
          emptyTitle="No production runs logged yet"
          emptyDescription="Start a batch run to track yield and cost."
          mobileTitle={(r) => `${r.runNumber} — ${r.productName}`}
          mobileSubtitle={(r) => (
            <StatusBadge
              status={r.varianceFlagged ? "FLAGGED" : r.status}
              customLabel={r.varianceFlagged ? "Variance Alert" : undefined}
            />
          )}
          columns={[
            {
              key: "run",
              header: "Run #",
              render: (r) => (
                <span className="font-mono text-xs font-medium">{r.runNumber}</span>
              ),
            },
            { key: "prod", header: "Product", render: (r) => r.productName },
            { key: "date", header: "Date", render: (r) => r.runDate },
            {
              key: "yield",
              header: "Actual / Planned",
              align: "right",
              render: (r) => `${r.actualOutput} / ${r.plannedOutput} ${r.unit}`,
            },
            {
              key: "var",
              header: "Yield Var %",
              align: "right",
              render: (r) => (
                <span
                  className={
                    r.varianceFlagged
                      ? "font-semibold text-[#B91C1C] dark:text-[#F87171]"
                      : "text-[#15803D] dark:text-[#4ADE80]"
                  }
                >
                  {r.yieldVariancePercent}%
                </span>
              ),
            },
            {
              key: "cost",
              header: "Cost / Pkt",
              align: "right",
              render: (r) =>
                r.costPerPacket ? formatINR(r.costPerPacket) : "N/A",
            },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <StatusBadge
                  status={r.varianceFlagged ? "FLAGGED" : r.status}
                  customLabel={r.varianceFlagged ? "Variance Alert" : undefined}
                />
              ),
            },
          ]}
        />
      </div>

      <SlideOverDrawer
        open={Boolean(cancelRun)}
        onClose={() => setCancelRun(null)}
        title={`Cancel Run — ${cancelRun?.runNumber ?? ""}`}
        subtitle="Returns issued raw materials back to stock"
      >
        <form onSubmit={handleCancel} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Cancellation Reason
            </label>
            <textarea
              rows={3}
              required
              minLength={5}
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] p-3 text-sm outline-none focus:border-[var(--brand-primary)]"
              placeholder="Explain why this batch run was aborted..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-lg bg-[#B91C1C] text-sm font-semibold text-white hover:bg-[#991B1B]"
          >
            {isPending ? "Reversing Stock..." : "Confirm Cancel & Return Stock"}
          </button>
        </form>
      </SlideOverDrawer>
    </div>
  );
}
