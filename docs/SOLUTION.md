# Solution Overview: Order-to-Audit ERP

## 1. Executive Summary

This project delivers an enterprise-grade, role-based **Order-to-Audit ERP** designed for a small-scale South Indian packaged food manufacturer (e.g., murukku, mixture, chips, and sweets) located in Tamil Nadu. The solution unifies field sales, factory billing, recipe-based production, and statutory audit compliance into a single source of truth.

Every transaction is captured once at its origin and flows automatically through inventory, costing, and general accounts without requiring external accounting software for day-to-day operations.

---

## 2. Problem Statement Brief

Traditional small food manufacturers operate with severe operational friction:
* **Disconnected Sales:** Salesmen phone or WhatsApp orders from the field; factory admins re-type them manually, causing transcription errors.
* **Blind Inventory:** Invoicing happens in one software, stock is logged in physical notebooks or disconnected spreadsheets, and production is recorded on paper.
* **Invisible Wastage:** Raw material issuance is not tracked against standard recipes (BOMs), making it impossible to identify whether ingredient over-consumption or batch yield loss is eroding profit margins.
* **Painful Month-End Auditing:** Reconciling sales, stock movements, GST liabilities, and pending customer dues requires days of manual data entry, frequently exposing discrepancies between physical stock and book values.

---

## 3. The Core Solution: Dual-Loop Integration

The core architecture directly links two operational loops that converge on **Finished Goods Stock** and feed statutory **Audit Reports**:

```
[SALES LOOP]
Salesman Field Order (Mobile)
   │
   ▼
Admin Stock Verification
   │
   ▼
GST Tax Invoice Generated (CGST/SGST or IGST)
   │
   ▼
Warehouse Dispatch ──(Finished Goods Stock Decrements)──┐
   │                                                   │
   ▼                                                   ▼
Accounts Receivable & Payments                  [FINISHED GOODS]
                                                [ INVENTORY POOL]
[PRODUCTION LOOP]                                      ▲
Raw Materials Inward Purchase                          │
   │                                                   │
   ▼                                                   │
Raw Stock Issued per Recipe (BOM)                      │
   │                                                   │
   ▼                                                   │
Daily Production Run (Planned vs. Actual)               │
   │                                                   │
   ▼                                                   │
Output & Scrap Recorded ──(Finished Goods Stock Increments)─┘
   │
   ▼
Overhead Costing (Unit Cost per Packet)
```

---

## 4. Key Architectural Highlights

1. **Immutable Double-Entry Stock Ledger:** Inventory balances are never overwritten. Every movement is an immutable row in `StockLedger` backed by FIFO/FEFO `StockBatch` lots and linked to a source document (`Purchase`, `ProductionRun`, `Invoice`, `CreditNote`, or `Adjustment`).
2. **Zero Floating-Point Drift:** Monetary values and quantities use `decimal.js` / `Prisma.Decimal` on the server backed by PostgreSQL `Decimal(12, 2)` / `Decimal(12, 3)`.
3. **Dynamic & Scalable (Zero Hardcoding):** Products, pack sizes, unit conversions (`kg`/`g`/`L`/`ml`/`piece`/`packet`/`carton`), BOMs, tax rules, and company settings are dynamic database records. The Section 5 benchmark data is loaded via `npx prisma db seed`.
4. **$0 Operating Cost & Local Docker Support:** Cloud-deployable on **Vercel** + **Neon Serverless PostgreSQL** ($0 free tier) and runnable locally with one command via **Docker Compose**.
5. **Role-Based Isolation (RBAC):** Dedicated views tailored for Salesman (mobile phone), Factory Admin (desktop), Production Supervisor (floor tablet), Auditor (read-only export), and Business Owner (KPI dashboard).

---

## 5. Scope & Feature Classification

| Tier | Module | Key Features |
| :--- | :--- | :--- |
| **Must-Have** | **Authentication & RBAC** | Role-based navigation for Salesman, Admin, Production, Auditor, and Owner. |
| | **Masters** | Customers (TN/Interstate), Suppliers, Items (Raw/Pack/Finished), Unit Conversions, BOM Recipes. |
| | **Sales Loop** | Mobile order taking, stock sufficiency validation, GST tax invoice, PDF download. |
| | **Production Loop**| BOM issuance, run logging, planned vs actual consumption & yield, variance flags. |
| | **Inventory** | Append-only Stock Ledger, real-time stock summary with source traceability. |
| | **Audit Reports** | Sales register, Purchase register, Production report, GST summary, Stock summary/ledger, Receivables/collections, exportable to Excel/CSV & PDF. |
| **Should-Have** | **Procurement** | Raw material purchases and supplier bills with batch/expiry capture. |
| | **Receivables** | Payment collection entry, invoice settlement, and aging debtor reports. |
| | **Costing** | FIFO material valuation, direct overhead absorption (Labour + Power/Gas), cost per packet. |
| | **Compliance** | GSTR-1 / GSTR-3B outward supply summary, tolerance alerts ($\pm 3\%$), `AuditLog` edit tracking. |
| | **Executive View** | Owner dashboard with real-time stock, daily orders, and margin metrics. |
| **Stretch Goals** | **Offline Sync** | LocalStorage/IndexedDB order caching with idempotent `clientRequestId` sync. |
| | **Batch & Expiry** | `StockBatch` lot & expiry tracking with FEFO dispatch prioritization. |
| | **Production Planner** | Recommended batch runs calculated from pending orders vs. finished stock. |
| | **WhatsApp Share** | Deep link sharing of invoice PDFs directly to customer WhatsApp numbers. |
| | **Tally Export** | Tally Prime XML & Excel voucher export (Sales, Purchase, Receipt + GST ledgers). |
| | **e-Invoice / e-Way** | Mocked NIC IRN / Signed QR & e-Way Bill JSON export per GST invoice. |
| | **Reversals** | Auditable credit notes (restocking only if dispatched) and stock adjustments. |

---

## 6. Documentation Suite Navigation

* [**`docs/PRD.md`**](file:///c:/rohith/ZProjects/Nittin/docs/PRD.md): Complete Product Requirements Document covering user personas, functional epics, and non-functional requirements.
* [**`docs/PAGES_AND_FEATURES.md`**](file:///c:/rohith/ZProjects/Nittin/docs/PAGES_AND_FEATURES.md): Detailed web pages, routes, and feature implementation specifications across every user role and screen.
* [**`docs/ARCHITECTURE.md`**](file:///c:/rohith/ZProjects/Nittin/docs/ARCHITECTURE.md): Multi-tier architecture, C4 container diagrams, tech stack justifications, and deployment topology.
* [**`docs/DESIGN.md`**](file:///c:/rohith/ZProjects/Nittin/docs/DESIGN.md): Comprehensive visual design suite including business architecture, user stories, sequence diagrams, component diagrams, and UML state machines.
* [**`docs/DATABASE.md`**](file:///c:/rohith/ZProjects/Nittin/docs/DATABASE.md): Relational schema, Prisma DDL, ER diagrams, data dictionary, indexing, and stock ledger mechanics.
* [**`docs/BUSINESS_LOGIC.md`**](file:///c:/rohith/ZProjects/Nittin/docs/BUSINESS_LOGIC.md): Exact mathematical formulations: FIFO inventory valuation, GST tax calculations, BOM variance algorithms, and Section 5 benchmark proof.
* [**`docs/SECURITY.md`**](file:///c:/rohith/ZProjects/Nittin/docs/SECURITY.md): Enterprise security framework covering Zod validation, SQL injection immunity, session cookies, and audit trails.
* [**`docs/DESIGN_NOTE.md`**](file:///c:/rohith/ZProjects/Nittin/docs/DESIGN_NOTE.md): Deliverable #3 — the official 2-page executive design note for submission.
