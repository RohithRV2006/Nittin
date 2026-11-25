export interface TallyInvoiceInput {
  invoiceNumber: string;
  date: string; // YYYY-MM-DD
  partyName: string;
  partyGstin: string | null;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalAmount: string;
}

export interface TallyPurchaseInput {
  purchaseNumber: string;
  billNumber: string;
  date: string; // YYYY-MM-DD
  supplierName: string;
  supplierGstin: string | null;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalAmount: string;
}

export interface TallyReceiptInput {
  receiptRef: string;
  date: string; // YYYY-MM-DD
  customerName: string;
  paymentMode: string;
  amount: string;
  invoiceNumber: string | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tallyDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

function ledgerEntryXml(ledgerName: string, isDeemedPositive: boolean, amount: string): string {
  const signedAmount = isDeemedPositive ? `-${amount}` : amount;
  return `          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(ledgerName)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${isDeemedPositive ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
            <AMOUNT>${signedAmount}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>`;
}

/**
 * Generates Tally Prime compatible XML import envelope containing Sales, Purchase,
 * and Receipt vouchers with GST duty ledgers.
 */
export function generateTallyXml(params: {
  companyName: string;
  invoices: TallyInvoiceInput[];
  purchases: TallyPurchaseInput[];
  receipts: TallyReceiptInput[];
}): string {
  const messages: string[] = [];

  for (const inv of params.invoices) {
    const entries: string[] = [
      ledgerEntryXml(inv.partyName, true, inv.totalAmount),
      ledgerEntryXml("Sales Account", false, inv.taxableAmount),
    ];
    if (Number(inv.cgstAmount) > 0) {
      entries.push(ledgerEntryXml("Output CGST", false, inv.cgstAmount));
    }
    if (Number(inv.sgstAmount) > 0) {
      entries.push(ledgerEntryXml("Output SGST", false, inv.sgstAmount));
    }
    if (Number(inv.igstAmount) > 0) {
      entries.push(ledgerEntryXml("Output IGST", false, inv.igstAmount));
    }

    messages.push(`      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Sales" ACTION="Create">
          <DATE>${tallyDate(inv.date)}</DATE>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${escapeXml(inv.invoiceNumber)}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${escapeXml(inv.partyName)}</PARTYLEDGERNAME>
          <PARTYGSTIN>${escapeXml(inv.partyGstin ?? "")}</PARTYGSTIN>
${entries.join("\n")}
        </VOUCHER>
      </TALLYMESSAGE>`);
  }

  for (const pur of params.purchases) {
    const entries: string[] = [
      ledgerEntryXml(pur.supplierName, false, pur.totalAmount),
      ledgerEntryXml("Purchase Account", true, pur.taxableAmount),
    ];
    if (Number(pur.cgstAmount) > 0) {
      entries.push(ledgerEntryXml("Input CGST", true, pur.cgstAmount));
    }
    if (Number(pur.sgstAmount) > 0) {
      entries.push(ledgerEntryXml("Input SGST", true, pur.sgstAmount));
    }
    if (Number(pur.igstAmount) > 0) {
      entries.push(ledgerEntryXml("Input IGST", true, pur.igstAmount));
    }

    messages.push(`      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Purchase" ACTION="Create">
          <DATE>${tallyDate(pur.date)}</DATE>
          <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${escapeXml(pur.purchaseNumber)}</VOUCHERNUMBER>
          <REFERENCE>${escapeXml(pur.billNumber)}</REFERENCE>
          <PARTYLEDGERNAME>${escapeXml(pur.supplierName)}</PARTYLEDGERNAME>
          <PARTYGSTIN>${escapeXml(pur.supplierGstin ?? "")}</PARTYGSTIN>
${entries.join("\n")}
        </VOUCHER>
      </TALLYMESSAGE>`);
  }

  for (const rec of params.receipts) {
    const debitLedger = rec.paymentMode === "CASH" ? "Cash" : "Bank Account";
    const entries: string[] = [
      ledgerEntryXml(debitLedger, true, rec.amount),
      ledgerEntryXml(rec.customerName, false, rec.amount),
    ];

    messages.push(`      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Receipt" ACTION="Create">
          <DATE>${tallyDate(rec.date)}</DATE>
          <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${escapeXml(rec.receiptRef)}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${escapeXml(rec.customerName)}</PARTYLEDGERNAME>
          <NARRATION>${escapeXml(
            rec.invoiceNumber ? `Against ${rec.invoiceNumber}` : "On Account"
          )}</NARRATION>
${entries.join("\n")}
        </VOUCHER>
      </TALLYMESSAGE>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${escapeXml(params.companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${messages.join("\n")}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function generateTallyExcelRows(params: {
  invoices: TallyInvoiceInput[];
  purchases: TallyPurchaseInput[];
  receipts: TallyReceiptInput[];
}): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [];

  for (const inv of params.invoices) {
    rows.push([
      inv.date,
      "Sales",
      inv.invoiceNumber,
      inv.partyName,
      inv.partyGstin ?? "URP",
      "Sales Account",
      Number(inv.taxableAmount),
      Number(inv.cgstAmount),
      Number(inv.sgstAmount),
      Number(inv.igstAmount),
      Number(inv.totalAmount),
    ]);
  }

  for (const pur of params.purchases) {
    rows.push([
      pur.date,
      "Purchase",
      pur.purchaseNumber,
      pur.supplierName,
      pur.supplierGstin ?? "URP",
      `Bill: ${pur.billNumber}`,
      Number(pur.taxableAmount),
      Number(pur.cgstAmount),
      Number(pur.sgstAmount),
      Number(pur.igstAmount),
      Number(pur.totalAmount),
    ]);
  }

  for (const rec of params.receipts) {
    rows.push([
      rec.date,
      "Receipt",
      rec.receiptRef,
      rec.customerName,
      "",
      `${rec.paymentMode}${rec.invoiceNumber ? ` (${rec.invoiceNumber})` : ""}`,
      0,
      0,
      0,
      0,
      Number(rec.amount),
    ]);
  }

  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return rows;
}
