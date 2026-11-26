# UI/UX Design Specification — Nittin Order-to-Audit ERP

## 1. Design Philosophy & Aesthetic Direction

**Nittin** is an operational ERP used across outdoor retail markets (smartphones), bright billing desks (desktops), dusty factory floors (tablets), and accounting offices. The interface follows a **"Calm Utility"** aesthetic:

1. **Minimal & Uncluttered:** Warm ivory surfaces (`#FAF6EE` / `#FFFDF9`), subtle `1px` warm borders (`#E7DEC9`), generous whitespace, and full Light/Dark theme switching via `next-themes`.
2. **Consistent Across Every Role:** All 5 portals (`Salesman`, `Factory Admin`, `Production Supervisor`, `Auditor`, `Owner`) share one unified design system—identical typography, spacing, status pills, `nittin.png` emblem, toasts (`sonner`), confirmation dialogs, tables, and drawers—while adapting navigation density to the user's device.
3. **High-Contrast Legibility & Tabular Precision:** Deep espresso ink (`#23170F`) on warm cream (`#FAF6EE` / `#FFFDF9`) in Light Mode—and crisp cream ink on roasted umber (`#1C140F`) in Dark Mode—ensures outdoor and factory glare legibility. All currency (`Rs.`/`₹`), weights (`kg`/`L`), and document numbers use **`tabular-nums`** so figures align cleanly down to the paisa.
4. **Color Means Status Only:** A single warm brand palette matching the company emblem (**Roasted Brown `#78350F`** primary and **Golden Amber `#D97706`** accent) anchors primary actions; semantic reds, ambers, and blues appear **only** when conveying real operational status (stock deficits, `> ±3%` production variance, overdue/credit-limit warnings, or order states).
5. **Responsive Mobile + Desktop Everywhere:** Mobile-first thumb flows for field salesmen, tablet-friendly touch inputs for floor supervisors, and responsive table-to-card adaptation so even Admin, Auditor, and Owner screens work cleanly on phones without broken horizontal layouts.

---

## 2. Design Tokens (Color, Typography & Spacing)

### 2.1 Color Palette (Light Mode / Dark Mode Tokens)

| Token              | Light / Dark Hex          | Usage                                                    |
| :----------------- | :------------------------ | :------------------------------------------------------- |
| `--bg-canvas`      | `#FAF6EE` / `#140F0C`     | Application page background (Warm Ivory / Espresso)      |
| `--bg-surface`     | `#FFFDF9` / `#1C140F`     | Cards, tables, modals, top bar, sidebar                  |
| `--bg-subtle`      | `#F3ECE0` / `#2A1F18`     | Table headers, hover rows, secondary chips               |
| `--border-default` | `#E7DEC9` / `#3B2C22`     | `1px` structural borders & dividers                      |
| `--border-strong`  | `#D4C3A3` / `#523E30`     | Input borders & active card outlines                     |
| `--text-primary`   | `#23170F` / `#FAF4EA`     | Headings, primary values, body copy                      |
| `--text-secondary` | `#5C4738` / `#D9CBB8`     | Subtitles, table labels, secondary text                  |
| `--text-muted`     | `#856C59` / `#A89482`     | Captions, placeholders, timestamps                       |
| `--brand-primary`  | `#78350F` / `#D97706`     | Primary CTAs, active nav indicator, key links            |
| `--brand-hover`    | `#5C270A` / `#B45309`     | Primary CTA hover state                                  |
| `--brand-soft`     | `#FEF3C7` / `#3B230E`     | Active sidebar item tint & focus highlights              |
| `--accent-gold`    | `#D97706` / `#F59E0B`     | Secondary warm golden highlights                         |
| `--status-success` | `#15803D` / `#F0FDF4`     | `DISPATCHED`, `PAID`, `COMPLETED`, Stock Sufficient      |
| `--status-warning` | `#B45309` / `#FFFBEB`     | `ON_HOLD`, `PARTIAL`, `IN_PROGRESS`, Expiring Soon       |
| `--status-danger`  | `#B91C1C` / `#FEF2F2`     | Variance `> ±3%`, Stock Deficit, `CANCELLED`, `REJECTED` |
| `--status-info`    | `#78350F` / `#FEF3C7`     | `SUBMITTED`, `APPROVED`, `INVOICED`, `POSTED`            |

### 2.2 Typography

* **Primary UI Font:** `Inter` (`next/font/google`), anti-aliased.
* **Numeric / Code Font:** `JetBrains Mono` (for SKU codes, batch IDs, GSTINs, invoice/order numbers) + `font-variant-numeric: tabular-nums` across all `₹` and quantity cells.
* **Scale:**
    - Page Title: `20px` (mobile) / `24px` (desktop), `font-semibold`, `-0.02em` tracking
    - Section / Modal Title: `16px`, `font-semibold`
    - Body / Table Cell / Input: `14px`, `font-normal` (inputs `>= 16px` on mobile to prevent iOS auto-zoom)
    - Table Header / Overline: `12px`, `font-medium`, `uppercase`, `tracking-wider`, `#64748B`

### 2.3 Spacing, Radii & Elevation

* **Spacing Grid:** `4px` base (`8px` tight, `12px` form gap, `16px` card padding mobile, `20px–24px` card padding desktop).
* **Border Radius:** `8px` (`rounded-lg`) for inputs, buttons, and small alerts; `12px` (`rounded-xl`) for cards, tables, and modals; `9999px` (`rounded-full`) for status pills.
* **Shadows:** Flat-first (`border` over heavy drop shadows). Modals/drawers use subtle `shadow-lg`; cards use `shadow-xs` (`0 1px 2px rgba(15, 23, 42, 0.04)`).

---

## 3. Unified Responsive Layout Architecture

### 3.1 Breakpoint Strategy

* **Mobile (`< 768px`):** Single-column layout, `16px` horizontal padding, sticky `56px` top bar, bottom tab bar (`64px` fixed) for primary navigation + slide-out drawer for secondary pages, full-width primary buttons (`min-h-[44px]`), and **Data Tables automatically rendered as structured mobile cards**.
* **Tablet (`768px – 1023px`):** Collapsible sidebar drawer, 2-column KPI/form grids, `44px` minimum touch targets for production floor tablets.
* **Desktop (`>= 1024px`):** Collapsible ChatGPT-style left sidebar (`240px` expanded with loop-grouped headers $\leftrightarrow$ `72px` icon-only collapsed rail persisted in `localStorage`) + `56px` sticky top bar + `max-w-[1440px]` workspace container with custom theme-matched sleek scrollbars.

### 3.2 App Shell Anatomy

```text
+----------------------------------------------------------------------+
| [≡] Nittin ERP   [Section Title]        [● Online / FY 24-25] [User] |  <- Top Bar (56px)
+---------------+------------------------------------------------------+
|               |  Page Header (Title, Subtitle, Primary CTA / Export) |
|  Role Nav     |------------------------------------------------------|
|  Sidebar      |  KPI Strip (2-col mobile -> 4-col desktop)           |
|  (240px on    |------------------------------------------------------|
|   Desktop,    |  Filter Toolbar (Search, Date Range, Status Tabs)    |
|   Drawer on   |------------------------------------------------------|
|   Mobile)     |  Main Workspace (Data Table on Desktop /             |
|               |                  Stacked Cards on Mobile)            |
+---------------+------------------------------------------------------+
|   [ Home ]     [ + New Order ]     [ Orders ]     (Mobile Bottom Bar)|
+----------------------------------------------------------------------+
```

### 3.3 Navigation Map by Role

| Role                      | Primary Nav Items                                                                                    | Mobile Bottom Tabs (max 4)                |
| :------------------------ | :--------------------------------------------------------------------------------------------------- | :---------------------------------------- |
| **Salesman**              | Home, New Order, Orders & Sales                                                                      | Home, `+ New Order`, Orders               |
| **Factory Admin**         | Command Center, Orders, Invoices & Dispatch, Payments, Purchases & GRNs, Stock & Adjustments, BOM Recipes, Masters & Staff | Overview, Orders, Invoices, More (Drawer) |
| **Production Supervisor** | Floor Overview, New Batch Run, Goods Receipt (GRN), BOM Recipes                                      | Overview, `+ New Run`, GRN                |
| **Auditor**               | Overview, Sales Register, GST Summary, Purchase Register, Stock Ledger, Production Report, Receivables, Audit Trail | Overview, Registers (Drawer), Stock, Dues |
| **Owner**                 | Executive Overview, Analytics & Reports, Audit Trail, Admins & Company                               | Overview, Analytics, Team                  |

---

## 4. Shared Component System (Consistency Contract)

Every screen is built from the same core UI primitives:

1. **`AppShell`, `WorkflowPipeline` & `SetupChecklist`**: `AppShell` handles the collapsible loop-grouped sidebar (with `nittin.png` emblem), offline navigation guard (blocks dead page switches while `!online`), mobile drawer/bottom bar, top bar (`Online`/`Offline` badge + `ThemeToggle`), and Change Password drawer (hidden for `OWNER`). `WorkflowPipeline` and `SetupChecklist` provide clickable live queue strips and fresh-prod onboarding readiness across home views.
2. **`PageHeader`**: Consistent page title, concise subtitle, optional financial year/date indicator, and right-aligned action group (Roasted Brown primary button + secondary outline buttons).
3. **`StatCard`**: Label (`12px`), primary metric (`24px tabular-nums font-semibold`), and compact sub-note/trend pill. Strictly max 3 data points per card.
4. **`StatusBadge`**: Standardized semantic pill (`Submitted`, `On Hold`, `Invoiced`, `Partial Dispatch`, `Dispatched`, `Paid`, `Pending Billing`, `Verified`, `Sales Return`, `Variance Flagged`).
5. **`ResponsiveTable`:**
   * On `md+`: Surface card container, `--bg-subtle` sticky header, `44px–48px` row height, subtle row hover, right-aligned numeric columns, sticky/summary totals footer.
   * On `< md`: Renders each row as a crisp card with top row (`Doc #` + `StatusBadge`), middle key-value pairs (`Customer`, `Date`, `Amount`), and bottom full-width/flex action bar.
6. **`SlideOverDrawer`, `ConfirmDialog` & `PasswordInput`**: Clean `480px–640px` slide-overs, accessible React confirmation/reason dialogs (`ConfirmDialog` replacing browser-native `confirm()`/`prompt()`), and Eye/EyeOff password visibility inputs.
7. **`InlineAlert` & `sonner` Toasts**: Persistent bordered callouts (`InlineAlert`) strictly for operational alerts (`Shortage of 32 packets`, `Yield -6.00%`, `Credit Limit Exceeded`), paired with non-blocking `sonner` toast pop-ups for all save/error/sync feedback.

---

## 5. Screen-by-Screen UX Patterns

### 5.1 Login & Demo Entry (`/login`)

* **Layout:** Centered `420px` card on `--bg-canvas` with `nittin.png` emblem, *"Order-to-Audit Manufacturing"* subtitle, and Light/Dark `ThemeToggle`.
* **Form:** Clean Email + `PasswordInput` (Eye/EyeOff visibility toggle), *"Forgot password?"* inline reset request view, and `sonner` toast validation alerts.
* **Demo Panel (when `ENABLE_DEMO_MODE=true`):** Separated cleanly below a `Demo Access` divider as compact role chips plus a `<ConfirmDialog>`-guarded *"Load / Reset Benchmark Data"* button.

### 5.2 Salesman Mobile Portal (`/salesman`, `/salesman/new-order`, `/salesman/orders`)

* **Designed for < 60-second order entry with one thumb:**
    - **Home (`/salesman`):** Live Online/Offline sync banner (if offline orders are pending, shows *"2 orders queued • Tap to Sync"*), 3 compact KPI tiles, prominent `+ New Field Order` CTA, and recent 5 orders.
    - **New Order (`/salesman/new-order`):**

      1. Searchable **Customer Picker** (shows state code & GSTIN badge).
      2. **Product Line Cards** with large `-` `[Qty]` `+` touch steppers (`44px` hit targets), auto-loaded `CustomerPrice ?? sellingPrice`, and subtle advisory stock pill (`Available: 88 pkts`).
      3. Sticky bottom summary bar showing Taxable + GST (`CGST+SGST` or `IGST`) + Grand Total + **`Submit Order`** button.
    - **Orders (`/salesman/orders`):** Segmented toggle between **`Order History`** and **`Customer-Wise Sales`**, filter chips (`All`, `Submitted`, `On Hold`, `Invoiced`, `Dispatched`, `Offline`), and expandable order cards.

### 5.3 Factory Admin Desk (`/admin/*`)

* **Command Center (`/admin`):** 4 clean KPI cards (`Pending Orders`, `Pending Dispatches`, `Today's Billing`, `Today's Collections`), two side-by-side action queues (`Orders Awaiting Verification` & `Invoices Awaiting Dispatch`), plus low-stock/expiring batch alerts.
* **Incoming Orders (`/admin/orders`):** Table with `Verify & Process` button opening a **Verification Slide-Over**:
    - Shows requested vs. available finished stock per line item with instant green (`238 available ≥ 150`) or red (`Shortage of 32 packets: 88 available vs 120 ordered`) callout.
    - Editable quantity/price inputs (logged to `AuditLog` on save).
    - Clear decision footer: **`Approve & Raise GST Invoice`**, **`Place On Hold`** (amber), or **`Reject`** (red, asks reason).
* **Invoices & Dispatch (`/admin/invoices`):** Filterable table showing Invoice #, Place of Supply, Taxable, CGST/SGST/IGST, Total, `DispatchStatus`, and `PaymentStatus`. Row action menu provides: `Download PDF`, `WhatsApp Share`, `Record Dispatch`, `e-Invoice / e-Way JSON`, and `Cancel (Credit Note)`.
* **Purchases (`/admin/purchases`), Payments (`/admin/payments`), Adjustments (`/admin/adjustments`), Masters (`/admin/masters`):** Consistent toolbar + `ResponsiveTable` + `SlideOverDrawer` creation forms with live total previews and `AuditLog` reason prompts on sensitive edits.

### 5.4 Production Floor Workspace (`/production`, `/production/new-run`, `/production/boms`)

* **Tablet-first high-contrast layout (`44px+` inputs, large readable variance indicators):**
    - **Floor Overview (`/production`):** Prominent variance alert banner if any run in the last 24h breached `±3%`, **Production Requirement Planner** card (*"Pending orders need 120 pkts vs 88 in stock → Suggested: 1 batch"*), `IN_PROGRESS` runs list, and `+ Start Production Run` CTA.
    - **Run Execution (`/production/new-run`):** Clean 2-column desktop/tablet split (left: BOM & batch multiplier + Raw Materials Issued + Output & Packaging Scrap + Overheads; right: sticky **Live Variance & Costing Summary Card** showing live Material/Yield Variance %, Total Batch Cost `₹5,810.00`, Cost/Packet `₹30.90`, and Gross Margin `38.2%` updating on every keystroke). Supports `Start Run (Issue Materials)` or `Complete & Commit Stock`.
    - **BOM Directory (`/production/boms`):** Card/table list of recipes with `Clone & Scale` action (e.g., scaling a 200 g recipe to 500 g).

### 5.5 Auditor Portal (`/auditor/*`)

* **Strictly read-only calm workspace:**
    - Persistent **Report Filter Bar** (`AuditorFilterBar`: From Date, To Date, `Full FY`, Export Menu) with all module switching unified cleanly in the left sidebar (and clickable directory cards on `/auditor` Overview) without redundant horizontal tab duplication.
    - Clean high-density financial tables with right-aligned `tabular-nums`, sticky totals footer row, and a subtle green reconciliation badge (`Ledger Reconciled: ΣΔQ = Closing Balance`) on `/auditor/stock-ledger`.

### 5.6 Owner Control Tower (`/dashboard`, `/dashboard/reports`, `/dashboard/audit`, `/dashboard/team`)

* **Executive Overview (`/dashboard`):** Onboarding checklist, 5-stage live Operations Pipeline, 4 executive KPI cards, consolidated variance/expiry alert, prioritized Stock Watchlist, Open Customer Dues, Recent Batch Costing, and 4-row Activity Preview.
* **Analytics & Reports (`/dashboard/reports`):** Monthly (12M) & Yearly Sales vs. Purchases vs. Collections charts, Top Products/Customers mix bars, and FIFO inventory valuation breakdown.
* **Audit Trail (`/dashboard/audit`) & Governance (`/dashboard/team`):** Searchable immutable activity viewer and Factory Admin / Company GST configuration.

---

## 6. Accessibility & Interaction Polish

* **Keyboard & Focus:** Clear `2px` warm brand focus rings (`focus:border-[var(--brand-primary)]`), Escape closes modals/drawers, Enter submits active forms.
* **Touch & Field Usability:** Minimum `44×44px` tap targets on mobile/tablet controls; numeric keypads (`inputMode="numeric"` for `PIECE`/`PACKET`/`CARTON`, `inputMode="decimal"` for weights/volumes/money).
* **Feedback:** Consistent non-blocking `sonner` toast notifications across all actions, custom React `ConfirmDialog` modals for destructive/dispatch confirmations, and persistent `InlineAlert` banners strictly for live shortages, variance warnings, or credit limits.