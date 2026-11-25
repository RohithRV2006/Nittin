import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";

const REPORTS = [
  { href: "/auditor/sales-register", title: "Sales Register", desc: "Customer-wise & product-wise outward supplies" },
  { href: "/auditor/gst-summary", title: "GST Summary (GSTR-1 / 3B)", desc: "B2B, B2C, Credit Notes & tax rate summary" },
  { href: "/auditor/purchase-register", title: "Purchase Register", desc: "Supplier inward bills & input GST" },
  { href: "/auditor/stock-ledger", title: "Stock Summary & Ledger", desc: "Opening, inward, outward, closing & batch balances" },
  { href: "/auditor/production-report", title: "Production Variance & Costing", desc: "Planned vs actual consumption, yield & cost/packet" },
  { href: "/auditor/receivables", title: "Receivables & Collections", desc: "Customer collections & 0-30 / 31-60 / 61-90 / 90+ ageing" },
  { href: "/auditor/audit-log", title: "Audit Trail", desc: "Immutable log of edits, overrides & cancellations" },
];

export default function AuditorCenterPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Auditor Workspace & Report Center"
        subtitle="Read-only statutory statements, ledger reconciliations, Excel/CSV/PDF & Tally exports"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-[#047857]"
          >
            <h2 className="text-sm font-semibold text-[#0F172A]">{r.title}</h2>
            <p className="mt-1 text-xs text-[#64748B]">{r.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
