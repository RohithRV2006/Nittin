"use client";

import { useMemo, useState } from "react";
import { BarChart3, Calendar, IndianRupee, PackageCheck, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { StatCard } from "@/components/ui/StatCard";
import { formatINR } from "@/lib/decimal";

export interface AnalyticsPeriodPoint {
  key: string;
  label: string;
  sales: number;
  purchases: number;
  collections: number;
  unitsProduced: number;
}

export interface OwnerAnalyticsData {
  monthly: AnalyticsPeriodPoint[];
  yearly: AnalyticsPeriodPoint[];
  topProducts: Array<{
    name: string;
    qtyLabel: string;
    revenue: number;
    sharePct: number;
  }>;
  topCustomers: Array<{
    name: string;
    state: string;
    revenue: number;
    sharePct: number;
  }>;
  stockBreakdown: Array<{
    category: string;
    valuation: number;
    sharePct: number;
  }>;
  totalStockValuation: number;
}

export function OwnerAnalyticsClient({ data }: { data: OwnerAnalyticsData }) {
  const [horizon, setHorizon] = useState<"monthly" | "yearly">("monthly");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const series = horizon === "monthly" ? data.monthly : data.yearly;

  const totals = useMemo(() => {
    let sales = 0;
    let purchases = 0;
    let collections = 0;
    let units = 0;
    for (const row of series) {
      sales += row.sales;
      purchases += row.purchases;
      collections += row.collections;
      units += row.unitsProduced;
    }
    const netSpread = sales - purchases;
    const collectionPct = sales > 0 ? Math.min(100, (collections / sales) * 100) : 0;
    return { sales, purchases, collections, units, netSpread, collectionPct };
  }, [series]);

  const maxBarValue = useMemo(() => {
    let maxVal = 1;
    for (const row of series) {
      maxVal = Math.max(maxVal, row.sales, row.purchases, row.collections);
    }
    return maxVal;
  }, [series]);

  const activePoint =
    series.find((p) => p.key === hoveredKey) ?? series[series.length - 1] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Business Analytics & Reports"
          subtitle="Monthly and yearly revenue trends, procurement outflow, collections, and stock valuation"
        />
        <div className="inline-flex rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 self-start">
          <button
            type="button"
            onClick={() => {
              setHorizon("monthly");
              setHoveredKey(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              horizon === "monthly"
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Monthly (12M)
          </button>
          <button
            type="button"
            onClick={() => {
              setHorizon("yearly");
              setHoveredKey(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              horizon === "yearly"
                ? "bg-[var(--brand-primary)] text-white"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Yearly View
          </button>
        </div>
      </div>

      {/* Period KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={horizon === "monthly" ? "12M Invoiced Sales" : "All-Year Sales"}
          value={formatINR(totals.sales.toFixed(2))}
          sublabel={`${totals.collectionPct.toFixed(1)}% collected`}
        />
        <StatCard
          label={horizon === "monthly" ? "12M Procurement" : "All-Year Procurement"}
          value={formatINR(totals.purchases.toFixed(2))}
          sublabel="Inward raw & packaging bills"
        />
        <StatCard
          label="Gross Commercial Spread"
          value={formatINR(totals.netSpread.toFixed(2))}
          sublabel="Sales minus raw purchases"
          tone={totals.netSpread >= 0 ? "success" : "warning"}
        />
        <StatCard
          label="Production & Inventory"
          value={`${totals.units.toFixed(0)} Pkts`}
          sublabel={`FIFO Stock Value: ${formatINR(data.totalStockValuation.toFixed(2))}`}
        />
      </div>

      {/* Sales vs Purchases vs Collections Trend Chart */}
      <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <TrendingUp className="h-4 w-4 text-[var(--brand-primary)]" />
              {horizon === "monthly"
                ? "Monthly Revenue, Procurement & Collections"
                : "Yearly Revenue, Procurement & Collections"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              Hover or tap any period column to inspect exact values
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#D97706]" />
              Sales
            </span>
            <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#78350F] dark:bg-[#92400E]" />
              Purchases
            </span>
            <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#15803D] dark:bg-[#22C55E]" />
              Collections
            </span>
          </div>
        </div>

        {activePoint ? (
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3.5 py-2 text-xs">
            <span className="font-semibold text-[var(--text-primary)]">
              {activePoint.label}
            </span>
            <span className="tabular-nums text-[var(--text-secondary)]">
              Sales: <strong className="text-[var(--text-primary)]">{formatINR(activePoint.sales.toFixed(2))}</strong>
            </span>
            <span className="tabular-nums text-[var(--text-secondary)]">
              Purchases: <strong className="text-[var(--text-primary)]">{formatINR(activePoint.purchases.toFixed(2))}</strong>
            </span>
            <span className="tabular-nums text-[var(--text-secondary)]">
              Collections: <strong className="text-[#15803D] dark:text-[#4ADE80]">{formatINR(activePoint.collections.toFixed(2))}</strong>
            </span>
            <span className="tabular-nums text-[var(--text-secondary)]">
              Produced: <strong className="text-[var(--text-primary)]">{activePoint.unitsProduced.toFixed(0)} pkts</strong>
            </span>
          </div>
        ) : null}

        <div className="mt-5 overflow-x-auto pb-2">
          <div className="flex h-56 min-w-[560px] items-end gap-2 border-b border-[var(--border-default)] px-2 pt-4">
            {series.map((pt) => {
              const sH = Math.max(pt.sales > 0 ? 6 : 2, Math.round((pt.sales / maxBarValue) * 176));
              const pH = Math.max(pt.purchases > 0 ? 6 : 2, Math.round((pt.purchases / maxBarValue) * 176));
              const cH = Math.max(pt.collections > 0 ? 6 : 2, Math.round((pt.collections / maxBarValue) * 176));
              const selected = activePoint?.key === pt.key;
              return (
                <button
                  key={pt.key}
                  type="button"
                  onMouseEnter={() => setHoveredKey(pt.key)}
                  onFocus={() => setHoveredKey(pt.key)}
                  onClick={() => setHoveredKey(pt.key)}
                  className={`group flex flex-1 flex-col items-center justify-end gap-2 rounded-t-lg px-1 pt-2 transition ${
                    selected ? "bg-[var(--bg-subtle)]/70" : "hover:bg-[var(--bg-subtle)]/40"
                  }`}
                >
                  <div className="flex h-44 w-full items-end justify-center gap-1">
                    <div
                      style={{ height: `${sH}px` }}
                      title={`Sales: ${formatINR(pt.sales.toFixed(2))}`}
                      className="w-2.5 rounded-t bg-[#D97706] transition-all sm:w-3"
                    />
                    <div
                      style={{ height: `${pH}px` }}
                      title={`Purchases: ${formatINR(pt.purchases.toFixed(2))}`}
                      className="w-2.5 rounded-t bg-[#78350F] transition-all dark:bg-[#92400E] sm:w-3"
                    />
                    <div
                      style={{ height: `${cH}px` }}
                      title={`Collections: ${formatINR(pt.collections.toFixed(2))}`}
                      className="w-2.5 rounded-t bg-[#15803D] transition-all dark:bg-[#22C55E] sm:w-3"
                    />
                  </div>
                  <span className="pb-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                    {pt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Revenue Mix & Inventory Valuation Split */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Top Products */}
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <PackageCheck className="h-4 w-4 text-[var(--brand-primary)]" />
            Top Products by Revenue
          </h2>
          {data.topProducts.length === 0 ? (
            <p className="mt-4 text-xs text-[var(--text-muted)]">No posted sales invoices yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.topProducts.map((p) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium text-[var(--text-primary)]">{p.name}</span>
                    <span className="tabular-nums font-semibold text-[var(--text-primary)]">
                      {formatINR(p.revenue.toFixed(2))}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--brand-primary)]"
                      style={{ width: `${Math.max(4, p.sharePct)}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {p.qtyLabel} • {p.sharePct.toFixed(1)}% of sales
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Top Customers */}
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <IndianRupee className="h-4 w-4 text-[var(--brand-primary)]" />
            Top Customers by Billing
          </h2>
          {data.topCustomers.length === 0 ? (
            <p className="mt-4 text-xs text-[var(--text-muted)]">No customer billing recorded yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.topCustomers.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-medium text-[var(--text-primary)]">
                      {c.name} <span className="text-[var(--text-muted)]">({c.state})</span>
                    </span>
                    <span className="tabular-nums font-semibold text-[var(--text-primary)]">
                      {formatINR(c.revenue.toFixed(2))}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[#15803D] dark:bg-[#22C55E]"
                      style={{ width: `${Math.max(4, c.sharePct)}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    {c.sharePct.toFixed(1)}% revenue share
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Inventory FIFO Valuation Split */}
        <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            FIFO Inventory Value Split
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Total on-hand valuation: {formatINR(data.totalStockValuation.toFixed(2))}
          </p>
          <div className="mt-4 space-y-3">
            {data.stockBreakdown.map((s) => (
              <div key={s.category}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[var(--text-primary)]">{s.category}</span>
                  <span className="tabular-nums font-semibold text-[var(--text-primary)]">
                    {formatINR(s.valuation.toFixed(2))}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent-gold)]"
                    style={{ width: `${Math.max(s.valuation > 0 ? 4 : 0, s.sharePct)}%` }}
                  />
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                  {s.sharePct.toFixed(1)}% of inventory capital
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Period Summary Table */}
      <ResponsiveTable
        data={[...series].reverse()}
        keyExtractor={(r) => r.key}
        emptyTitle="No data for selected period"
        mobileTitle={(r) => r.label}
        mobileSubtitle={(r) => `Sales ${formatINR(r.sales.toFixed(2))}`}
        columns={[
          { key: "period", header: "Period", render: (r) => r.label },
          {
            key: "sales",
            header: "Invoiced Sales",
            align: "right",
            render: (r) => formatINR(r.sales.toFixed(2)),
          },
          {
            key: "purchases",
            header: "Purchases",
            align: "right",
            render: (r) => formatINR(r.purchases.toFixed(2)),
          },
          {
            key: "collections",
            header: "Collections",
            align: "right",
            render: (r) => formatINR(r.collections.toFixed(2)),
          },
          {
            key: "spread",
            header: "Sales - Purchases",
            align: "right",
            render: (r) => formatINR((r.sales - r.purchases).toFixed(2)),
          },
          {
            key: "prod",
            header: "Output (Pkts)",
            align: "right",
            render: (r) => r.unitsProduced.toFixed(0),
          },
        ]}
      />
    </div>
  );
}
