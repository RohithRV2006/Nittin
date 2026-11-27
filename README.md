# Nittin — Order-to-Audit ERP for Food Manufacturing

**Nittin ERP** is a production-ready, single-entry **Order-to-Audit ERP** purpose-built for packaged South Indian food manufacturers (**Nittin Foods Pvt. Ltd.** — murukku, mixture, chips, and traditional sweets). Every operational event is captured once at its source—on a field salesman's phone, at the factory gate, on the production floor, at the billing desk, or in the auditor's office—converging cleanly on an immutable **Stock Ledger** with **FIFO/FEFO** batch costing and GST compliance.

---

## The Story of Nittin ERP: One Loaf-to-Ledger Loop

Before seeing technical specs, picture a typical Tuesday at **Nittin Foods Pvt. Ltd.** in Tiruchirappalli, Tamil Nadu—and how each portal moves the business forward without spreadsheets or double-entry:

1. **Dawn at the Factory Gate (`Production Supervisor` — Varshan):**
   A truck arrives from *Cauvery Flour & Agro Mills* with 60 kg of Rice & Besan Flour. Varshan doesn't see supplier pricing or tax rates; he opens **1. Gate Receipt (GRN)** (`/production/receiving`) on his floor tablet, logs `60 kg` + challan `#` + batch expiry date, and saves `GRN/2026-27/0001` as `PENDING_BILLING`.
1. **Morning Billing Verification (`Factory Admin` — Samyuktha):**
   On her desktop **Command Center** (`/admin`), Samyuktha sees the pending gate delivery in the **Supply & Stock Flow** pipeline. She opens **Purchases & GRNs** (`/admin/purchases`), clicks **Verify & Bill GRN**, enters the vendor bill rate (`₹45/kg`, `5% GST`), and saves—atomically crediting a dated `StockBatch` and `StockLedger` row (`PURCHASE_RECEIPT`) while recording Input GST credit.
1. **Mid-Morning Kitchen Run (`Production Supervisor` — Varshan):**
   The Order Planner on `/production` warns that pending retailer/distributor demand exceeds the 50 finished packets in warehouse stock. Varshan opens **2. Batch Runs** (`/production/new-run`), selects *Standard Murukku 200 g Recipe*, and runs a batch:

   - Flour issues `40 kg` from the oldest opening lot (`₹42/kg` via FIFO, leaving the `₹45/kg` lot untouched for later).
   - Oil overshoots slightly (`10.5 L` vs `10.0 L` planned $\rightarrow$ **`+5.00%` alert**).
   - Actual good yield is `188` packets instead of `200` (`-6.00%` alert), with `6` damaged pouches (`SCRAP_DAMAGE`) and `9` outer cartons consumed.
   - Labour (`₹1,200`) + Power/Gas (`₹600`) bring total batch cost to `₹5,810.00`. Divided over `188` marketable packets = **`₹30.90 / packet`** (**`38.2%` margin** vs `₹50` selling price). Warehouse finished stock is now `50 + 188 = 238 packets`.
1. **Afternoon Field Sales (`Salesman A` — Raja & `Salesman B` — Karthik):**

   - **Raja** visits *Retailer A* in Thanjavur (Tamil Nadu, code `33`), opens `/salesman/new-order` on his mobile phone—even in low-signal basements where the app saves orders offline to IndexedDB with an idempotent UUID and auto-syncs on 3G/4G—and books **`150 packets`** (`₹7,500 + 2.5% CGST + 2.5% SGST = ₹7,875.00`).
   - **Karthik** visits *Distributor B* in Bengaluru (Karnataka, code `29`) and books **`120 packets`** (`5% IGST`).
1. **Order Approval, Dispatch & Collections (`Factory Admin` — Samyuktha):**

   - Samyuktha verifies *Retailer A*'s order (`238 available >= 150`), clicks **Approve & Raise GST Invoice**, opens **Invoices & Dispatch** (`/admin/invoices`), downloads the A4 GST Tax Invoice PDF, and dispatches `150` packets via a Delivery Challan PDF—dropping finished stock to `88 packets`.
   - When she inspects *Distributor B*'s order (`120` ordered vs `88` available), the system flags **`Shortage of 32 packets`**—so she puts it **`ON_HOLD`** until the next batch completes.
   - *Retailer A* transfers `₹4,000` via UPI; Samyuktha logs it under **Payment Collections** (`/admin/payments`), dropping open dues to **`₹3,875.00`**.
1. **Compliance & Executive Control Tower (`Auditor` — Sarathi CA & `Owner` — Rohith):**

   - **Sarathi CA** logs into the strictly read-only **Auditor Report Center** (`/auditor`), checks reconciled stock (`Opening + Inward - Outward = Closing`), GSTR-1/3B summaries, ageing buckets, and downloads Excel, PDF, and **Tally Prime XML** vouchers.
   - **Rohith (Business Owner)** opens the **Control Tower** (`/dashboard`, `/dashboard/reports`, `/dashboard/audit`, `/dashboard/team`) to monitor the live 5-stage operations pipeline, monthly/yearly Sales vs. Purchases trends, unit margins, expiry warnings, factory admin governance, and company-wide audit trails in 30 seconds.

---

## Tech Stack & Engineering Highlights

* **Full-Stack Framework:** **Next.js 15.5+ (App Router, Server Actions, TypeScript)** + **Tailwind CSS v4** + **PostgreSQL 16 (Neon Serverless / Docker Postgres)** with **Prisma ORM**. 
* Refer [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed explanation
* **Zero-Float Financial & Stock Math:** Server-side `decimal.js` / `Prisma.Decimal` (`Decimal(12, 2)` currency, `Decimal(12, 3)` quantities) inside atomic `prisma.$transaction` blocks with `SELECT ... FOR UPDATE` row-level locks on FIFO/FEFO batch deductions.
* **Resilient Workflow UX:**
    - Collapsible, loop-grouped sidebar (`AppShell`) + interactive `<WorkflowPipeline />` strips and `<SetupChecklist />` onboarding tracker across portals.
    - Sleek theme-aware custom scrollbars (`Light` warm ivory `#FAF6EE` / `Dark` espresso `#16100C`).
    - Offline-ready Salesman order queue (`IndexedDB` + `localStorage` fallback) with `navigator.onLine` navigation protection so offline users never hit failed route transitions.
    - Server error sanitization (`src/lib/errors.ts`) + global `error.tsx` so raw Prisma/SQL internals never reach users, paired with automatic transient Neon/DB retry (`withDbRetry`) and `ERR_TOO_MANY_REDIRECTS`-proof logout cleanup (`/api/auth/logout`).
* **Security & Governance Hierarchy:**
    - Top-level **`OWNER`** role bootstrapped strictly from environment variables (`BOOTSTRAP_OWNER_*`), managing **`FACTORY_ADMIN`** & **`AUDITOR`** accounts and **Company Legal/GST Profile** (`/dashboard/team`), with Owner password changes/resets disabled inside the UI/actions to prevent post-deployment lockouts.
    - `jose` HS256 JWT `HttpOnly` cookies at Edge Middleware + `React.cache`-deduplicated PostgreSQL `User.active` / `tokenVersion` checks, `bcryptjs` hashing, brute-force account lockout, sliding-window rate limiting, CWE-1236 spreadsheet sanitization, strict security headers + `poweredByHeader: false`, and `robots.txt` + `noindex` privacy across all authenticated portals.
* **Exports:** `jsPDF` + `jspdf-autotable` (A4 Tax Invoices, Delivery Challans, Credit Notes, Payment Receipts, Auditor PDFs with company logo), `xlsx` (Excel/CSV), **Tally Prime XML**, and **Mocked NIC e-Invoice (IRN/QR) & e-Way Bill JSON**.

---

## Governance & 5 Strict Portals

| Role                        | Portal Routes                                                                                        | Core Responsibilities                                                                                |
| :-------------------------- | :--------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **`OWNER`**                 | `/dashboard`, `/dashboard/reports`, `/dashboard/audit`, `/dashboard/team`                            | Executive overview, monthly/yearly visual analytics, company-wide audit trail, Company GST settings, and Factory Admin/Auditor lifecycle management. |
| **`FACTORY_ADMIN`**         | `/admin`, `/admin/orders`, `/admin/invoices`, `/admin/payments`, `/admin/purchases`, `/admin/adjustments`, `/admin/boms`, `/admin/masters` | Order approval/holds, GST invoicing, partial/full dispatch, sales returns & credit notes, GRN billing verification (raw/packaging only), customer/supplier payments, stock adjustments, read-only BOM view, and operational masters/staff. |
| **`PRODUCTION_SUPERVISOR`** | `/production`, `/production/receiving`, `/production/new-run`, `/production/boms`                    | Floor gate GRN intake (blind to vendor rates), BOM recipes & Clone/Scale builder, 1-step or 2-step batch runs with live ±3% variance & unit costing. |
| **`SALESMAN`**              | `/salesman`, `/salesman/new-order`, `/salesman/orders`                                               | Mobile-first sub-60s order booking (carton/packet conversion, customer pricing, offline IndexedDB auto-sync) & customer sales totals. |
| **`AUDITOR`**               | `/auditor`, `/auditor/sales-register`, `/auditor/gst-summary`, `/auditor/purchase-register`, `/auditor/stock-ledger`, `/auditor/production-report`, `/auditor/receivables`, `/auditor/audit-log` | Strictly read-only statutory registers, GSTR-1/3B breakdown, reconciled stock summary, debtor ageing, audit diff viewer, and Excel/CSV/PDF/Tally XML exports. |

---

## Setup & Deployment Guide

You have **3 ways** to view and evaluate **Nittin ERP**:
1. **Local Development (`npm run dev`):** Run locally in either **Production Mode** (`ENABLE_DEMO_MODE="false"`) or **Benchmark Demo Mode** (`ENABLE_DEMO_MODE="true"`).
2. **Docker Compose:** Spin up the full app + PostgreSQL container in one command (Demo or Production).
3. **Hosted Evaluation Link:** Open our already-deployed Demo site directly in your browser (no setup required).

> **Important:** Always connect **Demo** and **Production** to **separate PostgreSQL databases** (e.g., separate Neon branches). Never run Demo seed/reset against your Production database.

### 1. Environment Variables

```powershell
cp .env.example .env
```

Configure at minimum:

* `DATABASE_URL` — PostgreSQL connection string (Neon `sslmode=require` or local Postgres)
* `SESSION_SECRET` — Random secret (32+ characters)
* `ENABLE_DEMO_MODE` — `"false"` for Production, `"true"` for Demo/Evaluation
* `BOOTSTRAP_OWNER_EMAIL`, `BOOTSTRAP_OWNER_PASSWORD`, `BOOTSTRAP_OWNER_NAME` — Required to bootstrap the top-level **Owner** account (`npm run db:setup:prod`). Optionally set `BOOTSTRAP_ADMIN_*` to also pre-create an initial Factory Admin.

### 2. Local Setup: Production vs. Benchmark Demo

* **Option A — Clean Production Setup (Local):**

  ```powershell
  npm install
  # Keep ENABLE_DEMO_MODE="false" in .env
  npm run db:setup:prod
  npm run dev
  ```

  *Seeds zero dummy transactions—only creates the top-level Owner (and optional Admin) so you can configure GST profile, Factory Admins, Items, Suppliers, and Customers cleanly.*
* **Option B — Benchmark Demo Setup (Local Evaluation):**

  ```powershell
  npm install
  # Set ENABLE_DEMO_MODE="true" in .env pointing to your isolated Demo DB
  npm run db:setup:demo
  npm run dev
  ```

  *Seeds the complete Section 5 dataset—including realistic shelf-life `expiryDate` lots and a settled opening supplier bill (`PUR/2026-27/0000` / `GRN/2026-27/0000` via `Cauvery Flour & Agro Mills`) so Purchase Register, Input GST, Expiry Watchlist, and Stock Ledger are realistic from second zero.*

  *To wipe and replay the Demo DB anytime during testing, click **"Load / Reset Benchmark Data"** on `/login` (when `ENABLE_DEMO_MODE="true"`) or re-run `npm run db:seed:demo`.*

### 3. Single-Command Docker Compose (Turnkey Demo & Prod)

* **Demo Mode (Auto-seeds isolated `nittin_erp_demo` PostgreSQL container):**

  ```powershell
  docker compose -f docker-compose.yml -f docker-compose.demo.yml up --build
  ```
* **Production Mode (`ENABLE_DEMO_MODE=false`, bootstraps Owner into `nittin_erp` DB):**

  ```powershell
  docker compose up --build
  ```

### 4. Hosted Deployment & Live Evaluation (Vercel + Neon)

* **Live Demo (For Evaluation Purposes):** https://nittin-erp-demo.vercel.app/
  *(Runs in `ENABLE_DEMO_MODE="true"` against an isolated Neon `demo` branch with 1-click role login and **Load / Reset Benchmark Data**.)*
* **Walkthrough Video:** [Watch Demo Walkthrough Video](https://drive.google.com/file/d/11BdKzDKVko4Zyf2q7pPK5EJmNh7ziym1/view?usp=drive_link)

### 5. Automated Verification Suite

```powershell
npx prisma validate
npm run typecheck
npm test
npm run lint
npm run build
```

---

## Step-by-Step Benchmark Testing Guide (`Section 5`)

Ensure `ENABLE_DEMO_MODE="true"`, start the app (`npm run dev`), and open `http://localhost:3000/login`:

1. **Reset to Clean Opening Benchmark State:**

   * On `/login`, click **"Load / Reset Benchmark Data"** and confirm.
   * Opening lots created cleanly:
       - **Raw & Packaging (via `PUR/2026-27/0000` & `GRN/2026-27/0000` from *Cauvery Flour & Agro Mills*):** 100 kg Flour @ ₹42 (`+90d` expiry), 30 L Cooking Oil @ ₹140 (`+180d` expiry), 5 kg Spice Mix @ ₹200 (`+240d` expiry), 500 Pouches @ ₹2.50, 30 Cartons @ ₹15.
       - **Finished Goods (`OPENING_BALANCE`):** 50 pkts *Murukku 200 g* (`BATCH-OPEN-MURUKKU`, `+45d` expiry, selling price ₹50 + 5% GST).
       - **Demo Password:** `DemoPass@123` (or `DEMO_USER_PASSWORD`), with 1-click role switcher buttons on `/login`.
1. **Step 1 — Inward Flour Purchase (`Factory Admin`):**

   * Sign in as **Factory Admin** $\rightarrow$ open **Purchases & GRNs** (`/admin/purchases`) $\rightarrow$ click **+ Record Inward Purchase** (note: finished goods are excluded from procurement).
   * Select *Cauvery Flour & Agro Mills*, enter Bill # & date, choose **Rice & Besan Flour**, Qty `60` `KG`, Rate `45`, GST `5%`, optional expiry date $\rightarrow$ save.
   * *(Alternatively, test the 2-step gate flow by logging a delivery as Floor Supervisor under `/production/receiving` first and clicking **Verify & Bill GRN** in `/admin/purchases`.)*
1. **Steps 2, 3 & 8 — Run Murukku Batch with Variance & Overheads (`Floor Supervisor`):**

   * Switch to **Production Supervisor** $\rightarrow$ open **2. Batch Runs** (`/production/new-run`).
   * Select *Standard Murukku 200 g Recipe* (`Multiplier = 1`).
   * Enter Actual Issued: Flour `40` kg, Cooking Oil `10.5` L (observe **`+5.00%`** variance alert), Spice Mix `1.2` kg.
   * Enter Output & Scrap: Good Packets `188` (observe **`-6.00%`** yield alert), Damaged Pouches `6`, Cartons Used `9`.
   * Enter Overheads: Labour `1200`, Power/Gas `600`.
   * Verify live preview shows **Total Batch Cost `₹5,810.00`**, **Cost/Packet `₹30.90`**, **Gross Margin `38.2%`** $\rightarrow$ **Save & Commit Production Run**.
1. **Step 4 — Field Order Booking & Offline Queue Check (`Salesman A`):**

   * Switch to **Salesman A (Mobile)** $\rightarrow$ tap **1. New Field Order** (`/salesman/new-order`).
   * *(Optional Offline Check: toggle Chrome DevTools Network to `Offline`, submit an order, confirm it saves to the offline banner queue right on `/salesman/new-order` without losing the page, then switch back to `Online` to watch it auto-sync idempotently.)*
   * Select **Retailer A (Tamil Nadu — `33`)**, set *Murukku 200 g* to `150` `PACKET`, and submit.
1. **Step 5 — Order Verification, GST Invoicing & Dispatch (`Factory Admin`):**

   * Switch to **Factory Admin** $\rightarrow$ **1. Incoming Orders** (`/admin/orders`) $\rightarrow$ **Verify & Process** Retailer A's order.
   * Confirm warehouse shows **`238 PACKET available`** (Sufficient) $\rightarrow$ click **Approve & Raise GST Invoice**, then click **"Open Dispatch →"** in the toast (or open `/admin/invoices`).
   * Download the A4 Tax Invoice PDF (`₹7,500 + ₹187.50 CGST + ₹187.50 SGST = ₹7,875.00`), click **Dispatch** (`150` pkts) to reduce warehouse stock to **`88 packets`**, and download the Delivery Challan PDF.
1. **Step 6 — Shortage Hold & Inter-State IGST (`Salesman B` $\rightarrow$ `Factory Admin`):**

   * Switch to **Salesman B (Interstate)** $\rightarrow$ submit an order for **Distributor B (Karnataka — `29`)** for `120` `PACKET`.
   * Switch to **Factory Admin** $\rightarrow$ **Verify & Process** Distributor B's order: confirm red alert **`Shortage of 32 PACKET`** (`88` available vs `120` ordered) and **`5% IGST`** preview (`₹300.00`) $\rightarrow$ click **Place On Hold**. *(Checking `/production` now recommends **1 batch** to cover the `32`-packet deficit.)*
1. **Step 7 — Payment Collection (`Factory Admin`):**

   * Open **3. Payment Collections** (`/admin/payments`) $\rightarrow$ **+ Record Customer Payment** for **Retailer A** for `4000` (UPI) $\rightarrow$ save.
   * Confirm Retailer A's open balance updates to **`₹3,875.00`** and download the Payment Receipt Voucher PDF.
1. **Step 9 — Audit Verification & Owner Analytics (`Auditor` & `Owner`):**

   * Switch to **Auditor (Read-Only)** (`/auditor`) $\rightarrow$ inspect **Sales Register**, **GST Summary**, **Purchase Register**, **Stock Ledger** (`Ledger Reconciled`), **Production Report**, **Receivables**, and **Audit Trail**; test `.xlsx`, `.csv`, `.pdf`, and **Tally XML** exports.
   * Switch to **Business Owner** (`/dashboard`) $\rightarrow$ inspect the Executive Control Tower, open **Analytics & Reports** (`/dashboard/reports`) for Monthly/Yearly charts & stock valuation splits, and review **Audit Trail** (`/dashboard/audit`).

---

## Section 5 Benchmark Verification Summary

| Check                                     | Expected (`docs/PS.md`)                         | Verified Engine Output                                        |
| :---------------------------------------- | :---------------------------------------------- | :------------------------------------------------------------ |
| Flour closing balance                     | `120 kg` (`100 + 60 - 40`)                      | `120.000 kg` (FIFO: 60 kg @ ₹42 + 60 kg @ ₹45)                |
| Cooking oil closing balance               | `19.5 L`                                        | `19.500 L`                                                    |
| 200 g pouches closing                     | `306` (`188 + 6` damaged)                       | `306 pieces` (`PRODUCTION_ISSUE` `-188`, `SCRAP_DAMAGE` `-6`) |
| Finished goods post-run / post-dispatch   | `238` $\rightarrow$ `88 pkts`                   | `238` $\rightarrow$ `88 packets`                              |
| Yield & Oil variances                     | `-6%` & `+5%` flagged                           | `-6.00%` (Flagged), `+5.00%` (Flagged) at $\pm 3\%$           |
| Retailer A invoice (TN `33`)              | `₹7,500 + ₹187.50 CGST + ₹187.50 SGST = ₹7,875` | `₹7,875.00`                                                   |
| Retailer A outstanding                    | `₹3,875`                                        | `₹3,875.00`                                                   |
| Distributor B order (KA `29`)             | Shortage `32 pkts`; IGST applies                | `32 packets` shortage flagged; `5% IGST`                      |
| Cost per packet (FIFO + Direct Overheads) | Stated method & rule                            | `₹5,810.00 / 188 = ₹30.90/pkt` (`38.20%` gross margin vs ₹50) |

---

## Known Boundaries (Non-Benchmark / Future Extensions)

* **External Govt APIs:** NIC e-Invoice (IRN/QR) & e-Way Bill payloads are deterministic compliant JSON mocks rather than live GSTN/GSP API calls.
* **Deferred Stretch Modules:** GPS salesman check-in tracking, Tamil floor localization, Supplier Debit Notes (Purchase Returns), and multi-factory tenant isolation are scoped for v2.

---

## Documentation Index

* [docs/PS.md](docs/PS.md) — Original Problem Statement
* [docs/DESIGN_NOTE.md](docs/DESIGN_NOTE.md) — Executive Design Note
* [docs/DATABASE.md](docs/DATABASE.md) — Relational Schema, Indexes & Ledger Invariants
* [docs/BUSINESS_LOGIC.md](docs/BUSINESS_LOGIC.md) — FIFO/FEFO, BOM Variance, Costing & GST Math
* [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Multi-Tier Architecture & Stack Rationale
* [docs/SECURITY.md](docs/SECURITY.md) — OWASP Threat Model, RBAC Matrix & Hardening
* [docs/UI_UX_DESIGN.md](docs/UI_UX_DESIGN.md) — Theme System, Collapsible Shell & Screen Specs
* [docs/PAGES_AND_FEATURES.md](docs/PAGES_AND_FEATURES.md) — Complete Route & Feature Map