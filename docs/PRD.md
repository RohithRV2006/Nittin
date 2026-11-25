# Product Requirements Document (PRD): NITTIN, Order-to-Audit ERP

## 1. Document Control & Overview

* **Product Name:** **Nittin**, an Order-to-Audit ERP for Packaged Food Manufacturing
* **Domain:** Small-Scale Food Manufacturing (Tamil Nadu, India)
* **Target Users:** Field Salesmen, Factory Admin, Production Supervisor, External Auditor, Business Owner
* **Version:** 1.0.0
* **Status:** Ready for Engineering Execution

---

## 2. Product Vision & Goals

### 2.1 Vision

To eliminate paper-based coordination, unrecorded production waste, and month-end reconciliation chaos for small-scale food manufacturers by providing an integrated, single-entry web platform that seamlessly tracks orders from field capture to final statutory audit.

### 2.2 Primary Objectives

1. **Single Entry at Source:** Orders, purchases, and daily batch production are recorded once at the point of activity.
2. **Recipe-Driven Production Control:** Automatic comparison of actual raw material consumption and product yield against standard Bill of Materials (BOM), immediately highlighting wastage.
3. **Double-Entry Inventory Ledger:** Eliminate manual stock overwriting. All stock balances are derived strictly from verifiable transaction receipts and debits.
4. **Instant Statutory Invoicing & Audit:** Generate compliant GST tax invoices (CGST/SGST/IGST) with zero re-entry and provide 1-click auditor reports for monthly returns (GSTR-1, stock ledgers, aging debtors).

---

## 3. User Personas & Context

| Persona                               | Role                                        | Primary Device & Operating Environment                                             | Core Needs & Pain Points                                                                             |
| :------------------------------------ | :------------------------------------------ | :--------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **Raja (Salesman)**                | Field Sales Representative                  | Smartphone (Android), intermittent 3G/4G network, noisy retail market environments | Fast order entry (< 1 min per retailer), clear catalog prices, order status tracking, offline resilience. |
| **Samyuktha (Factory Admin)**           | Invoicing Desk & Billing Lead               | Desktop PC (Chrome/Firefox), stable office broadband                               | Instant view of incoming field orders, automated finished stock verification, 1-click GST invoice generation, payment logging. |
| **Varshan (Production Supervisor)**   | Floor Supervisor                            | Ruggedized tablet or floor desktop, dusty factory floor environment                | Standard BOM recipe lookup, logging raw material issues, recording daily finished packets, damaged packaging scrap, and variance alerts. |
| **Sarathi (Auditor / Accountant)** | External Chartered Accountant / Tax Auditor | Laptop / Desktop, office environment                                               | Read-only access to sales register, purchase ledger, stock valuation, GST outward supplies, and Excel/CSV exports. |
| **Rohith (Business Owner)**        | Factory Owner / Managing Partner            | Mobile phone or laptop on the move                                                 | Executive dashboard showing daily sales revenue, stock levels, batch variance warnings, cost per packet, and pending customer dues. |

---

## 4. Functional Requirements (Epics)

### Epic 1: Field Order Capture (Salesman)

* **FR-1.1 Mobile-First Order Interface:** Optimized responsive UI allowing salesmen to select a customer (retailer/distributor), add item quantities, and submit in under 60 seconds.
* **FR-1.2 Customer Price Catalog:** Prices automatically pulled from master product catalog; allows custom distributor rates if configured.
* **FR-1.3 Real-time Order Submission:** Orders post directly to factory queue without requiring WhatsApp messages or phone calls.
* **FR-1.4 Order Status Visibility:** Salesman can view the lifecycle status of submitted orders (`SUBMITTED` $\rightarrow$ `APPROVED` $\rightarrow$ `INVOICED` $\rightarrow$ `DISPATCHED`).
* **FR-1.5 Customer-wise Sales History:** Salesman can view their own historical bookings per customer.

### Epic 2: Order Verification, Stock Checks & GST Invoicing (Admin)

* **FR-2.1 Verification Queue:** Factory admin receives incoming orders with ability to edit quantities or approve/reject.
* **FR-2.2 Stock Sufficiency Validation:** Before approval, system checks real-time finished goods stock. If available stock < ordered quantity, a warning is displayed highlighting the exact deficit (e.g., "Shortage of 32 packets").
* **FR-2.3 GST Tax Invoice Generation:**
    - Auto-generates sequential invoice numbers formatted by Financial Year (e.g., `INV/2024-25/0001`).
    - Determines Place of Supply: Intra-state (Tamil Nadu $\rightarrow$ 2.5% CGST + 2.5% SGST) vs. Inter-state (e.g., Karnataka $\rightarrow$ 5% IGST).
    - Includes customer GSTIN, HSN codes, and taxable values.
* **FR-2.4 PDF Export & Sharing:** Downloadable PDF invoice formatted for A4 printing and direct WhatsApp share link (`https://wa.me/?text=...`).
* **FR-2.5 Dispatch & Stock Deduction:** Marking an order dispatched automatically decrements finished-goods inventory in the `StockLedger`.
* **FR-2.6 Payment Logging & Receivables:** Admin records customer payments (Cash, UPI, Bank Transfer) against invoices to maintain live outstanding balances.

### Epic 3: Bill of Materials (BOM) & Production Run (Production)

* **FR-3.1 Standard Recipe Master (BOM):** Defines standard raw material and packaging quantities required per batch and expected packet yield (e.g., 200 packets for Murukku 200g).
* **FR-3.2 Production Run Entry:** Supervisor logs:
    - Product and batch run date.
    - Actual raw materials issued (e.g., 40 kg flour, 10.5 L oil, 1.2 kg spices).
    - Packaging materials used and damaged/scrap pouches (e.g., 188 good packets, 6 damaged pouches, 9 cartons).
* **FR-3.3 Automatic Stock Updates:** Saving a run automatically decrements raw/packaging inventory and increments finished goods in the `StockLedger`.
* **FR-3.4 Variance Engine & Alerts:**
    - Computes Yield Variance: $\frac{\text{Actual} - \text{Expected}}{\text{Expected}} \times 100$.
    - Computes Material Consumption Variance per ingredient.
    - Flags visual warnings if variance exceeds configured tolerance (default $\pm 3\%$).

### Epic 4: Stock Movement Ledger (Inventory)

* **FR-4.1 Append-Only Movement Table:** No direct column editing. Every transaction generates a signed record ($\Delta Q$) in `StockLedger`.
* **FR-4.2 Running Closing Balance:** Maintain running balances for Raw Materials, Packaging Materials, and Finished Goods.
* **FR-4.3 Source Traceability:** Every movement links to its originating document (`PURCHASE`, `PRODUCTION_RUN`, `DISPATCH_SALE`, `SCRAP_DAMAGE`, `ADJUSTMENT`).
* **FR-4.4 Error Rectification via Compensating Entries:** Edits to posted records are prohibited; corrections require an explicit Stock Adjustment with a documented audit rationale.

### Epic 5: Costing & Overhead Allocation (Management)

* **FR-5.1 FIFO Raw Material Costing:** Consumes raw materials from oldest active purchase batches.
* **FR-5.2 Direct Overhead Absorption:** Absorbs direct labour (e.g., ₹1,200) and power/gas (e.g., ₹600) into the batch.
* **FR-5.3 Unit Cost per Packet:** Computes actual cost per marketable packet: $\frac{\text{Total Batch Cost}}{\text{Actual Good Packets Produced}}$.
* **FR-5.4 Gross Margin Reporting:** Calculates unit margin and gross profit percentage against standard selling price.

### Epic 6: Statutory Audit & Compliance Reports (Auditor)

* **FR-6.1 Sales Register:** Filterable by date range, customer, and product.
* **FR-6.2 GST Outward Supplies Summary:** Tabular breakdown structured for GSTR-1 / GSTR-3B filing (Taxable value, CGST, SGST, IGST).
* **FR-6.3 Stock Ledger & Summary:** Complete movement history per SKU with opening, inward, outward, and closing balances.
* **FR-6.4 Customer Receivables & Aging:** Outstanding dues grouped into aging brackets (0–30, 31–60, 61–90, 90+ days).
* **FR-6.5 Data Export:** 1-click export to CSV/Excel for auditor analysis.

---

## 5. Non-Functional Requirements (NFRs)

* **NFR-1 (Arithmetic Precision):** Zero floating-point drift. All financial amounts and inventory quantities must use high-precision decimals (`Decimal(12, 2)` for currency, `Decimal(12, 3)` for units).
* **NFR-2 (Response Latency):** Sub-second response times (< 1.5s) for mobile order entry and invoice generation on standard 3G/4G connections.
* **NFR-3 (Data Integrity & ACID):** Multi-table updates (e.g., invoice generation + stock ledger debit + order status transition) must execute inside atomic transactions (`prisma.$transaction`).
* **NFR-4 (Security & Immutability):** Role-Based Access Control enforced at middleware and Server Action levels. Strict input validation via Zod schemas. Posted invoices cannot be hard-deleted.
* **NFR-5 (Zero Cost Compliance):** Architecture must run completely within free-tier quotas on Vercel and Neon PostgreSQL with $0 financial expenditure.
* **NFR-6 (Usability):** High-contrast UI suitable for low-light factory floors and outdoor retail environments. Salesman order flow executable within 4 clicks.