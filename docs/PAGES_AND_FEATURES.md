# Web Pages & Feature Implementation Specification

## 1. Overview
This document specifies the complete page architecture, routing structure, UI layout, and exhaustive feature set for every screen in the Order-to-Audit ERP. Every interactive control—from quick-login shortcuts to data filters, modal forms, PDF downloads, WhatsApp triggers, and CSV export buttons—is explicitly detailed.

---

## 2. Route Directory & Access Map

| Route | Page / View Name | Primary Role | Layout Type |
| :--- | :--- | :--- | :--- |
| `/login` | Authentication & Demo Switcher | All Roles | Centered Card / Responsive |
| `/salesman` | Salesman Home & Order Hub | Salesman | Mobile-First Shell |
| `/salesman/new-order` | Field Order Booking Form | Salesman | Mobile Touch-Optimized |
| `/salesman/orders` | Salesman Order History & Tracking | Salesman | Mobile Card List |
| `/admin` | Factory Admin Command Center | Factory Admin | Enterprise Desktop Layout |
| `/admin/orders` | Incoming Order Verification Queue | Factory Admin | Data Table & Verification Modal |
| `/admin/invoices` | GST Invoicing & Dispatch Desk | Factory Admin | Data Table, PDF & WhatsApp Modals |
| `/admin/purchases` | Inward Procurement & Supplier Bills | Factory Admin | Data Table & Inward Entry Modal |
| `/admin/payments` | Payment Collections & Customer Balances | Factory Admin | Data Table & Payment Entry Modal |
| `/admin/masters` | Master Catalog (Items, BOM, Customers) | Factory Admin | Tabbed Master Management |
| `/production` | Production Floor Overview | Floor Supervisor | Ruggedized Tablet / Desktop |
| `/production/new-run` | Daily Batch Run & Scrap Logger | Floor Supervisor | Touch Recipe Form with Live Math |
| `/production/boms` | BOM Recipe Directory & Builder | Floor Supervisor | List & Recipe Builder Modal |
| `/auditor` | Auditor Workspace & Report Center | Auditor | Filterable Table with Date Controls |
| `/auditor/sales-register` | Sales Register & Tax Ledger | Auditor | Data Table with Excel/CSV Export |
| `/auditor/gst-summary` | GSTR-1 Outward Supplies Summary | Auditor | Statutory Tax Table with Export |
| `/auditor/stock-ledger` | Immutable Stock Movement Ledger | Auditor | Transactional Ledger with Export |
| `/auditor/receivables` | Debtors Ageing & Receivables | Auditor | Ageing Analysis Table with Export |
| `/dashboard` | Owner Executive KPI Dashboard | Owner | Visual KPI Grid & Variance Alerts |

---

## 3. Detailed Page-by-Page Feature Specifications

### 3.1 Authentication & Demo Switcher (`/login`)
* **Layout:** Clean, centered authentication card with responsive mobile and desktop layout.
* **Features & Controls:**
  * **Email & Password Input Fields:** Form with client and server Zod validation.
  * **"Sign In" Button:** Submits credentials, validates session cookie (`HttpOnly`).
  * **Demo 1-Click Role Switcher (Evaluation Accelerator):**
    * Button: *“Login as Salesman A (Mobile View)”*
    * Button: *“Login as Salesman B (Interstate View)”*
    * Button: *“Login as Factory Admin (Desktop View)”*
    * Button: *“Login as Production Supervisor (Floor View)”*
    * Button: *“Login as Auditor / Accountant (Read-Only)”*
    * Button: *“Login as Business Owner (Executive Dashboard)”*
  * **Reset / Replay Benchmark Seed Button:** A 1-click shortcut to reload the Section 5 benchmark data anytime during evaluation.

---

### 3.2 Salesman Portal (Mobile-First)

#### A. Salesman Home (`/salesman`)
* **Layout:** Touch-friendly mobile dashboard with quick stats and thumb-accessible navigation bar.
* **Features:**
  * Header showing current Salesman Name and Active Network Indicator (Online / Offline).
  * Quick KPI Cards: *Today's Orders Count*, *Today's Booked Value (₹)*, *Active Customers*.
  * **Primary Floating Action Button (FAB):** *"+ New Field Order"* (prominently placed for single-thumb tap).
  * Recent orders preview list with live status badges (`SUBMITTED`, `APPROVED`, `DISPATCHED`).

#### B. New Field Order Form (`/salesman/new-order`)
* **Layout:** Stepped, ultra-fast mobile booking screen executable in < 60 seconds.
* **Features & Controls:**
  * **Customer Selector:** Searchable dropdown populated with assigned customers (e.g., *Retailer A - Tamil Nadu*, *Distributor B - Karnataka*). Displays customer GSTIN and state code.
  * **Item Row Repeater:**
    * Product Selector Dropdown (e.g., *Murukku 200g*).
    * Available Packets Indicator (advisory display so salesman knows factory inventory).
    * Quantity Stepper (+ / - buttons and direct numeric keypad entry).
    * Unit Price Display (auto-fetched from item catalog: ₹50.00/pkt).
    * Subtotal Line Calculation.
    * "+ Add Another Item" Button.
  * **Order Summary Panel:** Live taxable total calculation, estimated GST, and grand total.
  * **Delivery / Special Notes Field:** Optional text box for delivery timing or dealer instructions.
  * **"Submit Order to Factory" Button:**
    * Online mode: Instant submission with animated spinner and success modal showing generated Order ID (e.g., `#ORD-001`).
    * Offline mode (PWA): Automatically saves to browser LocalStorage/IndexedDB and queues for sync when network is restored.

#### C. Order History & Status (`/salesman/orders`)
* **Features:**
  * Search input to filter by customer name or order number.
  * Status Filter Tabs: `All`, `Pending Approval`, `Invoiced`, `Dispatched`.
  * Expandable Order Cards displaying: Order Date, Customer, Item Breakdown, Total Amount, and current status chip with color coding.

---

### 3.3 Factory Admin Desk (Desktop)

#### A. Admin Incoming Orders Queue (`/admin/orders`)
* **Layout:** Enterprise data table with live polling/refresh indicator.
* **Features & Controls:**
  * Incoming Orders Table: Order #, Date/Time, Salesman Name, Customer Name, State, Total Items, Order Value, Status.
  * Search and Date Range filter controls.
  * **"Verify & Process" Action Button (Per Row):** Opens the **Order Verification Modal**.
  * **Order Verification Modal:**
    * Displays requested items and quantities.
    * **Real-time Stock Sufficiency Check:**
      * Queries `StockLedger` for available Finished Goods balance.
      * *Sufficient Case (Retailer A - 150 pkts vs 238 available):* Green badge: *"Stock Available (238 pkts in warehouse)"*.
      * *Insufficient Case (Distributor B - 120 pkts vs 88 available):* Red alert banner: *"Insufficient Stock! Deficit of 32 packets"*.
    * Quantity/Price Override fields (allows admin to adjust quantities if mutually agreed).
    * **"Approve & Raise GST Invoice" Button:** Triggers tax calculation, creates invoice, and updates order to `INVOICED`.
    * **"Reject Order" Button:** Rejection reason prompt, updates order to `REJECTED`.

#### B. GST Invoicing & Dispatch Desk (`/admin/invoices`)
* **Layout:** Full-width financial management table.
* **Features & Controls:**
  * Invoices Table: Invoice # (e.g., `INV/2024-25/0001`), Order Ref, Customer, Date, Place of Supply, Taxable Amount (₹), CGST (₹), SGST (₹), IGST (₹), Total Invoice Amount (₹), Dispatch Status, Payment Status.
  * **"View / Download PDF" Button:** Generates and downloads an A4 GST Tax Invoice PDF containing company GSTIN, HSN codes, tax breakdown, and bank details.
  * **"Share on WhatsApp" Button:** Opens WhatsApp Web / Mobile (`https://wa.me/?text=...`) with pre-composed text message and invoice link.
  * **"Record Dispatch" Button:**
    * Prompts confirmation of physical dispatch.
    * Automatically writes negative debit to `StockLedger` for Finished Goods (`DISPATCH_SALE`).
    * Sets invoice and order status to `DISPATCHED`.
  * **"Cancel Invoice (Credit Note)" Action:**
    * Opens Credit Note modal requiring audit cancellation rationale.
    * Compensates invoice value, cancels document, and restocks finished goods into `StockLedger`.

#### C. Inward Procurement Desk (`/admin/purchases`)
* **Features & Controls:**
  * Purchase Register Table: Purchase Ref, Vendor Name, Bill #, Date, Items, Total Value, Payment Status.
  * **"+ Record Inward Purchase" Button:** Opens inward entry modal.
  * **Inward Purchase Modal:**
    * Supplier dropdown selector.
    * Invoice / Bill Number input.
    * Purchase Date picker.
    * Item selector (e.g., *Flour*, *Cooking Oil*, *200g Pouches*).
    * Quantity input with unit (e.g., 60 kg).
    * Unit Rate input (e.g., ₹45.00/kg).
    * GST % dropdown (e.g., 5.00%).
    * Auto-computed taxable value, tax amount, and bill total.
    * **"Save & Inward to Stock Ledger" Button:** Atomically writes inward stock movement (`PURCHASE_RECEIPT`) with unit valuation rate.

#### D. Payment Collection Desk (`/admin/payments`)
* **Features & Controls:**
  * Customer Receivables Overview: Customer Name, Total Invoiced, Total Paid, Current Outstanding Balance.
  * **"+ Record Customer Payment" Button:** Opens collection modal.
  * **Record Payment Modal:**
    * Customer selector (e.g., *Retailer A*).
    * Outstanding balance auto-display (e.g., ₹7,875.00).
    * Payment Amount input (e.g., ₹4,000.00).
    * Payment Mode dropdown: `CASH`, `UPI`, `BANK_TRANSFER`, `CHEQUE`.
    * Transaction Ref / UTR number input.
    * Notes text field.
    * **"Save Payment" Button:** Updates customer balance, allocates against pending invoice, and prints receipt voucher.

---

### 3.4 Production Floor Workspace (Floor Tablet / Desktop)

#### A. Production Dashboard (`/production`)
* **Layout:** High-contrast, large-button interface designed for factory floor tablets.
* **Features:**
  * Active BOM Recipes summary cards.
  * Today's Production Runs summary.
  * **Prominent Red Variance Banner:** Appears automatically if any production run in the last 24 hours experienced yield loss or ingredient consumption variance $> \pm 3\%$.
  * **Primary Action:** *"+ Start Daily Production Run"* button.

#### B. Production Run Execution Screen (`/production/new-run`)
* **Layout:** Interactive batch execution worksheet with real-time math engine.
* **Features & Controls:**
  * **BOM Recipe Selector:** Dropdown to select recipe (e.g., *Murukku 200g*). Auto-loads standard batch ratios (Standard Batch = 200 packets).
  * **Supervisor & Date Selector:** Pre-filled with logged-in user and current timestamp.
  * **Raw Material Issuance Section:**
    * Dynamic ingredient rows populated from BOM:
      * Flour: Planned = 40.0 kg $\rightarrow$ Actual Issued input (Default 40.0 kg).
      * Cooking Oil: Planned = 10.0 L $\rightarrow$ Actual Issued input (e.g., 10.5 L).
      * Salt & Spices: Planned = 1.2 kg $\rightarrow$ Actual Issued input (Default 1.2 kg).
    * **Live Material Variance Indicator:** Displays real-time consumption variance % next to each row. When oil is set to 10.5 L, shows red pill: `+5.00% (Excess Issued)`.
  * **Output & Packaging Section:**
    * Expected Yield Display: 200 packets.
    * **Actual Good Packets Produced Input:** Numeric field (e.g., 188 pkts).
    * **Live Yield Variance Badge:** Auto-computes and displays `((188 - 200) / 200) * 100 = -6.00%` with a red warning border.
    * **Damaged Packaging Scrap Input:** e.g., 6 damaged pouches.
    * **Cartons Used Input:** e.g., 9 outer cartons.
  * **Direct Batch Overheads Section:**
    * Direct Labour Cost input: ₹1,200.00.
    * Power & Gas Cost input: ₹600.00.
  * **Real-time Cost & Margin Preview Card:**
    * Raw Materials Cost: ₹3,390.00 (FIFO valuation).
    * Packaging Cost: ₹485.00 (194 pouches) + ₹135.00 (9 cartons) = ₹620.00.
    * Direct Overheads: ₹1,800.00.
    * Total Batch Cost: ₹5,810.00.
    * **Calculated Cost per Packet:** $₹5,810.00 / 188 = \mathbf{₹30.90 / pkt}$.
    * **Gross Margin against ₹50 Selling Price:** $\mathbf{₹19.10 (38.2\%)}$.
  * **"Save Production Run & Commit Stock" Button:**
    * Executes atomic transaction:
      * Debits raw materials & packaging from `StockLedger`.
      * Credits finished Murukku packets (+188) to `StockLedger`.
      * Saves production run record with variance flags and overhead cost breakdowns.

---

### 3.5 Auditor & Accounts Portal (Read-Only)

#### A. Auditor Center (`/auditor`)
* **Layout:** Clean data workspace with unified global controls.
* **Global Controls:**
  * Date Range Filter (From Date — To Date).
  * Financial Year Selector (e.g., `2024-2025`).
  * Tab navigation across statutory statements.

#### B. Sales Register (`/auditor/sales-register`)
* **Features:**
  * Detailed outward supplies table: Invoice #, Date, Customer Name, Customer State, GSTIN, HSN Code, Quantity, Taxable Value, CGST Amount, SGST Amount, IGST Amount, Total Invoice Value.
  * Summary footer row with sum totals.
  * **"Export to Excel (XLSX)" Button:** 1-click download of styled Excel spreadsheet.
  * **"Export to CSV" Button:** Standard CSV export for accounting software import.

#### C. GST Summary Report (`/auditor/gst-summary`)
* **Features:**
  * Statutory breakdown mapping directly to **GSTR-1** and **GSTR-3B** return formats:
    * Table 4: B2B Invoices (Interstate & Intrastate).
    * Table 5: B2C Large / Small Invoices.
    * Rate-wise Tax Summary (5% Taxable, CGST, SGST, IGST).
  * **"Export GSTR-1 Format (CSV)" Button**.

#### D. Stock Ledger & Inventory Valuation (`/auditor/stock-ledger`)
* **Features:**
  * Item Category Filter: `All`, `Raw Materials`, `Packaging`, `Finished Goods`.
  * Item SKU Filter Dropdown: e.g., *Flour*, *Cooking Oil*, *Murukku 200g*.
  * Transactional Movement Table: Timestamp, SKU, Source Ref Type (`PURCHASE`, `RUN`, `INVOICE`), Source Doc ID, Movement Type, Inward Qty (+), Outward Qty (-), Running Closing Balance, Valuation Rate (₹), Total Closing Value (₹).
  * Invariant verification check pill: *"Ledger Reconciled: 100% Mathematically Balanced"*.
  * **"Export Stock Ledger (XLSX/CSV)" Button**.

#### E. Customer Receivables & Ageing (`/auditor/receivables`)
* **Features:**
  * Debtor Ledger Table: Customer Name, State, Total Invoiced Value, Total Collections Received, Current Balance Outstanding.
  * **Ageing Analysis Columns:** `Current (0-30 days)`, `31-60 days`, `61-90 days`, `90+ days overdue`.
  * **"Export Receivables Ageing (CSV)" Button**.

---

### 3.6 Owner Executive Dashboard (`/dashboard`)
* **Layout:** Visual metric grid designed for business owners to assess factory pulse in 30 seconds.
* **Features & Widgets:**
  * **Today's Commercial Pulse Card:** Total orders booked, total invoiced value, collections received today.
  * **Finished Goods Warehouse Stock Card:** Current inventory vs. pending dispatch commitments (e.g., 88 packets available).
  * **Wastage & Production Variance Alerts Widget:**
    * Highlights runs with tolerance breach (e.g., *Batch #PR-2024-001: Yield -6.00% [Deficit: 12 pkts], Oil +5.00%*).
  * **Unit Economics Card:** Average cost per packet (₹30.90), selling price (₹50.00), and net gross margin percentage (38.2%).
  * **Debtors & Cash Flow Card:** Total outstanding receivables across market retailers (e.g., ₹3,875.00 from Retailer A).
  * **Raw Material Low-Stock Warnings:** Real-time indicator for items nearing reorder thresholds.
