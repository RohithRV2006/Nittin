# Web Pages & Feature Implementation Specification

## 1. Overview
This document specifies the complete page architecture, routing structure, UI layout, and exhaustive feature set for every screen in the Order-to-Audit ERP. Every interactive control—from quick-login shortcuts to data filters, modal forms, PDF downloads, WhatsApp triggers, and CSV export buttons—is explicitly detailed.

---

## 2. Route Directory & Access Map

| Route | Page / View Name | Primary Role | Layout Type |
| :--- | :--- | :--- | :--- |
| `/` | Role-Based Entry Redirect | All Roles | Server Redirect (`307`) to role home or `/login` |
| `/login` | Authentication & Demo Switcher | All Roles | Centered Card / Responsive |
| `/salesman` | Salesman Home & Order Hub | Salesman | Mobile-First Shell |
| `/salesman/new-order` | Field Order Booking Form | Salesman | Mobile Touch-Optimized |
| `/salesman/orders` | Salesman Order History & Tracking | Salesman | Mobile Card List |
| `/admin` | Factory Admin Command Center | Factory Admin | Enterprise Desktop Layout |
| `/admin/orders` | Incoming Order Verification Queue | Factory Admin | Data Table & Verification Modal |
| `/admin/invoices` | GST Invoicing & Dispatch Desk | Factory Admin | Data Table, PDF & WhatsApp Modals |
| `/admin/purchases` | Inward Procurement & Supplier Bills | Factory Admin | Data Table & Inward Entry Modal |
| `/admin/payments` | Payment Collections & Customer Balances | Factory Admin | Data Table & Payment Entry Modal |
| `/admin/masters` | Master Catalog (Items, Suppliers, Customers, BOMs, Settings) | Factory Admin | Tabbed Master Management |
| `/admin/adjustments` | Stock Adjustments & Expiry Alerts | Factory Admin | Adjustment Modal & Audit Log |
| `/production` | Production Floor Overview | Floor Supervisor | Ruggedized Tablet / Desktop |
| `/production/new-run` | Daily Batch Run & Scrap Logger | Floor Supervisor | Touch Recipe Form with Live Math |
| `/production/receiving` | Floor Goods Receipt (GRN) | Floor Supervisor | Gate Receipt Intake (No Pricing) |
| `/production/boms` | BOM Recipe Directory & Builder | Floor Supervisor | List & Recipe Builder Modal |
| `/auditor` | Auditor Workspace & Report Center | Auditor | Filterable Table with Date Controls |
| `/auditor/sales-register` | Sales Register (Customer & Product-Wise) | Auditor | Data Table with Excel/CSV & PDF Export |
| `/auditor/gst-summary` | GSTR-1 / GSTR-3B Outward Supplies Summary | Auditor | Statutory Tax Table with Export |
| `/auditor/purchase-register` | Purchase Register & Supplier GST Summary | Auditor | Data Table with Excel/CSV & PDF Export |
| `/auditor/stock-ledger` | Stock Summary & Immutable Movement Ledger | Auditor | Transactional Ledger with Export |
| `/auditor/production-report` | Production Variance, Wastage & Costing Report | Auditor | Batch Analysis Table with Export |
| `/auditor/receivables` | Payments, Collections & Debtors Ageing | Auditor | Ageing Analysis Table with Export |
| `/auditor/audit-log` | Immutable Edit & Cancellation Audit Trail | Auditor / Admin | Filterable Audit Diff Table |
| `/dashboard` | Owner Executive KPI Dashboard | Owner | Visual KPI Grid & Variance Alerts |
| `/dashboard/team` | Admins & Company Governance | Owner | Manage Factory Admins, Auditors & GST Profile |

---

## 3. Detailed Page-by-Page Feature Specifications

### 3.1 Authentication & Demo Switcher (`/login`)
* **Layout:** Clean, centered authentication card with responsive mobile and desktop layout.
* **Features & Controls:**
  * **Email & `PasswordInput` Fields:** Includes Eye/EyeOff password visibility toggle and server Zod validation.
  * **"Forgot password?" Action:** Submits a non-enumerating `PasswordResetRequest` to Factory Admin.
  * **"Sign In" Button:** Submits credentials, validates session cookie (`HttpOnly`), and checks brute-force/rate limits.
  * **Demo 1-Click Role Switcher (Gated by `ENABLE_DEMO_MODE=true`):**
    * Button: *“Login as Salesman A (Mobile View)”*
    * Button: *“Login as Salesman B (Interstate View)”*
    * Button: *“Login as Factory Admin (Desktop View)”*
    * Button: *“Login as Production Supervisor (Floor View)”*
    * Button: *“Login as Auditor / Accountant (Read-Only)”*
    * Button: *“Login as Business Owner (Executive Dashboard)”*
  * **Reset / Replay Benchmark Seed Button (Gated by `ENABLE_DEMO_MODE=true` + Confirmation):** A 1-click shortcut to reload the Section 5 benchmark data anytime during evaluation (disabled in strict production mode).

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
  * **Customer Selector:** Searchable dropdown populated with active assigned customers (e.g., *Retailer A - Tamil Nadu*, *Distributor B - Karnataka*). Displays customer GSTIN and state code.
  * **Item Row Repeater:**
    * Product Selector Dropdown (e.g., *Murukku 200g*).
    * Available Packets Indicator (advisory display so salesman knows factory inventory).
    * Quantity Stepper (+ / - buttons and direct numeric keypad entry).
    * Unit Price Display (auto-fetched from `CustomerPrice` override or `Item.sellingPrice`, e.g., ₹50.00/pkt).
    * Subtotal Line Calculation.
    * "+ Add Another Item" Button.
  * **Order Summary Panel:** Live taxable total calculation, estimated GST, and grand total.
  * **Delivery / Special Notes Field:** Optional text box for delivery timing or dealer instructions.
  * **"Submit Order to Factory" Button:**
    * Online mode: Instant submission with animated spinner and success modal showing generated Order ID (e.g., `#ORD-001`).
    * Offline mode (PWA): Automatically saves to browser IndexedDB/LocalStorage with a unique `clientRequestId` UUID, shows a **"Pending Sync" badge**, auto-syncs when `navigator.onLine` / network returns, and supports manual **"Retry Sync"** with conflict feedback.

#### C. Order History & Customer-Wise Sales (`/salesman/orders`)
* **Features:**
  * View Toggle Tabs: **`Order History`** and **`Customer-Wise Sales Summary`** (showing total orders, total value, and last order date per customer).
  * Search input to filter by customer name or order number.
  * Status Filter Tabs: `All`, `Pending Approval`, `On Hold`, `Invoiced`, `Dispatched`, `Offline Queued`.
  * Expandable Order Cards displaying: Order Date, Customer, Item Breakdown, Total Amount, and current status chip with color coding.

---

### 3.3 Factory Admin Desk (Desktop)

#### A0. Factory Admin Command Center (`/admin`)
* **Layout:** High-density desktop operational overview with direct action shortcuts.
* **Features & Widgets:**
  * **KPI Strip:** Pending Verification Orders count, Pending Dispatches count, Today's Invoiced Value (₹), Today's Collections (₹).
  * **Action Queue Cards:** Immediate links to Orders awaiting approval (`SUBMITTED` / `ON_HOLD`), Invoices awaiting dispatch (`PENDING_DISPATCH`), and Low-Stock / Expiring Batch alerts.
  * **Recent Activity Feed:** Latest `AuditLog` entries (orders approved, invoices generated, credit notes issued).

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
    * Quantity/Price Override fields (allows admin to adjust quantities or prices before approval; writes before/after diff to `AuditLog`).
    * **"Approve & Raise GST Invoice" Button:** Triggers tax calculation, creates invoice, and updates order to `INVOICED`.
    * **"Place On Hold (Insufficient Stock)" Button:** Marks shortage orders (e.g., Distributor B 32-pkt deficit) as `ON_HOLD` until production replenishes stock.
    * **"Reject Order" Button:** Rejection reason prompt, updates order to `REJECTED`.

#### B. GST Invoicing & Dispatch Desk (`/admin/invoices`)
* **Layout:** Full-width financial management table.
* **Features & Controls:**
  * Invoices Table: Invoice # (e.g., `INV/2024-25/0001`), Order Ref, Customer, Date, Place of Supply, Taxable Amount (₹), CGST (₹), SGST (₹), IGST (₹), Total Invoice Amount (₹), Dispatch Status, Payment Status.
  * **"View / Download PDF" Button:** Generates and downloads an A4 GST Tax Invoice PDF containing company GSTIN, HSN codes, tax breakdown, and bank details.
  * **"e-Invoice / e-Way Bill JSON (Mock)" Action:** Generates mocked NIC IRN/Ack/QR metadata (`eInvoiceMeta`) and downloads compliant NIC e-Invoice JSON or e-Way Bill JSON payloads.
  * **"Share on WhatsApp" Button:** Opens WhatsApp Web / Mobile (`https://wa.me/?text=...`) with pre-composed text message and invoice link.
    * **"Record Dispatch" Drawer (Full or Partial):**
      * Supports splitting dispatch quantities per line (`PARTIALLY_DISPATCHED` $\rightarrow$ `DISPATCHED`), capturing optional vehicle # and notes.
      * Automatically writes negative FEFO debit rows to `StockLedger` & `StockBatch` (`DISPATCH_SALE`) and creates a sequential `DispatchChallan` with downloadable **Delivery Challan PDF**.
    * **"Sales Return" Drawer (Partial Credit Note):**
      * Allows returning up to `dispatchedQty - previouslyReturnedQty` per line on posted/dispatched invoices, selecting `RESALEABLE` (restocked into `StockBatch` via `SALES_RETURN`) vs `DAMAGED` (audit/scrap only), and downloading a **Credit Note PDF**.
    * **"Cancel Invoice (Credit Note)" Action:**
      * Opens Credit Note modal requiring audit cancellation rationale.
      * Creates `CreditNote`, marks invoice `CANCELLED`, and restocks only quantities that were physically dispatched.

#### C. Inward Procurement Desk (`/admin/purchases`)
* **Features & Controls:**
  * **Pending Floor GRNs Queue:** Shows `PENDING_BILLING` deliveries logged by Floor Supervisors with 1-click **"Verify & Bill GRN"** (pre-filling Supplier, Challan/Bill Ref, and lines) or **"Reject"** (`ConfirmDialog` reason prompt).
  * Purchase Register Table: Purchase Ref, Vendor Name, Bill #, Date, Items, Total Value, Paid Amount, Payment Status (`UNPAID`, `PARTIAL`, `PAID`).
  * **"+ Record Inward Purchase" Button:** Opens inward entry modal.
  * **"Record Supplier Payment" Action (Per Row):** Logs vendor payment (`SupplierPayment`) via `CASH`/`UPI`/`BANK_TRANSFER`/`CHEQUE` and updates `Purchase.paidAmount` & `paymentStatus`.
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
    * Optional Invoice selector (defaults to selected open invoice or auto-allocates FIFO across oldest unpaid invoices; displays remaining balance e.g. ₹7,875.00 and blocks overpayment beyond open balance).
    * Payment Amount input (e.g., ₹4,000.00).
    * Payment Mode dropdown: `CASH`, `UPI`, `BANK_TRANSFER`, `CHEQUE`.
    * Transaction Ref / UTR number input.
    * Notes text field.
    * **"Save Payment" Button:** Updates customer balance, allocates against pending invoice(s), and opens printable/PDF **Payment Receipt Voucher**.

#### E. Master Catalog & Settings (`/admin/masters`)
* **Features & Controls:**
  * **Items Tab:** Create/edit/deactivate (`active`) Raw Materials, Packaging, and Finished Goods with SKU code, canonical base unit (`KG`, `GRAM`, `LITRE`, `ML`, `PIECE`, `PACKET`, `CARTON`), optional `packWeightGrams`, `unitsPerCarton`, HSN code, GST %, selling price, and reorder level.
  * **Customers Tab:** Manage Retailers & Distributors with GSTIN, 2-digit State Code (`33`, `29`, etc.), address, phone, credit limit, credit days, assigned Salesman, and optional **`CustomerPrice`** SKU rate overrides.
  * **Suppliers Tab:** Manage raw/packaging suppliers with GSTIN, state code, phone, and address (soft-deactivatable via `active`).
  * **Users & Roles Tab:** Create staff accounts, assign roles, reset temporary passwords (`mustChangePassword = true`, resolving Forgot Password requests and revoking active sessions), activate/deactivate (`active` + increments `tokenVersion`), and unlock brute-force locked accounts.
  * **Company Settings Tab:** Configure factory name, GSTIN, state code (`33`), address, bank details for PDF invoices, and default BOM variance tolerance (`3.00%`).

#### F. Stock Adjustments & Expiry Alerts (`/admin/adjustments`)
* **Features & Controls:**
  * View open `StockBatch` lots with `remainingQty`, purchase rate, and expiry alerts (highlighting lots expiring within 15 days).
  * **"+ Record Stock Adjustment" Modal:** Allows Factory Admin to record physical audit write-offs or positive corrections (`STOCK_ADJUSTMENT`) with mandatory audit reason logged in `AuditLog`.

---

### 3.4 Production Floor Workspace (Floor Tablet / Desktop)

#### A. Production Dashboard (`/production`)
* **Layout:** High-contrast, large-button interface designed for factory floor tablets.
* **Features:**
  * Active BOM Recipes summary cards.
  * Today's Production Runs summary (including `IN_PROGRESS` runs awaiting completion).
  * **Production Requirement Planner Widget:** Aggregates pending/on-hold orders vs. current finished-goods stock and shows recommended batches (e.g., *"Distributor B shortfall: 32 pkts $\rightarrow$ Recommended: 1 batch of Murukku 200 g"*).
  * **Prominent Red Variance Banner:** Appears automatically if any production run in the last 24 hours experienced yield loss or ingredient consumption variance $> \pm 3\%$.
  * **Primary Action:** *"+ Start Daily Production Run"* button.

#### B. Production Run Execution Screen (`/production/new-run`)
* **Layout:** Interactive batch execution worksheet with real-time math engine.
* **Features & Controls:**
  * **BOM Recipe Selector & Batch Multiplier:** Dropdown to select recipe (e.g., *Murukku 200g*) plus batch multiplier (default `1.0` = 200 packets; supports `0.5`, `2.0`, etc., and unit-converted entry in `g`/`kg` or `ml`/`L`).
  * **Two-Step or Instant Mode:** Supports *"Start Run (Issue Materials)"* (`IN_PROGRESS`) followed by *"Complete Run"* (`COMPLETED`), or 1-step *"Save & Commit Production Run"*.
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
    * **Damaged Packaging Scrap Input:** e.g., 6 damaged pouches (system calculates `188 good + 6 damaged = 194 total pouches` deducted from `StockLedger`: `-188` `PRODUCTION_ISSUE` + `-6` `SCRAP_DAMAGE`).
    * **Cartons Used Input:** e.g., 9 outer cartons (auto-suggests `Math.floor(goodPackets / unitsPerCarton)` with manual override).
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
      * Debits raw materials & packaging from FIFO `StockBatch` lots & `StockLedger`.
      * Credits finished Murukku packets (+188) to a new `StockBatch` & `StockLedger`.
      * Saves production run record with variance flags, overhead cost breakdowns, and `AuditLog`.

#### C. Floor Goods Receipt (GRN) (`/production/receiving`)
* **Features & Controls:**
  * Log physical inward raw-material and packaging deliveries (`GRN/YY-YY/NNNN`) with supplier, challan #, batch #, and expiry date—strictly isolated from supplier pricing, GST, and payments until verified by Factory Admin.

#### D. BOM Recipe Directory & Builder (`/production/boms`)
* **Features & Controls:**
  * View all standard BOM recipes with expected yield, tolerance %, and unit cost estimate.
  * **"+ Create / Edit BOM Recipe" Modal:** Add raw material and packaging lines with flexible units (`KG`, `GRAM`, `LITRE`, `ML`, `PIECE`, `CARTON`), configure `batchSizeOutput` and `tolerancePercent`, or **Clone & Scale BOM** for a new pack size (e.g., scaling a 200 g recipe to a 500 g pack at `2.5x`).

---

### 3.5 Auditor & Accounts Portal (Read-Only)

#### A. Auditor Center (`/auditor`)
* **Layout:** Clean data workspace with unified global controls.
* **Global Controls:**
  * Date Range Filter (From Date — To Date).
  * Financial Year Selector (e.g., `2024-2025`).
  * Tab navigation across all 6 statutory statements.
  * **"Export Tally XML"** & **"Export Tally Excel"** buttons (exports Sales, Purchase, and Receipt vouchers formatted for Tally Prime import with GST duty ledgers).

#### B. Sales Register (`/auditor/sales-register`)
* **Features:**
  * View Tabs: `Invoice-Wise`, `Customer-Wise Summary`, `Product-Wise Summary`.
  * Detailed outward supplies table: Invoice #, Date, Customer Name, Customer State, GSTIN, HSN Code, Quantity, Taxable Value, CGST Amount, SGST Amount, IGST Amount, Total Invoice Value, Status.
  * Summary footer row with sum totals.
  * **"Export to Excel (XLSX)"**, **"Export to CSV"**, and **"Export PDF"** buttons.

#### C. GST Summary Report (`/auditor/gst-summary`)
* **Features:**
  * Statutory breakdown mapping directly to **GSTR-1** and **GSTR-3B** return formats:
    * Table 4: B2B Invoices (Interstate & Intrastate).
    * Table 5: B2C Large / Small Invoices.
    * Table 9B: Credit Notes issued during period.
    * Rate-wise Tax Summary (5% Taxable, CGST, SGST, IGST).
  * **"Export GSTR-1 Format (CSV / Excel)"** and **"Export PDF"** buttons.

#### D. Purchase Register (`/auditor/purchase-register`)
* **Features:**
  * Detailed inward supplier bills table: Purchase #, Bill #, Date, Supplier Name, Supplier GSTIN, State, Items, Taxable Value, Input CGST/SGST/IGST, Total Bill Value.
  * Summary footer row with sum totals.
  * **"Export Purchase Register (XLSX / CSV / PDF)"** buttons.

#### E. Stock Summary & Ledger (`/auditor/stock-ledger`)
* **Features:**
  * View Tabs: `Stock Summary (Opening + Inward - Outward = Closing)` and `Detailed Movement Ledger`.
  * Item Category Filter: `All`, `Raw Materials`, `Packaging`, `Finished Goods`.
  * Item SKU Filter Dropdown: e.g., *Flour*, *Cooking Oil*, *Murukku 200g*.
  * Transactional Movement Table: Timestamp, SKU, Batch #, Source Ref Type (`PURCHASE`, `RUN`, `INVOICE`, `CREDIT_NOTE`, `ADJUSTMENT`), Source Doc ID, Movement Type, Inward Qty (+), Outward Qty (-), Running Closing Balance, Valuation Rate (₹), Total Closing Value (₹).
  * Invariant verification check pill: *"Ledger Reconciled: 100% Mathematically Balanced"*.
  * **"Export Stock Report (XLSX / CSV / PDF)"** buttons.

#### F. Production Variance & Costing Report (`/auditor/production-report`)
* **Features:**
  * Batch-wise production table: Run #, Date, Product, Batch Multiplier, Planned vs. Actual Raw Material Consumption, Planned vs. Actual Packet Yield, Scrap/Damaged Qty, Material & Yield Variance % (with red tolerance flags), Overheads, Total Cost, and Cost per Packet.
  * **"Export Production Report (XLSX / CSV / PDF)"** buttons.

#### G. Payments, Collections & Receivables Ageing (`/auditor/receivables`)
* **Features:**
  * View Tabs: `Receivables Ageing` and `Payments & Collections Register`.
  * Debtor Ledger Table: Customer Name, State, Total Invoiced Value, Total Collections Received, Current Balance Outstanding.
  * **Ageing Analysis Columns:** `Current (0-30 days)`, `31-60 days`, `61-90 days`, `90+ days overdue`.
  * **"Export Receivables & Collections (XLSX / CSV / PDF)"** buttons.

#### H. Audit Trail Viewer (`/auditor/audit-log`)
* **Features:**
  * Filterable table by Entity Type (`ORDER`, `INVOICE`, `CREDIT_NOTE`, `PRODUCTION_RUN`, `STOCK_ADJUSTMENT`, `USER`), User, and Date Range.
  * Displays Timestamp, Actor Name & Role, Action, Document ID, Before/After JSON Diff preview, and Audit Reason.

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
