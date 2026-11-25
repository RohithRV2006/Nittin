# Business Logic & Mathematical Formulas

This document details the exact business logic, arithmetic formulas, tax rules, and inventory valuation algorithms used throughout the system.

---

## 1. Stock Ledger & Inventory Mechanics

### 1.1 The Ledger Invariant & Precision Arithmetic
Physical stock balance is never edited directly. The closing balance of any item at any point in time $t$ is strictly defined as:

$$\text{Closing Balance}_t = \text{Opening Balance} + \sum \text{Receipts} - \sum \text{Issues} - \sum \text{Sales} \pm \sum \text{Adjustments}$$

Every row in `StockLedger` contains a signed quantity $\Delta Q$:
* $\Delta Q > 0$ for **Inward movements** (`OPENING_BALANCE`, `PURCHASE_RECEIPT`, `PRODUCTION_OUTPUT`, `STOCK_ADJUSTMENT`).
* $\Delta Q < 0$ for **Outward movements** (`PRODUCTION_ISSUE`, `DISPATCH_SALE`, `SCRAP_DAMAGE`, `STOCK_ADJUSTMENT`).

**Zero-Float Server Math:** All monetary and physical calculations in TypeScript/Node.js must use `decimal.js` / `Prisma.Decimal` (never IEEE-754 JS `number` arithmetic) with `ROUND_HALF_UP` rounding (`2` decimal places for ₹ currency, `3` decimal places for quantities).

### 1.2 Unit Conversion & Pack-Size Scaling Rules
All `StockLedger` and `StockBatch` balances for an item are stored in that item's canonical base `Item.unit`, while forms and BOMs accept compatible units via deterministic conversions:
* **Mass:** $1\text{ kg} = 1{,}000\text{ g}$ (`KG` $\leftrightarrow$ `GRAM`)
* **Volume:** $1\text{ L} = 1{,}000\text{ ml}$ (`LITRE` $\leftrightarrow$ `ML`)
* **Packaging / Count:** $1\text{ carton} = \text{Item.unitsPerCarton packets}$ (e.g., $1\text{ carton} = 20\text{ packets}$ for Murukku 200 g)
* **Shared BOM / Multi-Pack Scaling:** If a new pack size (e.g., Murukku 500 g) references a base recipe, raw ingredient quantities scale linearly by weight ratio ($\frac{\text{PackWeight}_2}{\text{PackWeight}_1} = \frac{500}{200} = 2.5\times$) or via `ProductionRun.batchMultiplier`.

---

## 2. Inventory Valuation: FIFO (First-In, First-Out)

### 2.1 Justification & Atomic Batch Mechanics
In food processing, perishable agricultural commodities (flour, edible oils, spices) are physically and legally rotated under FIFO (or First-Expiry-First-Out when expiry dates are present) to prevent spoilage and infestation. Accounting under FIFO matches the true physical flow of raw ingredients.

Every inward receipt (`OPENING_BALANCE`, `PURCHASE_RECEIPT`, `PRODUCTION_OUTPUT`) creates a `StockBatch` row with `remainingQty` and `unitRate`. On every outward deduction inside `prisma.$transaction`, the engine locks open `StockBatch` rows ordered by `receivedDate ASC, createdAt ASC`, consumes across as many lots as needed (splitting `StockLedger` rows per batch if a single issue spans two purchase rates), and decrements `StockBatch.remainingQty` atomically.

### 2.2 Trace for the Benchmark Scenario (Section 5)

#### 1. Flour Inventory Ledger
* **Opening Stock:** 100 kg @ ₹42.00/kg (Batch `BATCH-OPEN-FLOUR`, total value = ₹4,200.00)
* **Step 1 Purchase:** 60 kg @ ₹45.00/kg (Batch `BATCH-PUR-001`, total value = ₹2,700.00)
  * Cumulative Stock: 160 kg.
* **Step 2 Production Run Issue:** 40 kg issued to Murukku 200g run.
  * FIFO consumption takes 40 kg from the oldest batch (`BATCH-OPEN-FLOUR`).
  * Unit cost applied: ₹42.00/kg.
  * Value of flour consumed: $40 \times 42 = \mathbf{₹1,680.00}$.
  * Remaining Opening Batch: 60 kg @ ₹42.00/kg.
  * **Flour Closing Balance:** $100 + 60 - 40 = \mathbf{120.000\text{ kg}}$ (60 kg @ ₹42 + 60 kg @ ₹45 = ₹5,220.00).

#### 2. Cooking Oil Ledger
* **Opening Stock:** 30 L @ ₹140.00/L.
* **Production Issue:** 10.5 L issued @ ₹140.00/L.
* **Value of Oil Consumed:** $10.5 \times 140 = \mathbf{₹1,470.00}$.
* **Oil Closing Balance:** $30 - 10.5 = \mathbf{19.500\text{ L}}$ (Value = ₹2,730.00).

#### 3. Salt & Spice Mix Ledger
* **Opening Stock:** 5.0 kg @ ₹200.00/kg.
* **Production Issue:** 1.2 kg issued @ ₹200.00/kg.
* **Value of Spice Consumed:** $1.2 \times 200 = \mathbf{₹240.00}$.
* **Spice Mix Closing Balance:** $5.0 - 1.2 = \mathbf{3.800\text{ kg}}$ (Value = ₹760.00).

#### 4. Packaging Materials Ledger
* **200g Pouches:**
  * Opening Stock: 500 pieces @ ₹2.50/piece.
  * Consumed: `ProductionConsumption.actualIssuedQty = 194` pieces (`188` good packets logged as `PRODUCTION_ISSUE` + `6` damaged pouches logged as `SCRAP_DAMAGE` with `scrapDamagedQty = 6`).
  * Value Consumed: $194 \times 2.50 = \mathbf{₹485.00}$.
  * **Pouches Closing Balance:** $500 - 194 = \mathbf{306\text{ pieces}}$ (Value = ₹765.00).
* **Cartons (Holds 20 packets):**
  * Opening Stock: 30 pieces @ ₹15.00/piece.
  * Consumed: 9 pieces used for packing the 188 packets (9 cartons $\times$ 20 = 180 capacity + 8 loose).
  * Value Consumed: $9 \times 15.00 = \mathbf{₹135.00}$.
  * **Cartons Closing Balance:** $30 - 9 = \mathbf{21\text{ pieces}}$ (Value = ₹315.00).

#### 5. Finished Goods (Murukku 200g) Ledger
* **Opening Stock:** 50 packets @ ₹50.00 selling price.
* **Step 3 Production Output:** +188 packets.
  * Stock after production: $50 + 188 = \mathbf{238\text{ packets}}$.
* **Step 5 Dispatch to Retailer A:** -150 packets.
  * **Closing Finished Goods Stock:** $238 - 150 = \mathbf{88\text{ packets}}$.

---

## 3. Production BOM & Variance Formulas

### 3.1 Yield Variance Formula
The yield variance measures production output efficiency against standard BOM recipe expectations:

$$\text{Yield Variance \%} = \left( \frac{\text{Actual Output Packets} - \text{Planned Standard Packets}}{\text{Planned Standard Packets}} \right) \times 100$$

* Planned Standard Output: $200\text{ packets}$.
* Actual Output: $188\text{ packets}$.
* **Yield Variance \%:**
  $$\text{Yield Variance} = \left( \frac{188 - 200}{200} \right) \times 100 = \mathbf{-6.00\%}$$
* **Variance Alert Rule:** Since $|-6.00\%| > 3.00\%$ (standard tolerance), the system flags a **Negative Yield Variance Alert (Scrap/Loss warning)**.

### 3.2 Material Consumption Variance Formula
For each raw material issued:

$$\text{Consumption Variance \%} = \left( \frac{\text{Actual Issued Qty} - \text{Planned Standard Qty}}{\text{Planned Standard Qty}} \right) \times 100$$

* **Cooking Oil Example:**
  * Planned Standard = $10.000\text{ L}$.
  * Actual Issued = $10.500\text{ L}$.
  * Consumption Variance \%:
    $$\text{Oil Variance} = \left( \frac{10.5 - 10.0}{10.0} \right) \times 100 = \mathbf{+5.00\%}$$
  * Since $|+5.00\%| > 3.00\%$, the system flags an **Excess Consumption Alert**.
* **Flour:**
  * Planned = $40.0\text{ kg}$, Actual = $40.0\text{ kg} \rightarrow \mathbf{0.00\%}$ (Normal).
* **Spice Mix:**
  * Planned = $1.2\text{ kg}$, Actual = $1.2\text{ kg} \rightarrow \mathbf{0.00\%}$ (Normal).

---

## 4. Costing & Overhead Allocation

### 4.1 Cost Composition per Production Run
Total batch cost is the sum of Direct Raw Materials + Direct Packaging + Allocated Overheads:

$$\text{Total Batch Cost} = \text{Raw Material Cost} + \text{Packaging Cost} + \text{Direct Overheads}$$

| Cost Category | Component | Computation | Total (₹) |
| :--- | :--- | :--- | :--- |
| **Raw Materials** | Flour (FIFO) | $40\text{ kg} \times ₹42.00$ | 1,680.00 |
| | Cooking Oil | $10.5\text{ L} \times ₹140.00$ | 1,470.00 |
| | Salt & Spice Mix | $1.2\text{ kg} \times ₹200.00$ | 240.00 |
| | *Raw Material Subtotal* | | **3,390.00** |
| **Packaging** | 200g Pouches (Good + Damaged) | $194\text{ pcs} \times ₹2.50$ | 485.00 |
| | Outer Cartons | $9\text{ pcs} \times ₹15.00$ | 135.00 |
| | *Packaging Subtotal* | | **620.00** |
| **Overheads** | Direct Labour | Recorded run expense | 1,200.00 |
| | Power & Gas | Recorded run expense | 600.00 |
| | *Overheads Subtotal* | | **1,800.00** |
| **Total Run Cost** | | | **₹5,810.00** |

### 4.2 Cost Per Packet Computation
* **Overhead Allocation Rule:** Direct costing method allocating 100% of the batch expenses across the **actual marketable finished packets (188 packets)**.

$$\text{Cost Per Packet} = \frac{\text{Total Run Cost}}{\text{Actual Good Packets}} = \frac{₹5,810.00}{188} = 30.9042\ldots \rightarrow \mathbf{₹30.90\text{ per packet}}$$

*(Computed with `Decimal` arithmetic and rounded `ROUND_HALF_UP` to 2 decimal places. Note: If calculated over planned 200 packets, cost would be ₹29.05/pkt, but dividing by actual good packets correctly absorbs the 6% yield loss into the unit cost).*

* **Production Run Lifecycle (1-Step or 2-Step) & Zero-Yield Guard:**
  * Supervisors can either **Complete Immediately** (issuing materials and logging actual output in one atomic transaction) or **Start Run (`IN_PROGRESS`)** (issuing raw materials immediately to `StockLedger`) and **Complete Run (`COMPLETED`)** later (logging output, scrap, packaging, overheads, and finished-goods receipt without double-deducting already-issued raw materials).
  * If an `IN_PROGRESS` run is aborted (`CANCELLED`), any already-issued raw materials are returned via compensating `STOCK_ADJUSTMENT` entries into `StockBatch`/`StockLedger` with an `AuditLog` entry.
  * **Zero-Yield Division Guard:** If `actualOutput === 0` (total batch loss), `costPerPacket` is recorded as `null` (`N/A`) rather than dividing by zero, and no finished-goods `StockBatch` is created.

* **Unit Gross Margin:**
  * Selling Price: ₹50.00
  * Cost: ₹30.90
  * **Unit Gross Profit:** $₹50.00 - ₹30.90 = \mathbf{₹19.10\text{ per packet}}$
  * **Gross Margin \%:** $(19.10 / 50.00) \times 100 = \mathbf{38.20\%}$.

---

## 5. GST Billing & Tax Calculations

### 5.1 Place of Supply Rules
* **Factory Origin:** Tamil Nadu (State Code: `33`).
* **Intra-State Supply (Buyer in TN):**
  * GST Rate = 5%
  * Split: $\text{CGST} = 2.5\%$, $\text{SGST} = 2.5\%$.
* **Inter-State Supply (Buyer outside TN, e.g., Karnataka `29`):**
  * GST Rate = 5%
  * Tax: $\text{IGST} = 5.0\%$.

### 5.2 Benchmark Step 5: Retailer A (Tamil Nadu)
* Quantity: 150 packets @ ₹50.00/packet.
* **Taxable Value:** $150 \times 50.00 = \mathbf{₹7,500.00}$
* **CGST (2.5%):** $7,500.00 \times 0.025 = \mathbf{₹187.50}$
* **SGST (2.5%):** $7,500.00 \times 0.025 = \mathbf{₹187.50}$
* **Total Tax Invoice Amount:** $7,500.00 + 187.50 + 187.50 = \mathbf{₹7,875.00}$

### 5.3 Benchmark Step 6: Distributor B (Karnataka) Stock Sufficiency Check
* Current Available Finished Goods = 88 packets.
* Ordered Quantity = 120 packets.
* **Stock Check:** $88 < 120 \rightarrow$ **Insufficient Stock!**
* **Shortage Flagged:** $120 - 88 = \mathbf{32\text{ packets shortage}}$.
* If invoiced upon stock availability: Inter-state IGST at 5% applies ($120 \times 50 \times 5\% = ₹300.00\text{ IGST}$).

---

## 6. Accounts Receivable & Ageing

### 6.1 Customer Balance Formula

$$\text{Outstanding Balance} = \sum \text{Posted Invoices Total} - \sum \text{Approved Payments}$$

* **Retailer A Ledger:**
  * Step 5 Invoice Raised: ₹7,875.00
  * Step 7 Payment Received: ₹4,000.00
  * **Retailer A Outstanding Balance:** $7,875.00 - 4,000.00 = \mathbf{₹3,875.00}$

### 6.2 Ageing Buckets & Payment Allocation
* **Customer-Specific Pricing:** Order unit price resolves as `CustomerPrice.customPrice ?? Item.sellingPrice` (server-verified on submit).
* **Payment Allocation:** Recording a customer `Payment` atomically increments `Invoice.paidAmount` (if linked to an invoice, capped at remaining invoice balance to prevent accidental overpayment drift) and updates `Invoice.paymentStatus` (`UNPAID` $\rightarrow$ `PARTIAL` $\rightarrow$ `PAID`).
* **Ageing Buckets:** Invoices are bucketed by age from `invoiceDate` (and overdue days past `dueDate = invoiceDate + customer.creditDays`):
  * **0–30 Days:** Current
  * **31–60 Days:** Mild overdue
  * **61–90 Days:** Overdue
  * **90+ Days:** Critical overdue

---

## 7. Invoice Cancellation & Credit Note Reversal Rule

Posted GST invoices are never deleted (`DELETE` is prohibited). Reversing an invoice creates a `CreditNote` (`CN/YYYY-YY/XXXX`), sets `Invoice.status = 'CANCELLED'`, and writes an `AuditLog` entry:
* **Case A — Invoice Already Dispatched (`Invoice.dispatchStatus === 'DISPATCHED'`):** Physical finished goods already left the warehouse, so the transaction atomically writes a compensating positive `StockLedger` entry (`STOCK_ADJUSTMENT`, `referenceType: 'CREDIT_NOTE'`) to restock the returned quantity and sets `CreditNote.restocked = true`.
* **Case B — Invoice Not Yet Dispatched (`Invoice.dispatchStatus === 'PENDING_DISPATCH'`):** Goods never left the warehouse, so **no** `StockLedger` entry is written (`CreditNote.restocked = false`), preventing phantom inventory creation.

---

## 8. Production Requirement Planning Helper

To assist floor scheduling from pending demand (`SUBMITTED`, `APPROVED`, and `ON_HOLD` orders):

$$\text{Net Deficit}_p = \max\left(0,\; \text{Pending Ordered Qty}_p - \text{Available Finished Stock}_p\right)$$

$$\text{Recommended Batches}_p = \left\lceil \frac{\text{Net Deficit}_p}{\text{BOM.batchSizeOutput}_p} \right\rceil$$

*(Example: Distributor B orders 120 packets while 88 packets are in stock $\rightarrow$ Net Deficit = 32 packets $\rightarrow$ Recommended = $\lceil 32 / 200 \rceil = \mathbf{1\text{ batch}}$ of Murukku 200 g).*

---

## 9. Tally Export & Mocked NIC e-Invoice / e-Way Bill Schemas

### 9.1 Tally-Compatible Export (XML & Excel)
* **Tally Prime XML (`<ENVELOPE><BODY><IMPORTDATA>`):** Generates standard `<TALLYMESSAGE>` vouchers (`VCHTYPE="Sales"`, `VCHTYPE="Purchase"`, `VCHTYPE="Receipt"`) mapping party ledgers, taxable sales/purchase ledgers, and statutory GST duty ledgers (`Output CGST`, `Output SGST`, `Output IGST`, `Input CGST`, `Input SGST`, `Input IGST`).
* **Tally Excel Format:** Flat tabular voucher sheet (`Date`, `Voucher Type`, `Voucher No`, `Party Ledger`, `GSTIN`, `Item`, `Qty`, `Rate`, `Taxable`, `CGST`, `SGST`, `IGST`, `Total`) ready for direct Tally Excel import utilities.

### 9.2 Mocked e-Invoice (IRN) & e-Way Bill JSON Export
* **NIC GST e-Invoice Schema (`Version: "1.1"`):** Produces compliant JSON payload (`TranDtls`, `DocDtls`, `SellerDtls`, `BuyerDtls`, `ItemList` with HSN/qty/tax splits, `ValDtls`) along with mocked government acknowledgement metadata (`Irn`: deterministic SHA-256 hash of `SellerGSTIN + FY + InvoiceNo`, `AckNo`, `AckDt`, and `SignedQRCode` payload).
* **e-Way Bill JSON Schema:** Generates NIC e-Way Bill transport payload (`supplyType: "O"`, `subSupplyType: "1"`, `fromGstin`, `toGstin`, `toPincode`, `hsnCode`, `totalValue`, `cgstValue`, `sgstValue`, `igstValue`, `transMode`, `vehicleNo`).
