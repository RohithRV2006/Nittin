# Database Architecture & Data Dictionary

## 1. Overview & Storage Engine
The Order-to-Audit ERP utilizes **PostgreSQL 16** hosted on **Neon Serverless**, managed through **Prisma ORM**. The database is designed for financial-grade consistency, strict relational integrity, and statutory audit compliance.

### Core Database Tenets:
* **The Stock Ledger as Single Source of Truth:** Stock balances are never stored as mutable numbers in the product catalog. Every inventory movement is recorded as an immutable row in the `StockLedger` table.
* **Exact Decimal Types:** All financial values use `Decimal(12, 2)` (or integer paise) and physical measurements use `Decimal(12, 3)` to guarantee zero floating-point rounding errors.
* **ACID Transactions:** Multi-entity operations (e.g., Invoice generation + Stock deduction + Order status transition) execute atomically using `prisma.$transaction`.

---

## 2. Complete Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    USER ||--o{ ORDER : "places (Salesman)"
    USER ||--o{ CUSTOMER : "assigned to"
    USER ||--o{ PRODUCTION_RUN : "supervises"
    USER ||--o{ AUDIT_LOG : "performs"
    
    CUSTOMER ||--o{ ORDER : "places"
    CUSTOMER ||--o{ INVOICE : "billed to"
    CUSTOMER ||--o{ PAYMENT : "pays"
    CUSTOMER ||--o{ CUSTOMER_PRICE : "custom rates"

    SUPPLIER ||--o{ PURCHASE : "supplies"
    SUPPLIER ||--o{ SUPPLIER_PAYMENT : "paid via"
    PURCHASE ||--|{ PURCHASE_ITEM : "contains"
    PURCHASE ||--o{ SUPPLIER_PAYMENT : "settled by"
    ITEM ||--o{ PURCHASE_ITEM : "purchased"
    ITEM ||--o{ CUSTOMER_PRICE : "priced for"
    PURCHASE_ITEM ||--o| STOCK_BATCH : "creates lot"

    ITEM ||--o{ BOM : "is finished product of"
    BOM ||--|{ BOM_ITEM : "requires"
    ITEM ||--o{ BOM_ITEM : "is raw/pack material in"

    BOM ||--o{ PRODUCTION_RUN : "executed as"
    PRODUCTION_RUN ||--|{ PRODUCTION_CONSUMPTION : "consumes materials"
    PRODUCTION_RUN ||--o| STOCK_BATCH : "produces lot"
    ITEM ||--o{ PRODUCTION_CONSUMPTION : "consumed"

    ORDER ||--|{ ORDER_ITEM : "contains"
    ITEM ||--o{ ORDER_ITEM : "ordered"
    ORDER ||--o| INVOICE : "converts to"
    INVOICE ||--|{ INVOICE_ITEM : "bills"
    INVOICE ||--o{ PAYMENT : "settled by"
    INVOICE ||--o{ CREDIT_NOTE : "reversed by"

    ITEM ||--o{ STOCK_BATCH : "stocked in batches"
    ITEM ||--o{ STOCK_LEDGER : "tracked in"
    STOCK_BATCH ||--o{ STOCK_LEDGER : "lot movements"
```

---

## 3. Data Dictionary & Table Definitions

### 3.1 `User`
Stores system accounts and role designations for access control.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` (UUID) | Primary Key | Unique user identifier. |
| `email` | `String` | Unique, Not Null | Login email address. |
| `password` | `String` | Not Null | Bcrypt hashed password. |
| `name` | `String` | Not Null | Full display name (e.g., "Salesman A", "Admin"). |
| `role` | `Role` (Enum) | Not Null | `SALESMAN`, `FACTORY_ADMIN`, `PRODUCTION_SUPERVISOR`, `AUDITOR`, `OWNER`. |
| `phone` | `String` | Nullable | Contact number for SMS / WhatsApp dispatch. |
| `active` | `Boolean` | Default: `true` | Account activation state (soft deactivation; checked on every server action). |
| `mustChangePassword` | `Boolean` | Default: `false` | True after admin password reset; prompts user to set a personal password. |
| `failedLoginAttempts` | `Int` | Default: `0` | Serverless-safe counter for brute-force lockout. |
| `lockedUntil` | `DateTime` | Nullable | Account lockout expiry timestamp after consecutive failed logins. |
| `tokenVersion` | `Int` | Default: `1` | Incremented on password reset/deactivation to revoke active JWT sessions immediately. |
| `createdAt` | `DateTime` | Default: `now()` | Timestamp of account creation. |

### 3.2 `Customer`
Holds buyers (retailers and wholesale distributors) with GST profile.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` (UUID) | Primary Key | Unique customer identifier. |
| `name` | `String` | Not Null | Business name (e.g., "Retailer A", "Distributor B"). |
| `type` | `CustomerType` | Not Null | `RETAILER` or `DISTRIBUTOR`. |
| `gstin` | `String` | Nullable | 15-character statutory GST identification number. |
| `state` | `String` | Not Null | State name (e.g., "Tamil Nadu", "Karnataka"). |
| `stateCode` | `String` | Not Null | 2-digit GST state code (`33` for TN, `29` for KA). |
| `phone` | `String` | Not Null | Primary phone for WhatsApp invoice sharing. |
| `address` | `String` | Not Null | Physical delivery and billing address. |
| `creditLimit`| `Decimal(12, 2)`| Default: `0.00` | Max authorized credit. |
| `creditDays` | `Int` | Default: `30` | Standard payment terms in days for invoice `dueDate` & ageing. |
| `assignedSalesmanId` | `String` (UUID) | FK $\rightarrow$ `User.id`, Nullable | Assigned field salesman for territory filtering. |
| `active` | `Boolean` | Default: `true` | Soft deactivation flag (masters with ledger history are never hard-deleted). |

### 3.2A `CustomerPrice` (Optional Customer-Specific Pricing)
Allows optional customer-specific rates overriding `Item.sellingPrice`.
* `id`: UUID (PK)
* `customerId`: FK $\rightarrow$ `Customer.id`
* `itemId`: FK $\rightarrow$ `Item.id`
* `customPrice`: `Decimal(12, 2)`
* `active`: `Boolean` (Default: `true`)
* Unique constraint: `@@unique([customerId, itemId])`

### 3.3 `Supplier`
Master directory of raw material and packaging vendors.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` (UUID) | Primary Key | Unique supplier identifier. |
| `name` | `String` | Not Null | Vendor company name. |
| `gstin` | `String` | Nullable | Supplier GSTIN. |
| `state` | `String` | Not Null | Supplier operating state. |
| `stateCode` | `String` | Not Null | 2-digit GST state code (`33` for TN). |
| `phone` | `String` | Nullable | Supplier contact phone. |
| `address` | `String` | Nullable | Supplier billing address. |
| `active` | `Boolean` | Default: `true` | Soft deactivation flag. |

### 3.3A `Purchase`, `PurchaseItem` & `SupplierPayment`
Inward procurement bills from suppliers for raw materials and packaging, plus vendor payment tracking.
* **`Purchase` Table:**
  * `id`: UUID (PK)
  * `purchaseNumber`: String (Unique, e.g., `PUR/2026-27/0001`)
  * `supplierId`: FK $\rightarrow$ `Supplier.id`

### 3.3B `GoodsReceipt` & `GoodsReceiptItem` (Floor Gate Intake)
Floor Supervisor inward receiving (`GRN/YY-YY/NNNN`) awaiting Factory Admin verification into a `Purchase` bill (`PENDING_BILLING`, `VERIFIED`, `REJECTED`).
* `GoodsReceipt`: `id`, `grnNumber` (Unique), `supplierId`, `challanNumber`, `receivedDate`, `status`, `receivedById`, `verifiedById`, `purchaseId` (Unique FK $\rightarrow$ `Purchase.id`), `rejectionReason`.
* `GoodsReceiptItem`: `id`, `grnId`, `itemId`, `quantity`, `unit`, `batchNumber`, `expiryDate`.
  * `billNumber`: String (Not Null, vendor invoice/bill reference)
  * `purchaseDate`: DateTime
  * `placeOfSupply`: String (Not Null)
  * `taxableAmount`: `Decimal(12, 2)`
  * `cgstAmount`: `Decimal(12, 2)`
  * `sgstAmount`: `Decimal(12, 2)`
  * `igstAmount`: `Decimal(12, 2)`
  * `totalAmount`: `Decimal(12, 2)`
  * `paidAmount`: `Decimal(12, 2)` (Default: `0.00`)
  * `paymentStatus`: `PaymentStatus` (`UNPAID`, `PARTIAL`, `PAID`; Default: `UNPAID`)
  * `createdById`: FK $\rightarrow$ `User.id`
  * `createdAt`: DateTime
* **`PurchaseItem` Table:**
  * `id`: UUID (PK)
  * `purchaseId`: FK $\rightarrow$ `Purchase.id`
  * `itemId`: FK $\rightarrow$ `Item.id`
  * `quantity`: `Decimal(12, 3)` (stored in `Item.unit`, converted from input unit if needed)
  * `unit`: `UnitType`
  * `unitRate`: `Decimal(12, 2)` (pre-tax rate per `Item.unit`, used for FIFO valuation)
  * `taxRate`: `Decimal(5, 2)`
  * `taxableAmount`: `Decimal(12, 2)`
  * `taxAmount`: `Decimal(12, 2)`
  * `totalAmount`: `Decimal(12, 2)`
  * `batchNumber`: String (Nullable, auto-generated e.g. `BATCH-PUR-001` if omitted)
  * `expiryDate`: DateTime (Nullable)
* **`SupplierPayment` Table:**
  * `id`: UUID (PK)
  * `supplierId`: FK $\rightarrow$ `Supplier.id`
  * `purchaseId`: FK $\rightarrow$ `Purchase.id` (Nullable)
  * `recordedById`: FK $\rightarrow$ `User.id`
  * `paymentDate`: DateTime
  * `amount`: `Decimal(12, 2)`
  * `paymentMode`: `PaymentMode` (`CASH`, `UPI`, `BANK_TRANSFER`, `CHEQUE`)
  * `referenceNumber`: String (Nullable)
  * `notes`: String (Nullable)

### 3.4 `Item` (Master Catalog)
Central catalog of raw materials, packaging supplies, and finished food products.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` (UUID) | Primary Key | Unique item identifier. |
| `code` | `String` | Unique, Not Null | SKU Code (`RAW-FLOUR`, `PACK-POUCH-200`, `FG-MURUKKU-200`). |
| `name` | `String` | Not Null | Descriptive item name. |
| `category` | `ItemCategory` | Not Null | `RAW_MATERIAL`, `PACKAGING`, `FINISHED_GOOD`. |
| `unit` | `UnitType` | Not Null | Base ledger unit: `KG`, `GRAM`, `LITRE`, `ML`, `PIECE`, `PACKET`, `CARTON`. |
| `packWeightGrams` | `Decimal(12, 3)` | Nullable | Net pack weight in grams for finished goods (e.g., `200.000` for 200 g Murukku; enables sharing/scaling BOMs across pack sizes like 500 g). |
| `unitsPerCarton` | `Int` | Nullable | Packets per carton (e.g., `20` for 200 g pouches/cartons) for carton $\leftrightarrow$ packet conversion. |
| `hsnCode` | `String` | Not Null | Statutory HSN classification code (e.g., `1905`). |
| `taxRate` | `Decimal(5, 2)` | Default: `5.00` | Applicable GST rate percentage. |
| `sellingPrice`| `Decimal(12, 2)`| Nullable | Unit sales price before tax (e.g., ₹50.00). |
| `reorderLevel`| `Decimal(12, 3)`| Default: `0.000`| Minimum stock threshold triggering low-stock alert. |
| `active` | `Boolean` | Default: `true` | Soft deactivation flag. |

### 3.5 `BOM` (Bill of Materials) & `BOMItem`
Recipe specifications defining standard ingredient requirements per batch.
* **`BOM` Table:**
  * `id`: UUID (PK)
  * `finishedItemId`: FK $\rightarrow$ `Item.id`
  * `name`: Recipe name (e.g., "Standard Murukku 200g Recipe")
  * `batchSizeOutput`: `Decimal(12, 3)` (Standard expected yield, e.g., 200 packets)
  * `tolerancePercent`: `Decimal(5, 2)` (Variance threshold, default `3.00%`)
  * `active`: `Boolean` (Default: `true`)
* **`BOMItem` Table:**
  * `id`: UUID (PK)
  * `bomId`: FK $\rightarrow$ `BOM.id`
  * `itemId`: FK $\rightarrow$ `Item.id` (Raw material or packaging item)
  * `standardQty`: `Decimal(12, 3)` (Standard requirement per batch, e.g., 40.0 kg flour, 10.0 L oil, 1.2 kg spices)
  * `unit`: `UnitType`

### 3.6 `ProductionRun` & `ProductionConsumption`
Records daily batch execution, actual consumption, yield, scrap, and overheads.
* **`ProductionRun` Table:**
  * `id`: UUID (PK)
  * `runNumber`: String (Unique, e.g., `PR-2024-001`)
  * `bomId`: FK $\rightarrow$ `BOM.id`
  * `supervisorId`: FK $\rightarrow$ `User.id`
  * `status`: `ProductionRunStatus` (`IN_PROGRESS`, `COMPLETED`, `CANCELLED`)
  * `batchMultiplier`: `Decimal(8, 3)` (Default: `1.000`; scales standard BOM quantities & expected yield)
  * `runDate`: DateTime
  * `completedAt`: DateTime (Nullable)
  * `plannedOutput`: `Decimal(12, 3)` (e.g., 200 packets)
  * `actualOutput`: `Decimal(12, 3)` (e.g., 188 packets)
  * `yieldVariancePercent`: `Decimal(6, 2)` (e.g., `-6.00%`)
  * `varianceFlagged`: Boolean (True if $|variance| > tolerance$)
  * `labourCost`: `Decimal(12, 2)` (Direct labour, e.g., ₹1,200.00)
  * `powerGasCost`: `Decimal(12, 2)` (Power/Gas, e.g., ₹600.00)
  * `totalMaterialCost`: `Decimal(12, 2)` (FIFO raw + packaging cost)
  * `totalRunCost`: `Decimal(12, 2)` (Total batch expenses = Materials + Packaging + Overheads)
  * `costPerPacket`: `Decimal(12, 2)` (Unit cost = `totalRunCost / actualOutput` = ₹30.90)
  * `notes`: String (Nullable)
* **`ProductionConsumption` Table:**
  * `id`: UUID (PK)
  * `productionRunId`: FK $\rightarrow$ `ProductionRun.id`
  * `itemId`: FK $\rightarrow$ `Item.id`
  * `plannedQty`: `Decimal(12, 3)` (stored in `item.unit`)
  * `actualIssuedQty`: `Decimal(12, 3)` (total physical qty deducted from stock, e.g., `10.500` L oil or `194.000` pouches = `188` good + `6` damaged)
  * `scrapDamagedQty`: `Decimal(12, 3)` (Default: `0.000`; subset of `actualIssuedQty` damaged/scrapped, e.g., `6` pouches)
  * `unitCostTotal`: `Decimal(12, 2)` (Exact FIFO valuation cost deducted for this ingredient)
  * `variancePercent`: `Decimal(6, 2)` (e.g., `+5.00%` for oil)
  * `varianceFlagged`: Boolean

### 3.7 `Order` & `OrderItem`
Field orders submitted by salesmen.
* **`Order` Table:**
  * `id`: UUID (PK)
  * `orderNumber`: String (Unique, e.g., `ORD-2024-001`)
  * `clientRequestId`: String (Unique, Nullable — idempotency key for offline PWA sync)
  * `salesmanId`: FK $\rightarrow$ `User.id`
  * `customerId`: FK $\rightarrow$ `Customer.id`
  * `orderDate`: DateTime
  * `status`: `OrderStatus` (`SUBMITTED`, `APPROVED`, `ON_HOLD`, `REJECTED`, `INVOICED`, `DISPATCHED`, `CANCELLED`)
  * `totalAmount`: `Decimal(12, 2)` (Pre-tax order total; tax finalized on Invoice)
  * `notes`: String (Nullable)
  * `rejectionReason`: String (Nullable)
* **`OrderItem` Table:**
  * `id`: UUID (PK)
  * `orderId`: FK $\rightarrow$ `Order.id`
  * `itemId`: FK $\rightarrow$ `Item.id`
  * `quantity`: `Decimal(12, 3)`
  * `unitPrice`: `Decimal(12, 2)`
  * `totalAmount`: `Decimal(12, 2)`

### 3.8 `Invoice`, `InvoiceItem` & `CreditNote`
Statutory GST Tax Invoices generated upon order approval.
* **`Invoice` Table:**
  * `id`: UUID (PK)
  * `invoiceNumber`: String (Unique, e.g., `INV/2024-25/0001`)
  * `orderId`: FK $\rightarrow$ `Order.id` (Unique)
  * `customerId`: FK $\rightarrow$ `Customer.id`
  * `createdById`: FK $\rightarrow$ `User.id`
  * `invoiceDate`: DateTime
  * `dueDate`: DateTime (Computed from `invoiceDate + customer.creditDays` for ageing)
  * `placeOfSupply`: String (e.g., "Tamil Nadu" or "Karnataka")
  * `placeOfSupplyCode`: String (2-digit GST state code, e.g., `"33"` or `"29"`)
  * `taxableAmount`: `Decimal(12, 2)` (e.g., ₹7,500.00)
  * `cgstAmount`: `Decimal(12, 2)` (e.g., ₹187.50)
  * `sgstAmount`: `Decimal(12, 2)` (e.g., ₹187.50)
  * `igstAmount`: `Decimal(12, 2)` (e.g., ₹0.00)
  * `totalAmount`: `Decimal(12, 2)` (e.g., ₹7,875.00)
  * `paidAmount`: `Decimal(12, 2)` (Default: `0.00`)
  * `paymentStatus`: `PaymentStatus` (`UNPAID`, `PARTIAL`, `PAID`; Default: `UNPAID`)
  * `status`: `InvoiceStatus` (`POSTED`, `CANCELLED`)
  * `dispatchStatus`: `DispatchStatus` (`PENDING_DISPATCH`, `PARTIALLY_DISPATCHED`, `DISPATCHED`)
  * `dispatchedAt`: DateTime (Nullable)
  * `dispatchedById`: FK $\rightarrow$ `User.id` (Nullable)
  * `eInvoiceMeta`: `Json` (Nullable — stores mocked IRN hash, AckNo, AckDt, QR payload & e-Way Bill JSON metadata)
* **`InvoiceItem` Table:**
  * `id`: UUID (PK)
  * `invoiceId`: FK $\rightarrow$ `Invoice.id`
  * `itemId`: FK $\rightarrow$ `Item.id`
  * `hsnCode`: String
  * `quantity`: `Decimal(12, 3)`
  * `dispatchedQty`: `Decimal(12, 3)` (Default: `0.000` — cumulative qty dispatched across challans)
  * `unitPrice`: `Decimal(12, 2)`
  * `taxRate`: `Decimal(5, 2)`
  * `taxableAmount`: `Decimal(12, 2)`
  * `cgstAmount`: `Decimal(12, 2)`
  * `sgstAmount`: `Decimal(12, 2)`
  * `igstAmount`: `Decimal(12, 2)`
  * `totalAmount`: `Decimal(12, 2)`
* **`DispatchChallan` & `DispatchChallanItem` Tables (Multi-Trip / Partial Dispatch):**
  * `DispatchChallan`: `id`, `challanNumber` (`CH/YY-YY/NNNN`), `invoiceId`, `dispatchedById`, `dispatchedAt`, `vehicleNumber`, `notes`.
  * `DispatchChallanItem`: `id`, `challanId`, `invoiceItemId`, `itemId`, `quantity`.
* **`CreditNote` & `CreditNoteItem` Tables (Cancellations & Sales Returns):**
  * `id`: UUID (PK)
  * `creditNoteNumber`: String (Unique, e.g., `CN/2026-27/0001`)
  * `invoiceId`: FK $\rightarrow$ `Invoice.id`
  * `type`: `CreditNoteType` (`CANCELLATION`, `SALES_RETURN`)
  * `taxableAmount`: `Decimal(12, 2)`
  * `cgstAmount`: `Decimal(12, 2)`
  * `sgstAmount`: `Decimal(12, 2)`
  * `igstAmount`: `Decimal(12, 2)`
  * `amount`: `Decimal(12, 2)`
  * `restocked`: Boolean (True if any dispatched/resaleable stock was restored)
  * `reason`: String (Documented cancellation or return explanation)
  * `issuedById`: FK $\rightarrow$ `User.id`
  * `issuedAt`: DateTime
  * `CreditNoteItem`: `id`, `creditNoteId`, `invoiceItemId`, `itemId`, `returnedQty`, `condition` (`RESALEABLE` | `DAMAGED`), `taxableAmount`, GST breakdown, `totalAmount`.

### 3.8A `PasswordResetRequest`
Tracks self-service Forgot Password requests submitted from `/login` (`PENDING`, `COMPLETED`, `CANCELLED`) until fulfilled or resolved by `FACTORY_ADMIN`.

### 3.9 `Payment`
Payment collections recorded against customer invoices.
* `id`: UUID (PK)
* `customerId`: FK $\rightarrow$ `Customer.id`
* `invoiceId`: FK $\rightarrow$ `Invoice.id` (Nullable)
* `recordedById`: FK $\rightarrow$ `User.id`
* `paymentDate`: DateTime
* `amount`: `Decimal(12, 2)` (e.g., ₹4,000.00)
* `paymentMode`: `PaymentMode` (`CASH`, `UPI`, `BANK_TRANSFER`, `CHEQUE`)
* `referenceNumber`: String (Nullable; Transaction ID / UTR)
* `notes`: String (Nullable)

### 3.10 `StockBatch` (FIFO Valuation & Expiry Lots)
Tracks individual purchase/opening/production lots so FIFO valuation and optional FEFO expiry dispatch operate atomically without scanning history.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` (UUID) | Primary Key | Unique lot identifier. |
| `batchNumber` | `String` | Unique, Not Null | Lot code (e.g., `BATCH-OPEN-FLOUR`, `BATCH-PUR-001`, `BATCH-PR-001`). |
| `itemId` | `String` | FK $\rightarrow$ `Item.id` | Inventory item. |
| `purchaseItemId` | `String` | FK $\rightarrow$ `PurchaseItem.id`, Nullable | Source purchase line if inwarded from supplier. |
| `productionRunId` | `String` | FK $\rightarrow$ `ProductionRun.id`, Nullable | Source production run if finished goods output. |
| `receivedDate` | `DateTime` | Not Null | Ordering key for FIFO consumption (`ORDER BY receivedDate ASC, createdAt ASC`). |
| `expiryDate` | `DateTime` | Nullable | Optional best-before date for food FEFO alerts/dispatch. |
| `initialQty` | `Decimal(12, 3)` | Not Null | Original lot quantity. |
| `remainingQty` | `Decimal(12, 3)` | Not Null | Unconsumed balance in this lot (`>= 0`). |
| `unitRate` | `Decimal(12, 2)` | Not Null | Unit cost of this batch (e.g., ₹42.00 or ₹45.00). |
| `createdAt` | `DateTime` | Default: `now()` | Timestamp of lot creation. |

### 3.11 `StockLedger` (The Core Inventory Engine)
Every physical inventory increment or decrement writes an immutable row here.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` (UUID) | Primary Key | Unique ledger transaction identifier. |
| `timestamp` | `DateTime` | Default: `now()` | Exact time movement was committed. |
| `itemId` | `String` | FK $\rightarrow$ `Item.id` | Inventory item moved. |
| `batchId` | `String` | FK $\rightarrow$ `StockBatch.id`, Nullable | Specific FIFO/FEFO batch debited or credited. |
| `movementType` | `MovementType` | Not Null | `OPENING_BALANCE`, `PURCHASE_RECEIPT`, `PRODUCTION_ISSUE`, `PRODUCTION_OUTPUT`, `DISPATCH_SALE`, `SALES_RETURN`, `SCRAP_DAMAGE`, `STOCK_ADJUSTMENT`. |
| `quantity` | `Decimal(12, 3)` | Signed | **Positive** for additions, **Negative** for reductions. |
| `unit` | `UnitType` | Not Null | Base unit of measure (`Item.unit`). |
| `referenceType` | `RefType` | Not Null | `OPENING`, `PURCHASE`, `PRODUCTION_RUN`, `INVOICE`, `DISPATCH_CHALLAN`, `CREDIT_NOTE`, `GRN`, `ADJUSTMENT`. |
| `referenceId` | `String` | Not Null | Foreign ID of the source transaction document. |
| `balanceAfter` | `Decimal(12, 3)` | Not Null | Snapshot of running closing balance post-transaction. |
| `unitRate` | `Decimal(12, 2)` | Nullable | Valuation unit cost under FIFO. |
| `totalValue` | `Decimal(12, 2)` | Nullable | Total transactional financial value (`quantity * unitRate`). |
| `createdById` | `String` | FK $\rightarrow$ `User.id`, Nullable | User who triggered the movement. |
| `notes` | `String` | Nullable | Reason for manual adjustments or scrap details. |

### 3.12 `AuditLog` (Statutory Edit & Action Trail)
Captures every edit to orders, invoices, production runs, masters, and cancellations with user and timestamp.
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `String` (UUID) | Primary Key | Unique audit entry ID. |
| `entityType` | `String` | Not Null | `ORDER`, `INVOICE`, `CREDIT_NOTE`, `PRODUCTION_RUN`, `PURCHASE`, `ITEM`, `BOM`, `CUSTOMER`, `STOCK_ADJUSTMENT`. |
| `entityId` | `String` | Not Null | Record ID modified. |
| `action` | `String` | Not Null | `CREATE`, `UPDATE`, `APPROVE`, `REJECT`, `CANCEL`, `DISPATCH`, `ADJUST`. |
| `userId` | `String` | FK $\rightarrow$ `User.id` | User who performed the action. |
| `changes` | `Json` | Nullable | Before/after diff snapshot. |
| `reason` | `String` | Nullable | Explanation (mandatory on cancellations/adjustments/overrides). |
| `createdAt` | `DateTime` | Default: `now()` | Timestamp of audit event. |

### 3.13 `CompanySettings` & `DocumentSequence`
Eliminates hardcoded factory configuration and guarantees gap-free financial-year document numbering.
* **`CompanySettings`:** `companyName`, `gstin`, `state`, `stateCode` (default `"33"`), `address`, `phone`, `defaultTolerancePercent` (`3.00`), `bankDetails` (printed on GST PDFs).
* **`DocumentSequence`:** `docType` (`ORDER`, `INVOICE`, `CREDIT_NOTE`, `PRODUCTION_RUN`, `PURCHASE`), `financialYear` (e.g. `"2024-25"`), `lastSequence` (`Int`, incremented atomically inside `prisma.$transaction`).

---

## 4. Indexing Strategy & Query Optimization

To ensure sub-second response times on reports and prevent table scans as ledger rows grow:
1. **`StockLedger` Compound Index:**
   `@@index([itemId, timestamp(sort: Desc)])`
   * Accelerates instant closing balance calculations and stock ledger timeline queries.
2. **`StockLedger` Reference Lookup:**
   `@@index([referenceType, referenceId])`
   * Speeds up source-document traceability lookups (e.g., viewing all movements created by `PR-2024-001`).
3. **`Invoice` Date Range & Customer Index:**
   `@@index([customerId, invoiceDate])`
   `@@index([status, invoiceDate])`
   * Optimizes GSTR-1 outward supply summaries and customer aging calculations.
4. **`Order` Queue Index:**
   `@@index([status, orderDate(sort: Desc)])`
   * Powers the factory admin incoming order queue.

---

## 5. Ledger Invariants & SQL Verification Queries

### Invariant 1: Stock Ledger Reconciliation
The derived stock balance of any item must strictly match the sum of signed quantities:
```sql
SELECT 
    i.code, 
    i.name, 
    COALESCE(SUM(sl.quantity), 0) AS calculated_closing_balance
FROM "Item" i
LEFT JOIN "StockLedger" sl ON i.id = sl."itemId"
GROUP BY i.id, i.code, i.name;
```

### Invariant 2: Customer Debtors & Outstanding Balance
Customer outstanding balance must equal posted invoices minus confirmed collections. Invoices and payments are aggregated in separate CTEs to avoid a many-to-many Cartesian product when a customer has multiple invoices and multiple payments:
```sql
WITH posted_invoices AS (
    SELECT "customerId", COALESCE(SUM("totalAmount"), 0) AS invoiced_total
    FROM "Invoice"
    WHERE status = 'POSTED'
    GROUP BY "customerId"
),
customer_payments AS (
    SELECT "customerId", COALESCE(SUM(amount), 0) AS paid_total
    FROM "Payment"
    GROUP BY "customerId"
)
SELECT
    c.id,
    c.name,
    COALESCE(pi.invoiced_total, 0) - COALESCE(cp.paid_total, 0) AS total_receivable
FROM "Customer" c
LEFT JOIN posted_invoices pi ON c.id = pi."customerId"
LEFT JOIN customer_payments cp ON c.id = cp."customerId";
```

### Invariant 3: FIFO Batch Balance Reconciliation
For every item, the sum of unconsumed batch quantities must equal its `StockLedger` closing balance:
```sql
SELECT
    i.code,
    COALESCE(SUM(sb."remainingQty"), 0) AS batch_total
FROM "Item" i
LEFT JOIN "StockBatch" sb ON i.id = sb."itemId"
GROUP BY i.id, i.code;
```

---

## 6. Benchmark Seed Script Architecture (`prisma/seed.ts`)

The database architecture features an automated seed script that loads the exact Section 5 benchmark data:
1. **Cleans database tables** in reverse foreign-key order.
2. **Seeds 5 Roles:** Salesman A, Salesman B, Factory Admin, Floor Supervisor, Auditor, Owner.
3. **Seeds Customers:** Retailer A (Tamil Nadu, state code `33`), Distributor B (Karnataka, state code `29`).
4. **Seeds Items:** Flour, Cooking Oil, Spice Mix, 200g Pouch, Outer Carton, Finished Murukku 200g.
5. **Seeds BOM Recipe:** Murukku 200g standard recipe (40kg flour, 10L oil, 1.2kg spices, 200 pouches, 10 cartons $\rightarrow$ 200 packets yield).
6. **Seeds Opening Inventory in `StockLedger`:** 100 kg flour, 30 L oil, 5 kg spices, 500 pouches, 30 cartons, 50 packets Murukku 200g.
