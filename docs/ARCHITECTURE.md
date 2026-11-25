# System Architecture Specification

## 1. Executive Summary & Architectural Tenets
The Order-to-Audit ERP is an enterprise-grade, single-entry web platform designed for small-scale food manufacturing. The architecture resolves the traditional operational chasm between field sales, warehouse invoicing, recipe-based floor production, and statutory audit compliance.

### Core Architectural Tenets:
1. **Source-Level Single Entry:** Data is captured exclusively where the event occurs (e.g., salesman phone, factory weighing scale, billing desk).
2. **Immutable Inventory as a Ledger:** Inventory balances are never edited as bare numbers. All stock levels are derived from an append-only ledger of signed movements.
3. **Strict Decimal Arithmetic:** Currency and quantity computations use `decimal.js` / `Prisma.Decimal` on the server backed by PostgreSQL `Decimal(12, 2)` / `Decimal(12, 3)` to eliminate floating-point rounding drift.
4. **Zero-Hardcoding & Agility:** Business entities (products, BOM recipes, unit conversions, tax slabs, customer classifications, tolerance thresholds, company settings) are fully dynamic database entities.
5. **Zero-Cost & Local Deployability ($0):** Architecture runs 100% within free-tier serverless limits (Next.js on Vercel + PostgreSQL on Neon) **and** includes a single-command local `docker-compose.yml` setup (Next.js + PostgreSQL 16).

---

## 2. High-Level Multi-Tier Architecture

```mermaid
flowchart TD
    subgraph PresentationLayer ["Tier 1: Role-Optimized Presentation Layer"]
        SalesDevice["📱 Salesman Mobile PWA\n(High-Contrast, Touch-Optimized, Offline-Ready)"]
        AdminDevice["💻 Factory Admin Desktop\n(Data-Dense Orders, GST Invoicing, Dispatch Desk)"]
        SupervisorDevice["📟 Floor Supervisor Tablet\n(BOM Lookup, Run Logging, Variance Alerts)"]
        AuditorDevice["📊 Auditor Read-Only Portal\n(GSTR-1, Stock Ledgers, CSV/Excel Exports)"]
        OwnerDevice["📈 Owner KPI Dashboard\n(Real-time Stock, Variance Warnings, Margins)"]
    end

    subgraph EdgeLayer ["Tier 2: Edge Routing & Security (Vercel Edge Network)"]
        EdgeRouter["Vercel Global Edge Router"]
        EdgeAuth["Edge Middleware (Route Guarding & Session Check)"]
        StaticAssets["Static Asset CDN (Next.js Bundles, Tailwind CSS)"]
    end

    subgraph ApplicationLayer ["Tier 3: Full-Stack Application Layer (Next.js 14 App Router)"]
        subgraph ServerActions ["Server Actions & API Handlers"]
            OrderActions["order.actions.ts"]
            BillingActions["billing.actions.ts"]
            ProductionActions["production.actions.ts"]
            ReportActions["report.actions.ts"]
        end

        subgraph DomainEngines ["Domain Business Logic Engines"]
            StockEngine["StockLedgerEngine (FIFO Batches, Movements, Reconciliation)"]
            UnitEngine["UnitConversionEngine (kg/g, L/ml, Carton/Packet)"]
            TaxEngine["TaxEngine (Place of Supply, CGST/SGST/IGST Splitting)"]
            BOMEngine["BOMVarianceEngine (Consumption, Yield, ±3% Tolerance)"]
            CostingEngine["CostingEngine (Direct Labour, Power/Gas, Cost/Packet)"]
            AuditEngine["AuditEngine (Immutable Edit & Cancellation Trail)"]
            ExportEngine["ExportEngine (PDF, CSV/XLSX Sanitized, Tally XML, Mock IRN/e-Way JSON)"]
        end

        ZodValidator["Zod Schema Validation & Sanitization"]
        PrismaClient["Prisma ORM Client ($transaction Orchestration)"]
    end

    subgraph DataLayer ["Tier 4: Relational Persistence Layer (Neon PostgreSQL)"]
        ConnectionPooler["PgBouncer Serverless Connection Pooler"]
        PostgresDB[("PostgreSQL 16 Instance\n(ACID Compliant, Strict Foreign Keys)")]
        subgraph TablesGroup ["Key Relational Tables"]
            MasterTables[("Item, BOM, Customer, Supplier")]
            TransactionTables[("Order, Invoice, ProductionRun, Payment")]
            LedgerTable[("StockLedger (Immutable Audit Records)")]
        end
    end

    SalesDevice & AdminDevice & SupervisorDevice & AuditorDevice & OwnerDevice --> EdgeRouter
    EdgeRouter --> EdgeAuth
    EdgeAuth --> StaticAssets
    EdgeAuth --> ServerActions

    ServerActions --> ZodValidator
    ZodValidator --> DomainEngines
    DomainEngines --> PrismaClient
    PrismaClient --> ConnectionPooler
    ConnectionPooler --> PostgresDB
    PostgresDB --- MasterTables & TransactionTables & LedgerTable
```

---

## 3. C4 Model: Container Architecture

```mermaid
C4Container
    title Container Diagram for Order-to-Audit ERP

    Person(salesman, "Salesman", "Field representative booking orders on smartphone.")
    Person(admin, "Factory Admin", "Billing lead verifying orders and raising GST tax invoices.")
    Person(supervisor, "Floor Supervisor", "Logs daily production runs and raw material usage.")
    Person(auditor, "Auditor / Accountant", "Inspects ledgers and exports statutory reports.")
    Person(owner, "Business Owner", "Monitors factory health, yields, and profit margins.")

    System_Boundary(c1, "Order-to-Audit ERP System") {
        Container(spa, "Next.js Web Application", "React, TypeScript, Tailwind CSS", "Delivers role-specific interfaces across mobile and desktop devices.")
        Container(server, "Next.js Server Runtime", "Node.js Serverless Functions", "Handles server actions, input validation, and business logic execution.")
        ContainerDb(db, "Relational Database", "Neon PostgreSQL 16", "Stores master records, transactional documents, and immutable stock ledger.")
    }

    Rel(salesman, spa, "Enters orders using", "HTTPS/WSS")
    Rel(admin, spa, "Approves orders, creates invoices using", "HTTPS")
    Rel(supervisor, spa, "Logs recipe runs and scrap using", "HTTPS")
    Rel(auditor, spa, "Views ledgers and downloads CSVs using", "HTTPS")
    Rel(owner, spa, "Inspects executive KPIs using", "HTTPS")

    Rel(spa, server, "Invokes Server Actions via", "RPC / HTTPS")
    Rel(server, db, "Executes parameterized queries and atomic transactions via", "Prisma ORM / TCP SSL")
```

---

## 4. Technical Stack Rationale & Cost Matrix

| Layer | Selected Technology | Technical Rationale | Operational Cost |
| :--- | :--- | :--- | :--- |
| **Frontend & Backend** | **Next.js 14+ (App Router, TypeScript)** | Unifies API and UI in a single repository. Server Actions provide type-safe, direct RPC without manual REST/GraphQL boilerplate. Server-side rendering ensures instant page loads. | **$0** (Free Tier on Vercel) |
| **Styling & Icons** | **Tailwind CSS + Lucide Icons** | Utility-first CSS creates clean enterprise UI with zero runtime CSS overhead. Highly responsive layout switches smoothly between mobile phones and multi-column desktop tables. | **$0** (Open Source) |
| **ORM & Migrations** | **Prisma ORM** | Type-safe schema definition with automated migration tracking. Built-in `$transaction` guarantees multi-table ACID atomicity when committing ledger debits. | **$0** (Open Source) |
| **Database** | **Neon Serverless PostgreSQL** | Production-grade PostgreSQL 16 with native connection pooling (`pgBouncer`). Auto-scales compute and isolates tenant storage. Free tier includes 0.5 GB storage (< 5 MB required for demo). | **$0** (Free Tier) |
| **Document Export** | **jsPDF & SheetJS (xlsx)** | Client/server generation of GST-compliant PDF tax invoices and Excel/CSV spreadsheets for tax auditors. | **$0** (Open Source) |
| **Hosting Platform** | **Vercel** | Global edge serverless hosting with continuous deployment from GitHub. Provides zero-configuration SSL certificates and instant public URL generation for evaluation. | **$0** (Hobby Plan) |

---

## 5. Scalability & Zero-Hardcoding Principles

To ensure production agility and prevent brittle code, all business entities are completely dynamic:
1. **Dynamic Master Catalog:** Products, packaging materials, and raw ingredients are rows in `Item`. No item codes or product names exist in application code.
2. **Configurable Bill of Materials (BOM):** Recipes support multi-ingredient and multi-packaging specifications with configurable yield ratios and individual tolerance thresholds (`BOM.tolerancePercent`).
3. **Pluggable Tax Rules:** Place of supply tax determination inspects `Customer.stateCode` vs. factory origin (`33` for Tamil Nadu). If matching, system splits `Item.taxRate` into equal CGST and SGST shares; if differing, charges full rate as IGST.
4. **Reproducible Benchmark Automation & Automated Test Suite:** All Section 5 benchmark data is isolated in `prisma/seed.ts` (`npx prisma db seed`). Automated Vitest unit & integration suites verify Decimal/GST math, unit conversion, FIFO concurrency, RBAC/IDOR rules, Credit Note restock logic, and the full 9-step Section 5 benchmark.
5. **Health & Observability:** `/api/health` validates database connectivity and ledger reconciliation invariants in real time.
