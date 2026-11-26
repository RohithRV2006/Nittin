# Nittin — Order-to-Audit ERP for Small-Scale Food Manufacturing

**Nittin** is a single-entry **Order-to-Audit ERP** built for small-scale packaged South Indian snack manufacturers (murukku, mixture, chips, sweets). Every business event is entered once at its source—from a field salesman's phone to the factory gate, production floor, billing desk, and statutory auditor—converging on an immutable **Stock Ledger** with FIFO/FEFO lot valuation.

---

## Tech Stack & Justification

We chose **Next.js 15 (App Router, TypeScript)** with **Tailwind CSS** and **PostgreSQL (Neon Serverless / Docker Postgres)** mediated by **Prisma ORM** because one full-stack codebase cleanly delivers mobile-first PWA screens for field salesmen alongside data-dense desktop tables for admins and auditors—with zero CORS or separate API maintenance. All financial, GST, and inventory math runs strictly server-side inside `prisma.$transaction` with `decimal.js` (`Decimal(12, 2)` money, `Decimal(12, 3)` quantities) so figures never drift through floating-point rounding.

* **UI & UX:** `Tailwind CSS v4` (warm roasted-brown, ivory, & amber palette derived from `nittin.png`), `next-themes` (Light/Dark mode), `sonner` toast notifications, accessible custom React confirmation dialogs (`ConfirmDialog`), and `lucide-react`.
* **Security & Auth:** `jose` HS256 JWT `HttpOnly` cookies (checked at Edge Middleware + DB-backed `User.active` / `tokenVersion` verification on every Server Action), `bcryptjs` password hashing, sliding-window rate limiting, brute-force account lockout, `Zod` server validation, and CWE-1236 spreadsheet sanitization.
* **Exports:** `jsPDF` + `jspdf-autotable` (A4 Tax Invoices, Delivery Challans, Credit Notes, Payment Receipt Vouchers, and Auditor Report PDFs with embedded company logo), `xlsx` (`.xlsx` & CSV), and Tally XML exports.

---

## Scope & Requirements Satisfied (`docs/PS.md`)

### Section 6 — Must-Have Requirements (100% Complete)
* **Role-Based Access Control (5 Strict Portals):** `SALESMAN` (`/salesman/*`), `FACTORY_ADMIN` (`/admin/*`), `PRODUCTION_SUPERVISOR` (`/production/*`), `AUDITOR` (`/auditor/*`, read-only), and `OWNER` (`/dashboard`). Each role is strictly isolated to its portal.
* **Dynamic Masters (`/admin/masters`):** Company GST profile, Items (`KG`, `GRAM`, `LITRE`, `ML`, `PIECE`, `PACKET`, `CARTON` with whole-number enforcement on discrete units), Customers + custom `CustomerPrice` tiers, Suppliers, and Staff Users.
* **Mobile-First Field Salesman Portal (`/salesman`):** Sub-60-second order booking, carton-to-packet unit conversion, customer-specific rates, live GST preview, order status tracking, and customer-wise sales totals.
* **Order Verification & GST Billing (`/admin/orders`, `/admin/invoices`):** Real-time stock sufficiency alerts, editable qty/rate overrides logged to `AuditLog`, intra-state (`CGST+SGST`) & inter-state (`IGST`) tax splitting, FY-scoped sequential invoice numbers, A4 Tax Invoice PDFs, physical dispatch deduction, and Credit Note cancellations (restocking only dispatched quantities).
* **BOM & Production Engine (`/production`, `/production/boms`, `/production/new-run`):** Multi-item BOM recipes with pack-size scaling (`Clone & Scale BOM`), 1-step or 2-step (`IN_PROGRESS` $\rightarrow$ `COMPLETED`) batch runs, automatic raw material/packaging FIFO consumption, finished goods receipt, and planned-vs-actual consumption & yield variance flags ($\pm 3\%$ default tolerance).
* **Immutable Stock Ledger & Summary (`/admin/adjustments`, `/auditor/stock-ledger`):** Append-only `StockLedger` reconciled 100% against `StockBatch` lots (`Opening + Inward - Outward = Closing`), plus expiry alerts (`<= 15 days`) and audited manual stock adjustments.
* **Monthly Statutory Reports (`/auditor/*`):** Sales Register (Invoice/Customer/Product), GSTR-1/3B GST Summary (including Table 9B Credit Notes), Purchase Register, Stock Summary & Ledger, Production Variance & Costing, Payments & Receivables Ageing, and Audit Trail—exportable to **Excel (`.xlsx`)**, **CSV**, and **PDF**.

### Section 6 — Should-Have Requirements (100% Complete)
* **Inward Procurement & Vendor Bills (`/admin/purchases`):** Multi-line supplier bills, batch/expiry tracking, and supplier payments.
* **Customer Payments & Ageing (`/admin/payments`, `/auditor/receivables`):** Invoice-specific or FIFO auto-allocated customer receipts, printable Receipt Vouchers, and `0–30 / 31–60 / 61–90 / 90+` day ageing buckets (net of credit notes).
* **FIFO Valuation & Unit Costing:** Oldest-batch FIFO consumption + Direct Labour and Power/Gas overheads allocated over **actual good packets produced**.
* **Owner Executive Dashboard (`/dashboard`):** Daily commercial pulse, finished stock vs. pending pipeline orders, latest unit economics/margin, variance watchlist, low-stock/expiry alerts, and top customer dues.

### Section 6 — Stretch Goals & Phase 6 Hardening Implemented
* **Offline Field Order Capture & Auto-Sync:** Client-side queue with idempotent `clientRequestId` UUIDs and automatic sync on reconnect.
* **Batch & Expiry Tracking with FEFO Dispatch:** Batch lots with best-before tracking and First-Expiry-First-Out dispatch ordering.
* **Reorder Level & Low-Stock Alerts:** Reorder thresholds highlighted on Admin Command Center, Adjustments, and Owner Dashboard.
* **Production Requirement Planner:** Aggregates pending/`ON_HOLD` orders against finished stock to recommend exact batch runs on `/production`.
* **Tally Prime XML / Excel Export & Mocked NIC e-Invoice (IRN/QR) / e-Way Bill JSON Export.**
* **WhatsApp Invoice Sharing (`wa.me` pre-filled summary).**
* **Partial Dispatch & Delivery Challan PDFs (`/admin/invoices`):** Split-trip FEFO dispatch (`PARTIALLY_DISPATCHED` $\rightarrow$ `DISPATCHED`) with `CH/YY-YY/NNNN` Delivery Challan PDFs.
* **Sales Returns & Credit Note PDFs (`/admin/invoices`):** Partial line-level returns on dispatched invoices routing `RESALEABLE` returns back into `StockBatch` and keeping `DAMAGED` scrap out of sellable stock, with printable Credit Note PDFs.
* **Supervisor Goods Receipt Note (GRN) with Admin Billing Verification (`/production/receiving` $\rightarrow$ `/admin/purchases`):** Floor Supervisor logs physical gate deliveries (`GRN/YY-YY/NNNN`) without vendor pricing access; Admin verifies rates & GST to inward into FIFO batches.
* **Security & Auth Hardening:** Password show/hide toggle, self-service **Forgot Password** queue resolved via Admin temporary password reset (`mustChangePassword` prompt + session revocation via `tokenVersion`), sliding-window rate limiting on login/reset endpoints, customer credit-limit warnings, accessible React confirmation modals, pagination, and custom `error.tsx`/`not-found.tsx` boundaries.

### Remaining / Not Implemented (Known Gaps)
* **Stretch items from `PS.md` not implemented:** GPS salesman route check-in and Tamil UI translation for floor staff (English UI used across all roles).
* **External Production Integrations:** Live NIC/GSP API credentials (currently mocked IRN/QR & e-Way Bill JSON) and official GSTN offline-tool JSON export schema.
* **Secondary Workflows Deferred:** Supplier Purchase Returns (Debit Notes), explicit Batch Quarantine hold toggle on batches, server-side cursor pagination beyond 20-row client paging, Redis-backed multi-node rate limiting, and Playwright E2E browser tests against a live test PostgreSQL instance.

---

## Quick Setup & Deployment

### 1. Environment Variables
```powershell
cp .env.example .env
```
Configure `DATABASE_URL` (Neon Serverless or local PostgreSQL) and `SESSION_SECRET` (32+ chars). Keep `ENABLE_DEMO_MODE="false"` in production.

### 2. Local Evaluation vs. Production Setup

> **Important:** Always keep **Demo** and **Production** pointed at **separate PostgreSQL databases** (e.g., separate Neon branches). Never run Demo seed/reset against your Production database.

**Option A — Clean Production Mode (Local):**
```powershell
npm install
# Keep ENABLE_DEMO_MODE="false" in .env
npm run db:setup:prod
npm run dev
```
*Creates the top-level `OWNER` account (`BOOTSTRAP_OWNER_*`) and optionally an initial `FACTORY_ADMIN` (`BOOTSTRAP_ADMIN_*`)—zero demo records. The Owner can create and manage Factory Admins & Auditors anytime under **Admins & Company** (`/dashboard/team`).*

**Option B — Benchmark Demo Mode (Local Evaluation):**
```powershell
npm install
# Set ENABLE_DEMO_MODE="true" in .env (pointing to an isolated demo DB)
npm run db:setup:demo
npm run dev
```
*(Or click **"Load / Reset Benchmark Data"** directly on `/login` once `ENABLE_DEMO_MODE="true"` is set.)*

### 3. Single-Command Docker Compose (Turnkey Demo & Prod)
* **Demo Mode (Recommended for Evaluators — auto-seeds Section 5 Benchmark into an isolated `nittin_erp_demo` DB):**
  ```powershell
  docker compose -f docker-compose.yml -f docker-compose.demo.yml up --build
  ```
* **Production Mode (`ENABLE_DEMO_MODE=false`, bootstraps only Admin into `nittin_erp` DB):**
  ```powershell
  docker compose up --build
  ```

### 4. Hosted Deployment (Vercel + Neon)
Deploy two separate Vercel projects (or Preview vs. Production environments) pointing to two separate Neon branches:
* **Demo Deployment:** `ENABLE_DEMO_MODE="true"` + Neon `demo` branch.
* **Production Deployment:** `ENABLE_DEMO_MODE="false"` + Neon `production` branch.

### 5. Run Verification Checks
```powershell
npm run typecheck
npm test
npm run lint
```

---

## How to Navigate & Test the Section 5 Benchmark Demo

Ensure `ENABLE_DEMO_MODE="true"` in `.env` and start the app (`npm run dev`), then open `http://localhost:3000/login`:

1. **Load Benchmark Master Data:**
   * On `/login`, click **"Load / Reset Benchmark Data"** (confirm the dialog) to reset the DB cleanly to the exact Section 5 opening state (100 kg Flour @ ₹42, 30 L Oil @ ₹140, 5 kg Spice @ ₹200, 500 Pouches @ ₹2.50, 30 Cartons @ ₹15, 50 pkts Murukku 200 g, selling price ₹50 + 5% GST, TN factory).
   * Use the **Demo Access** buttons on `/login` (or sign out and switch roles anytime; demo password is `DEMO_USER_PASSWORD` or `DemoPass@123`).

2. **Step 1 — Record Flour Purchase (`Factory Admin`):**
   * Click **Factory Admin (Desktop)** $\rightarrow$ open **Purchases** (`/admin/purchases`) $\rightarrow$ click **+ Record Inward Purchase**.
   * Select Supplier, enter a Bill # and today's date, choose **Flour**, quantity `60` `KG`, rate `45`, GST `5` $\rightarrow$ save.
   * *(Optional GRN test: You can alternatively log a delivery as **Floor Supervisor** under **Goods Receipt (GRN)** `/production/receiving` and click **Verify & Bill GRN** under Admin Purchases.)*

3. **Steps 2, 3 & 8 — Run Murukku Batch with Variance & Overheads (`Floor Supervisor`):**
   * Sign out $\rightarrow$ click **Floor Supervisor** on `/login` $\rightarrow$ go to **New Batch Run** (`/production/new-run`).
   * Choose **Standard Murukku 200 g Recipe** (`batchMultiplier = 1`).
   * Set Actual Issued quantities: Flour `40` kg, Cooking Oil `10.5` L (observe live `+5.00%` red variance alert), Spice Mix `1.2` kg.
   * Enter Output & Scrap: Good Packets `188` (observe live `-6.00%` red yield alert), Damaged Pouches `6`, Cartons Used `9`.
   * Enter Overheads: Labour `1200`, Power/Gas `600`. Observe live **Total Batch Cost `₹5,810.00`**, **Cost/Packet `₹30.90`**, **Gross Margin `38.2%`**.
   * Click **Save & Commit Production Run**.

4. **Step 4 — Place Order for Retailer A (`Salesman A`):**
   * Sign out $\rightarrow$ click **Salesman A (Mobile)** $\rightarrow$ tap **New Order** (`/salesman/new-order`).
   * Select **Retailer A (Tamil Nadu)**, set **Murukku 200 g** to `150` `PACKET`, and submit.

5. **Step 5 — Approve, Raise GST Invoice & Dispatch (`Factory Admin`):**
   * Sign out $\rightarrow$ click **Factory Admin (Desktop)** $\rightarrow$ go to **Incoming Orders** (`/admin/orders`) $\rightarrow$ click **Verify & Process** on Retailer A's order.
   * Verify stock shows **238 PACKET available** (Sufficient) $\rightarrow$ click **Approve & Raise GST Invoice**.
   * Go to **Invoices & Dispatch** (`/admin/invoices`) $\rightarrow$ download the A4 **PDF** invoice (`₹7,500 + ₹187.50 CGST + ₹187.50 SGST = ₹7,875.00`), then click **Dispatch** $\rightarrow$ confirm dispatch (`150` packets) to deduct stock to **88 packets** and download the Delivery Challan PDF.

6. **Step 6 — Shortage Order & IGST Check (`Salesman B` $\rightarrow$ `Factory Admin`):**
   * Switch to **Salesman B (Interstate)** $\rightarrow$ submit an order for **Distributor B (Karnataka)** for `120` packets.
   * Switch to **Factory Admin** $\rightarrow$ **Incoming Orders** $\rightarrow$ **Verify & Process** Distributor B's order: observe the red alert **Shortage of 32 PACKET** (`88` available vs `120` ordered) and **5% IGST** preview $\rightarrow$ click **Place On Hold** (or check Production Planner on `/production` suggesting `1 batch`).

7. **Step 7 — Record Customer Payment (`Factory Admin`):**
   * Open **Payments** (`/admin/payments`) $\rightarrow$ click **+ Record Customer Payment** for **Retailer A** for `4000` (e.g. UPI) $\rightarrow$ save and verify Retailer A's outstanding balance becomes **`₹3,875.00`**. Download the Receipt Voucher PDF.

8. **Step 9 — Verify Reports & Executive Dashboard (`Auditor` & `Owner`):**
   * Switch to **Auditor (Read-Only)** $\rightarrow$ open **Report Center** (`/auditor`) and inspect **Sales Register**, **GST Summary**, **Purchase Register**, **Stock Ledger** (`Ledger Reconciled`), **Production Report**, **Receivables**, and **Audit Trail**; test Excel, CSV, PDF, and Tally XML downloads.
   * Switch to **Business Owner** (`/dashboard`) to view the executive pulse, unit economics (`₹30.90/pkt`), variance alerts, and `₹3,875.00` receivable balance.

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
| Distributor B order (KA `29`) | Shortage `32 pkts`; IGST applies | `32 packets` shortage flagged; `5% IGST` |
| Cost per packet (FIFO + Direct Overheads) | Stated method & rule | `₹5,810.00 / 188 = ₹30.90/pkt` (`38.20%` gross margin vs ₹50) |

---

## Documentation Index

* [docs/PS.md](docs/PS.md) — Original Problem Statement
* [docs/DESIGN_NOTE.md](docs/DESIGN_NOTE.md) — Executive 2-Page Design Note
* [docs/DATABASE.md](docs/DATABASE.md) — Relational Schema & Ledger Invariants
* [docs/BUSINESS_LOGIC.md](docs/BUSINESS_LOGIC.md) — FIFO, BOM Variance, Costing & GST Math
* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Multi-Tier Architecture & Stack Rationale
* [docs/SECURITY.md](docs/SECURITY.md) — OWASP Threat Model, RBAC Matrix & Hardening
* [docs/UI_UX_DESIGN.md](docs/UI_UX_DESIGN.md) — Warm Brand Theme, Dark Mode & Screen Specs
* [docs/PAGES_AND_FEATURES.md](docs/PAGES_AND_FEATURES.md) — Complete Route & Feature Map
