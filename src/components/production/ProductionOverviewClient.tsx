"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductionRunStatus } from "@prisma/client";
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
  const [feedback, setFeedback] = useState<{
    variant: "success" | "danger";
    text: string;
  } | null>(null);

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelRun) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await cancelProductionRunAction({
        runId: cancelRun.id,
        reason: cancelReason,
      });
      if (!res.ok) {
        setFeedback({ variant: "danger", text: res.error ?? "Cancellation failed" });
        return;
      }
      setCancelRun(null);
      setCancelReason("");
      setFeedback({
        variant: "success",
        text: `Run ${cancelRun.runNumber} cancelled and issued materials returned to stock.`,
      });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Floor Overview"
        subtitle="BOM recipes, batch run planning, and tolerance alerts"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/production/boms"
              className="inline-flex min-h-[40px] items-center rounded-lg border border-[#CBD5E1] bg-white px-4 text-sm font-medium text-[#0F172A] hover:bg-[#F1F5F9]"
            >
              Manage BOMs
            </Link>
            <Link
              href="/production/new-run"
              className="inline-flex min-h-[40px] items-center rounded-lg bg-[#047857] px-4 text-sm font-semibold text-white hover:bg-[#065F46]"
            >
              + Start Production Run
            </Link>
          </div>
        }
      />

      {feedback ? (
        <InlineAlert variant={feedback.variant}>{feedback.text}</InlineAlert>
      ) : null}

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

      {/* Production Requirement Planner */}
      {data.recommendations.length > 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <h2 className="text-sm font-semibold text-[#0F172A]">
            Production Requirement Planner (Pending Orders vs. Finished Stock)
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.recommendations.map((rec) => (
              <div
                key={rec.bomId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3.5"
              >
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {rec.productName}
                  </p>
                  <p className="mt-0.5 text-xs text-[#475569] tabular-nums">
                    Pending: {rec.pendingQty} • In Stock: {rec.availableStock} •{" "}
                    <strong className="text-[#B45309]">
                      Deficit: {rec.deficit}
                    </strong>
                  </p>
                </div>
                <Link
                  href={`/production/new-run?bomId=${rec.bomId}&multiplier=${rec.recommendedBatches}`}
                  className="inline-flex min-h-[38px] items-center rounded-lg bg-[#047857] px-3 text-xs font-semibold text-white hover:bg-[#065F46]"
                >
                  Run {rec.recommendedBatches} Batch(es) →
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Active In-Progress Runs */}
      {data.inProgressRuns.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#0F172A]">
            In-Progress Batch Runs (Awaiting Output Completion)
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
                  className="rounded-lg bg-[#047857] px-3 py-1.5 text-xs font-semibold text-white"
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
                header: "Expected Output",
                align: "right",
                render: (r) => `${r.plannedOutput} ${r.unit}`,
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
                      className="text-xs font-semibold text-[#047857] hover:underline"
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

      {/* Recent Runs History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#0F172A]">
          Recent Production Runs
        </h2>
        <ResponsiveTable
          data={data.recentRuns}
          keyExtractor={(r) => r.id}
          emptyTitle="No production runs logged yet"
          emptyDescription="Start a daily batch run against a BOM recipe to track yield, variance, and cost per packet."
          mobileTitle={(r) => `${r.runNumber} — ${r.productName}`}
          mobileSubtitle={(r) => (
            <StatusBadge
              status={r.varianceFlagged ? "FLAGGED" : r.status}
              customLabel={r.varianceFlagged ? "Variance Flagged" : undefined}
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
                    r.varianceFlagged ? "font-semibold text-[#B91C1C]" : "text-[#15803D]"
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
                r.costPerPacket ? formatINR(r.costPerPacket) : "N/A (0 yield)",
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

      {/* Cancel In-Progress Run Drawer */}
      <SlideOverDrawer
        open={Boolean(cancelRun)}
        onClose={() => setCancelRun(null)}
        title={`Cancel Production Run — ${cancelRun?.runNumber ?? ""}`}
        subtitle="Returns all issued raw materials back to FIFO Stock Batches"
      >
        <form onSubmit={handleCancel} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#475569]">
              Mandatory Cancellation Reason
            </label>
            <textarea
              rows={3}
              required
              minLength={5}
              className="w-full rounded-lg border border-[#CBD5E1] bg-white p-3 text-sm outline-none focus:border-[#047857]"
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
