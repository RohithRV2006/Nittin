# Business Logic & Mathematical Formulas

This document details the exact business logic, arithmetic formulas, tax rules, and inventory valuation algorithms used throughout the system.

---

## 1. Stock Ledger & Inventory Mechanics

### 1.1 The Ledger Invariant
Physical stock balance is never edited directly. The closing balance of any item at any point in time $t$ is strictly defined as:

$$\text{Closing Balance}_t = \text{Opening Balance} + \sum \text{Receipts} - \sum \text{Issues} - \sum \text{Sales} \pm \sum \text{Adjustments}$$

Every row in `StockLedger` contains a signed quantity $\Delta Q$:
* $\Delta Q > 0$ for **Inward movements** (`PURCHASE_RECEIPT`, `PRODUCTION_OUTPUT`, `STOCK_ADJUSTMENT_UP`).
* $\Delta Q < 0$ for **Outward movements** (`PRODUCTION_ISSUE`, `DISPATCH_SALE`, `SCRAP_DAMAGE`, `STOCK_ADJUSTMENT_DOWN`).

---

## 2. Inventory Valuation: FIFO (First-In, First-Out)

### 2.1 Justification for Food Manufacturing
In food processing, perishable agricultural commodities (flour, edible oils, spices) are physically and legally rotated under FIFO (or First-Expiry-First-Out) to prevent spoilage and infestation. Accounting under FIFO matches the true physical flow of raw ingredients.

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
  * Consumed: 188 pieces used for finished packets + 6 pieces damaged in sealing = 194 pieces total.
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

$$\text{Cost Per Packet} = \frac{\text{Total Run Cost}}{\text{Actual Good Packets}} = \frac{₹5,810.00}{188} = \mathbf{₹30.90\text{ per packet}}$$

*(Note: If calculated over planned 200 packets, cost would be ₹29.05/pkt, but dividing by actual good packets correctly absorbs the 6% yield loss into the unit cost).*

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

### 6.2 Ageing Buckets
Invoices are bucketed based on overdue days from `invoiceDate`:
* **0–30 Days:** Current
* **31–60 Days:** Mild overdue
* **61–90 Days:** Overdue
* **90+ Days:** Critical overdue
