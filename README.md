# Nittin — Order-to-Audit ERP for Small-Scale Food Manufacturing

**Nittin** is a production-ready, single-entry **Order-to-Audit ERP** built for small-scale packaged food manufacturers. Every transaction is recorded once at its source—from a field salesman's phone to the production floor, billing desk, and statutory auditor—converging on an immutable **Stock Ledger** with FIFO/FEFO batch valuation.

---

## Tech Stack & Justification

* **Next.js 15 (App Router, TypeScript) & Tailwind CSS:** Unifies mobile, tablet, and desktop role portals with type-safe Server Actions and responsive zero-runtime CSS.
* **PostgreSQL + Prisma ORM:** Provides ACID transactions (`prisma.$transaction`), row-level locking (`SELECT ... FOR UPDATE`) on FIFO inventory lots, and strict `Decimal(12, 2)` / `Decimal(12, 3)` schema types.
* **`decimal.js`:** Eliminates IEEE-754 floating-point drift across all server-side tax, costing, and stock arithmetic (`ROUND_HALF_UP`).
* **`jose` + `bcryptjs` + Zod:** Two-layer RBAC (Edge JWT verification + database `User.active` & `tokenVersion` checks), DB-backed brute-force lockout, and strict server payload validation.

---

## Features Implemented (Against `docs/PS.md` Scope)

### Must-Have
* **Role-Based Access Control (5 Roles):** `SALESMAN`, `FACTORY_ADMIN`, `PRODUCTION_SUPERVISOR`, `AUDITOR` (read-only), and `OWNER`.
* **Dynamic Masters & Settings (`/admin/masters`):** Zero hardcoding—Company GST Profile, Items (`KG`, `GRAM`, `LITRE`, `ML`, `PIECE`, `PACKET`, `CARTON`), Customers, Customer-Specific Pricing (`CustomerPrice`), Suppliers, and Staff User management.
* **Mobile-First Salesman Portal (`/salesman`):** Sub-60-second order capture, carton-to-packet unit conversions, live GST preview, order history, and customer-wise sales summary.
* **Order Verification & GST Invoicing (`/admin/orders`, `/admin/invoices`):** Real-time stock sufficiency alerts, quantity/price overrides (`AuditLog`), intra-state (`CGST+SGST`) & inter-state (`IGST`) billing, sequential FY numbering, A4 PDF tax invoices, dispatch stock deduction, and Credit Note reversals (restocking only if already dispatched).
* **BOM & Production Engine (`/production`, `/production/boms`, `/production/new-run`):** Multi-item BOM recipes with pack-size cloning/scaling, 1-step or 2-step (`IN_PROGRESS` $\rightarrow$ `COMPLETED`) batch execution, automatic raw/packaging deductions + finished goods receipt, and planned-vs-actual consumption & yield variance flags ($\pm 3\%$ tolerance).
* **Immutable Stock Ledger (`/admin/adjustments`, `/auditor/stock-ledger`):** Append-only `StockLedger` + `StockBatch` reconciliation (`Opening + Inward - Outward = Closing`).
* **Monthly Statutory Reports (`/auditor/*`):** All 6 reports (**Sales Register**, **GSTR-1/3B GST Summary**, **Purchase Register**, **Stock Summary & Ledger**, **Production Variance & Costing**, **Payments & Receivables Ageing**) plus **Audit Trail** (`/auditor/audit-log`), all exportable to **Excel (`.xlsx`)**, **CSV** (with CWE-1236 formula injection sanitization), and **PDF**.

### Should-Have & Stretch Goals
* **Purchases & Supplier Payments (`/admin/purchases`):** Multi-line supplier bills with batch/expiry capture and vendor settlements.
* **Customer Payments & Ageing (`/admin/payments`, `/auditor/receivables`):** Invoice-specific or FIFO auto-allocated collections, printable Receipt Voucher PDFs, and `0–30 / 31–60 / 61–90 / 90+` ageing buckets.
* **FIFO Valuation & Unit Costing:** Oldest-batch FIFO consumption + direct labour & power/gas overhead absorption per actual good packet produced.
* **Owner Executive Dashboard (`/dashboard`):** Commercial pulse, finished stock vs. pending orders, variance alerts, unit economics, and receivables.
* **Offline Field Order Sync:** IndexedDB/localStorage queue with `clientRequestId` idempotency and auto-sync on reconnect.
* **Production Requirement Planner:** Aggregates pending/on-hold orders vs. finished stock to suggest exact batch runs.
* **WhatsApp Invoice Sharing, Tally Prime XML/Excel Export & Mocked NIC e-Invoice (IRN/QR) / e-Way Bill JSON Export.**

---

## Setup & Deployment

### 1. Environment Variables
Copy `.env.example` to `.env` and configure your PostgreSQL URL (Neon or local Postgres) and `SESSION_SECRET`:

```powershell
cp .env.example .env
```

### 2. Install, Push Schema & Initialize Production Admin
```powershell
npm install
npx prisma db push
npm run db:seed
```
*(In production, keep `ENABLE_DEMO_MODE="false"`. `npm run db:seed` creates only your initial `FACTORY_ADMIN` account from `BOOTSTRAP_ADMIN_*` env vars—zero demo records.)*

### 3. Optional: Load Section 5 Benchmark Demo Dataset
To evaluate the Section 5 benchmark scenario in staging/demo:
```powershell
# Set ENABLE_DEMO_MODE="true" in .env if you also want the /login demo switcher
npm run db:seed:demo
```

### 4. Run Locally or via Docker Compose
```powershell
npm run dev
# OR single-command local Docker stack:
docker compose up --build
```

### 5. Run Automated Verification Suite
```powershell
npm run typecheck
npm test
npm run lint
```

---

## Section 5 Benchmark Verification Summary

| Check | Expected (`PS.md`) | Verified Engine Output |
| :--- | :--- | :--- |
| Flour closing balance | `120 kg` (`100 + 60 - 40`) | `120.000 kg` (FIFO: 60 kg @ ₹42 + 60 kg @ ₹45) |
| Cooking oil closing balance | `19.5 L` | `19.500 L` |
| 200 g pouches closing | `306` (`188 + 6` damaged) | `306 pieces` (`PRODUCTION_ISSUE` `-188`, `SCRAP_DAMAGE` `-6`) |
| Finished goods post-run / post-dispatch | `238` $\rightarrow$ `88 pkts` | `238` $\rightarrow$ `88 packets` |
| Yield & Oil variances | `-6%` & `+5%` flagged | `-6.00%` (Flagged), `+5.00%` (Flagged) at $\pm 3\%$ |
| Retailer A invoice (TN `33`) | `₹7,500 + ₹187.50 CGST + ₹187.50 SGST = ₹7,875` | `₹7,875.00` |
| Retailer A outstanding | `₹3,875` | `₹3,875.00` |
| Distributor B order (KA `29`) | Shortage `32 pkts`; IGST applies | `32 packets` shortage flagged; `5% IGST` (`₹300.00` on `120 pkts`) |
| Cost per packet (FIFO + Direct Overheads) | Stated method & rule | `₹5,810.00 / 188 = ₹30.90/pkt` (`38.20%` gross margin vs ₹50) |

---

## Documentation Index

* [docs/PS.md](docs/PS.md) — Original Problem Statement
* [docs/DESIGN_NOTE.md](docs/DESIGN_NOTE.md) — Executive 2-Page Design Note
* [docs/DATABASE.md](docs/DATABASE.md) — Relational Schema & Ledger Invariants
* [docs/BUSINESS_LOGIC.md](docs/BUSINESS_LOGIC.md) — FIFO, BOM Variance, Costing & GST Math
* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Multi-Tier Architecture & Stack Rationale
* [docs/SECURITY.md](docs/SECURITY.md) — OWASP Threat Model, RBAC Matrix & Hardening
* [docs/UI_UX_DESIGN.md](docs/UI_UX_DESIGN.md) — Responsive Design System & Screen Specs
* [docs/PAGES_AND_FEATURES.md](docs/PAGES_AND_FEATURES.md) — Complete Route & Feature Map
