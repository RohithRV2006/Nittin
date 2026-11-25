# Visual System Design & Diagram Suite

## 1. Overview
This document provides a comprehensive visual engineering specification for the Order-to-Audit ERP. It includes business architecture flows, user stories with acceptance criteria, role-based use case flows, sequence diagrams, component architectures, and UML state machines.

---

## 2. Business Architecture Flow (Dual-Loop Integration)

```mermaid
flowchart TD
    classDef sales fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef prod fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef stock fill:#fff3e0,stroke:#f57c00,stroke-width:2px;
    classDef audit fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;

    subgraph SalesLoop ["SALES LOOP (Revenue & Outward Flow)"]
        S1["📱 Salesman Takes Order (Mobile)"]:::sales --> S2["💻 Admin Verifies Quantity & Price"]:::sales
        S2 --> S3{"Finished Stock\nSufficient?"}:::sales
        S3 -- No --> S3_Wait["⚠️ Flag Stock Deficit\nQueue for Production"]:::sales
        S3 -- Yes --> S4["🧾 Raise GST Tax Invoice\n(CGST+SGST or IGST)"]:::sales
        S4 --> S5["📦 Dispatch Goods to Customer"]:::sales
        S5 --> S6["💰 Record Customer Payment"]:::sales
    end

    subgraph InventoryPool ["INVENTORY & STOCK LEDGER (Single Source of Truth)"]
        RM_Stock[("Raw Materials Ledger\n(Flour, Oil, Spices)")]:::stock
        PACK_Stock[("Packaging Materials Ledger\n(Pouches, Cartons)")]:::stock
        FG_Stock[("Finished Goods Ledger\n(Murukku 200g, etc.)")]:::stock
    end

    subgraph ProductionLoop ["PRODUCTION LOOP (Manufacturing & Inward Flow)"]
        P1["🛒 Raw & Packaging Inward Purchase"]:::prod --> P2["📥 Record Purchase Receipt"]:::prod
        P2 --> RM_Stock
        P2 --> PACK_Stock
        
        P3["📋 Select BOM Recipe & Batch Size"]:::prod --> P4["⚖️ Issue Raw Materials & Packaging"]:::prod
        RM_Stock -.->|Decrement Raw Stock| P4
        PACK_Stock -.->|Decrement Pack Stock| P4
        
        P4 --> P5["🏭 Daily Batch Execution"]:::prod
        P5 --> P6["📊 Log Actual Output & Scrap"]:::prod
        P6 --> P7["⚠️ Compute Variance & Cost/Pkt\n(Yield & Consumption)"]:::prod
    end

    P7 -.->|Increment Finished Stock| FG_Stock
    S5 -.->|Decrement Finished Stock| FG_Stock

    subgraph AuditReports ["AUDIT & COMPLIANCE (Single Source of Truth)"]
        A1["📈 Sales Register & Customer Dues"]:::audit
        A2["📑 GST Outward Summary (GSTR-1)"]:::audit
        A3["📦 Stock Ledger & Valuation"]:::audit
        A4["📉 Production Variance & Wastage"]:::audit
    end

    S4 --> A1
    S4 --> A2
    S6 --> A1
    FG_Stock --> A3
    RM_Stock --> A3
    P7 --> A4
```

---

## 3. User Stories & Acceptance Criteria

### US-1: Field Salesman Order Booking
* **As a** field salesman visiting retailers,
* **I want to** select a customer from my territory, pick products, specify quantities, and tap submit on my smartphone,
* **So that** orders enter the factory queue instantly without phone calls or WhatsApp messages.
* **Acceptance Criteria (Given-When-Then):**
  * *Given* I am logged in as a Salesman on a mobile device,
  * *When* I select "Retailer A", add 150 packets of "Murukku 200g", and submit,
  * *Then* the order is saved with status `SUBMITTED`, total taxable value is calculated at ₹7,500, and a success notification appears in < 60 seconds.

### US-2: Admin Verification & Real-time Stock Check
* **As a** factory admin,
* **I want to** view incoming orders and immediately see if warehouse finished stock covers the ordered quantity,
* **So that** I do not commit to delivery when inventory is insufficient.
* **Acceptance Criteria:**
  * *Given* an order from "Distributor B" for 120 packets of Murukku 200g arrives,
  * *When* the current available finished stock is 88 packets,
  * *Then* the system alerts: "Insufficient Stock! Shortage of 32 packets", preventing blind dispatch until new stock is produced.

### US-3: GST Tax Invoicing & WhatsApp Sharing
* **As a** factory admin,
* **I want to** convert an approved order into a GST tax invoice with 1 click,
* **So that** the invoice applies the correct place-of-supply tax split (CGST+SGST for Tamil Nadu, IGST for Karnataka) and can be shared via WhatsApp.
* **Acceptance Criteria:**
  * *Given* an approved order for Retailer A (Tamil Nadu),
  * *When* I generate the invoice,
  * *Then* the invoice shows 2.5% CGST (₹187.50) + 2.5% SGST (₹187.50) on ₹7,500 taxable value = ₹7,875 total, assigns sequential number `INV/2024-25/0001`, and provides a direct WhatsApp share link.

### US-4: Recipe (BOM) Production & Variance Tracking
* **As a** production supervisor,
* **I want to** execute a daily batch run against a BOM and enter actual inputs, outputs, and packaging scrap,
* **So that** raw materials decrement, finished goods increment, and variances beyond $\pm 3\%$ are automatically flagged.
* **Acceptance Criteria:**
  * *Given* standard BOM for Murukku 200g expects 200 packets from 40kg flour, 10L oil, and 1.2kg spices,
  * *When* I enter actual output of 188 packets and 10.5L oil issued,
  * *Then* the system flags Yield Variance at **-6.00%** (Loss Alert) and Oil Consumption Variance at **+5.00%** (Over-consumption Alert), while auto-updating raw and finished stock ledgers.

### US-5: Unit Costing with Direct Overheads
* **As a** business owner,
* **I want to** absorb direct labour (₹1,200) and power/gas (₹600) into the batch run,
* **So that** I see the true cost per packet and gross profit margin against the ₹50 selling price.
* **Acceptance Criteria:**
  * *Given* total run expenses of ₹5,810 (Raw ₹3,390 + Packaging ₹620 + Overheads ₹1,800),
  * *When* divided across 188 marketable packets,
  * *Then* cost per packet is displayed as **₹30.90**, showing a unit gross margin of **₹19.10 (38.2%)**.

---

## 4. Use Case & Flow Diagrams

```mermaid
graph TD
    subgraph Roles ["Actors & Entry Portals"]
        SalesmanRole["👤 Salesman"]
        AdminRole["👤 Factory Admin"]
        SupervisorRole["👤 Floor Supervisor"]
        AuditorRole["👤 Auditor"]
        OwnerRole["👤 Business Owner"]
    end

    subgraph SalesmanFlow ["Salesman Portal (Mobile)"]
        SM1["Customer Directory"] --> SM2["Create Order Form"]
        SM2 --> SM3["Select SKU & Enter Qty"]
        SM3 --> SM4["Review & Submit"]
        SM4 --> SM5["Order Tracking Dashboard"]
    end

    subgraph AdminFlow ["Factory Admin Desk (Desktop)"]
        AD1["Incoming Order Queue"] --> AD2["Stock Sufficiency Check"]
        AD2 --> AD3{"Stock Available?"}
        AD3 -- Yes --> AD4["Approve & Generate GST Invoice"]
        AD3 -- No --> AD_Hold["Place on Hold / Backorder"]
        AD4 --> AD5["Dispatch Warehouse Order"]
        AD5 --> AD6["Record Payment Receipt"]
    end

    subgraph ProdFlow ["Production Floor (Tablet/Desktop)"]
        PR1["Select BOM Recipe"] --> PR2["Issue Raw Ingredients"]
        PR2 --> PR3["Record Actual Batch Yield"]
        PR3 --> PR4["Log Damaged Scrap"]
        PR4 --> PR5["Automated Ledger Post & Variance Review"]
    end

    subgraph AuditorFlow ["Auditor Workspace (Read-Only)"]
        AU1["Date Range Filter"] --> AU2["View Sales Register"]
        AU1 --> AU3["View GSTR-1 Outward Summary"]
        AU1 --> AU4["View Immutable Stock Ledger"]
        AU1 --> AU5["View Customer Debtors & Aging"]
        AU2 & AU3 & AU4 & AU5 --> AU6["1-Click CSV / Excel Export"]
    end

    subgraph OwnerFlow ["Owner Executive Dashboard"]
        OW1["Daily Sales & Profit KPIs"]
        OW2["Production Variance Alerts (>3%)"]
        OW3["Stock Levels & Reorder Triggers"]
        OW4["Unit Cost per Packet & Gross Margins"]
    end

    SalesmanRole --> SM1
    AdminRole --> AD1
    SupervisorRole --> PR1
    AuditorRole --> AU1
    OwnerRole --> OW1 & OW2 & OW3 & OW4
```

---

## 5. Sequence Diagrams

### 5.1 Sales-to-Invoice Sequence (Sales Loop)

```mermaid
sequenceDiagram
    autonumber
    actor Salesman as 📱 Salesman
    actor Admin as 💻 Factory Admin
    participant System as ⚙️ Next.js Server Actions
    participant StockEngine as 📦 Stock Ledger Engine
    participant DB as 🗄️ Neon PostgreSQL
    actor Customer as 🏢 Retailer A

    Salesman->>System: submitOrder(customerId, items)
    System->>DB: INSERT INTO "Order" (status: SUBMITTED)
    System-->>Salesman: Order #ORD-001 Created (Confirmed)
    
    Admin->>System: getOrderDetails(orderId: #ORD-001)
    System->>StockEngine: checkStockAvailability(itemId, qty: 150)
    StockEngine->>DB: SELECT SUM(quantity) FROM "StockLedger" WHERE itemId = Murukku
    DB-->>StockEngine: Current Stock = 238 pkts
    StockEngine-->>Admin: Stock Sufficient (238 >= 150)

    Admin->>System: approveAndGenerateInvoice(orderId)
    Note over System: Place of supply check: TN -> CGST (2.5%) + SGST (2.5%)
    System->>DB: BEGIN TRANSACTION
    System->>DB: INSERT INTO "Invoice" (taxable: 7500, cgst: 187.50, sgst: 187.50, total: 7875)
    System->>DB: UPDATE "Order" SET status = 'INVOICED'
    System->>DB: COMMIT TRANSACTION
    System-->>Admin: Invoice INV/2024-25/0001 Generated (PDF Ready)

    Admin->>System: recordDispatch(invoiceId)
    System->>DB: BEGIN TRANSACTION
    System->>DB: INSERT INTO "StockLedger" (Murukku, qty: -150, type: DISPATCH_SALE)
    System->>DB: UPDATE "Order" SET status = 'DISPATCHED'
    System->>DB: COMMIT TRANSACTION
    System-->>Admin: Dispatch Logged (Stock drops to 88 pkts)

    Admin->>System: recordPayment(customerId, amount: 4000)
    System->>DB: INSERT INTO "Payment" (amount: 4000)
    System-->>Admin: Payment Logged (Customer Outstanding = ₹3,875)
    Admin->>Customer: Share Invoice PDF via WhatsApp Deep Link
```

### 5.2 Recipe-to-Stock Sequence (Production Loop)

```mermaid
sequenceDiagram
    autonumber
    actor Supervisor as 📟 Floor Supervisor
    participant System as ⚙️ Next.js Server Actions
    participant BOMEngine as ⚖️ BOM & Variance Engine
    participant CostingEngine as 💰 Costing Engine
    participant DB as 🗄️ Neon PostgreSQL

    Supervisor->>System: getBOM(Murukku 200g)
    System->>DB: SELECT * FROM "BOM" JOIN "BOMItem"
    DB-->>Supervisor: Standard: 40kg Flour, 10L Oil, 1.2kg Spices -> 200 pkts

    Supervisor->>System: logProductionRun(bomId, inputs, outputs, overheads)
    Note over Supervisor: Inputs: 40kg Flour, 10.5L Oil (+5%), 1.2kg Spices<br/>Outputs: 188 pkts (-6%), 6 damaged pouches, 9 cartons<br/>Overheads: Labour ₹1,200, Gas/Power ₹600

    System->>BOMEngine: calculateVariances(planned, actual)
    BOMEngine-->>System: Yield Variance: -6.00% (FLAGGED)\nOil Variance: +5.00% (FLAGGED)

    System->>CostingEngine: computeCostPerPacket(inputs, packaging, overheads, actualOutput)
    Note over CostingEngine: FIFO Material: ₹3,390\nPackaging: ₹620\nOverheads: ₹1,800\nTotal = ₹5,810 / 188 pkts = ₹30.90/pkt
    CostingEngine-->>System: Cost/Packet: ₹30.90, Margin: ₹19.10

    System->>DB: BEGIN TRANSACTION
    System->>DB: INSERT INTO "ProductionRun" (actualOutput: 188, costPerPacket: 30.90, varianceFlagged: true)
    System->>DB: INSERT INTO "StockLedger" (Flour, qty: -40.0, type: PRODUCTION_ISSUE)
    System->>DB: INSERT INTO "StockLedger" (Oil, qty: -10.5, type: PRODUCTION_ISSUE)
    System->>DB: INSERT INTO "StockLedger" (Spices, qty: -1.2, type: PRODUCTION_ISSUE)
    System->>DB: INSERT INTO "StockLedger" (Pouches, qty: -194, type: PRODUCTION_ISSUE)
    System->>DB: INSERT INTO "StockLedger" (Cartons, qty: -9, type: PRODUCTION_ISSUE)
    System->>DB: INSERT INTO "StockLedger" (Murukku, qty: +188, type: PRODUCTION_OUTPUT)
    System->>DB: COMMIT TRANSACTION
    System-->>Supervisor: Production Run PR-2024-001 Recorded & Stock Updated
```

### 5.3 Error Reversal & Compensating Adjustment Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 💻 Factory Admin
    participant System as ⚙️ Next.js Server Actions
    participant DB as 🗄️ Neon PostgreSQL

    Admin->>System: cancelPostedInvoice(invoiceId, reason)
    Note over System: Invoices cannot be DELETED. Reversal must be compensatory.
    System->>DB: BEGIN TRANSACTION
    System->>DB: UPDATE "Invoice" SET status = 'CANCELLED'
    System->>DB: INSERT INTO "CreditNote" (invoiceId, amount, reason)
    System->>DB: INSERT INTO "StockLedger" (Murukku, qty: +150, type: STOCK_ADJUSTMENT, notes: 'Restock from Cancelled Invoice')
    System->>DB: COMMIT TRANSACTION
    System-->>Admin: Credit Note Issued & 150 Packets Restocked into Ledger
```

---

## 6. Component Architecture Diagram

```mermaid
flowchart TD
    subgraph UIComponents ["Presentation Layer (React Server & Client Components)"]
        MobileNav["Mobile App Shell (Salesman)"]
        DeskNav["Enterprise Desk Shell (Admin / Auditor)"]
        OrderForms["Zod-Validated Dynamic Forms"]
        DataTables["Auditor Filterable Tables & Charts"]
    end

    subgraph ServerLayer ["Next.js App Router (Server Actions & Route Handlers)"]
        AuthAction["auth.actions.ts\n(Session & RBAC Middleware)"]
        OrderAction["order.actions.ts\n(Order Booking & Validation)"]
        BillingAction["billing.actions.ts\n(GST Engine & PDF Generation)"]
        ProdAction["production.actions.ts\n(BOM Execution & Ledger Updates)"]
        ReportAction["report.actions.ts\n(GSTR-1, Ledger & Export)"]
    end

    subgraph CoreEngines ["Domain Business Engines"]
        TaxEngine["TaxEngine\n(Place of Supply & GST Split)"]
        StockEngine["StockLedgerEngine\n(FIFO Movements & Reconciliations)"]
        VarianceEngine["VarianceEngine\n(Tolerance & Alert Logic)"]
        CostingEngine["CostingEngine\n(Overhead Absorption & Margins)"]
    end

    subgraph DataAccess ["Data Layer"]
        PrismaClient["Prisma ORM Client\n($transaction, Typed Models)"]
        NeonDB[("Neon Serverless PostgreSQL")]
    end

    UIComponents --> ServerLayer
    ServerLayer --> CoreEngines
    CoreEngines --> PrismaClient
    PrismaClient --> NeonDB
```

---

## 7. UML State Machine Diagrams

### 7.1 Order Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED : Salesman submits order from field
    SUBMITTED --> REJECTED : Admin rejects (pricing / customer issue)
    SUBMITTED --> APPROVED : Admin validates stock & confirms
    APPROVED --> INVOICED : GST Tax Invoice generated
    INVOICED --> DISPATCHED : Warehouse dispatches goods (Stock Ledger Debited)
    INVOICED --> CANCELLED : Invoice cancelled (Credit Note generated)
    DISPATCHED --> [*]
    REJECTED --> [*]
    CANCELLED --> [*]
```

### 7.2 Stock Ledger Movement Lifecycle

```mermaid
stateDiagram-v2
    [*] --> InwardMovement : Purchase Receipt / Production Yield
    [*] --> OutwardMovement : Production Issue / Dispatch Sale / Scrap
    InwardMovement --> ImmutableLedgerRecord : Write positive delta (+Qty)
    OutwardMovement --> ImmutableLedgerRecord : Write negative delta (-Qty)
    ImmutableLedgerRecord --> ClosingBalanceSnapshot : Balance = Opening + Receipts - Issues
    ClosingBalanceSnapshot --> [*]
```
