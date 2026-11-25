import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PrintableInvoice {
  invoiceNumber: string;
  orderNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  dispatchStatus: string;
  placeOfSupply: string;
  placeOfSupplyCode: string;
  seller: {
    companyName: string;
    gstin: string;
    address: string;
    state: string;
    stateCode: string;
    phone: string | null;
    bankDetails: string | null;
  };
  buyer: {
    name: string;
    gstin: string | null;
    address: string;
    state: string;
    stateCode: string;
    phone: string;
  };
  items: Array<{
    itemName: string;
    hsnCode: string;
    quantity: string;
    unit: string;
    unitPrice: string;
    taxRate: string;
    taxableAmount: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    totalAmount: string;
  }>;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalAmount: string;
  paidAmount: string;
  irn?: string | null;
}

/**
 * Formats INR strictly using ASCII "Rs. " because jsPDF built-in Helvetica uses
 * WinAnsi encoding where Unicode ₹ causes broken glyphs and text-width clipping.
 */
export function formatPdfRs(value: string | number): string {
  const num = Number(value);
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(num) ? num : 0);
  return `Rs. ${formatted}`;
}

export async function loadLogoDataUrl(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/nittin.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadGstInvoicePdf(inv: PrintableInvoice) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const logo = await loadLogoDataUrl();

  const textLeftX = logo ? 34 : 14;
  if (logo) {
    doc.addImage(logo, "PNG", 14, 12, 16, 16);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(35, 23, 15);
  doc.text(inv.seller.companyName, textLeftX, 17, { maxWidth: 102 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(92, 71, 56);
  doc.text(
    `GSTIN: ${inv.seller.gstin} | State: ${inv.seller.state} (${inv.seller.stateCode})`,
    textLeftX,
    23
  );
  doc.text(inv.seller.address, textLeftX, 28, { maxWidth: 102 });
  if (inv.seller.phone) {
    doc.text(`Phone: ${inv.seller.phone}`, textLeftX, 36);
  }

  // Right-aligned invoice header inside 196mm margin
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(120, 53, 15);
  doc.text(
    inv.status === "CANCELLED" ? "TAX INVOICE (CANCELLED)" : "TAX INVOICE",
    196,
    17,
    { align: "right" }
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(35, 23, 15);
  doc.text(`Invoice #: ${inv.invoiceNumber}`, 196, 23, { align: "right" });
  doc.text(`Order Ref: ${inv.orderNumber}`, 196, 28, { align: "right" });
  doc.text(`Date: ${inv.invoiceDate} | Due: ${inv.dueDate}`, 196, 33, {
    align: "right",
  });

  doc.setDrawColor(230, 220, 203);
  doc.line(14, 42, 196, 42);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Bill To:", 14, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(inv.buyer.name, 14, 53);
  doc.text(
    `GSTIN: ${inv.buyer.gstin ?? "Unregistered"} | Phone: ${inv.buyer.phone}`,
    14,
    58
  );
  doc.text(inv.buyer.address, 14, 63, { maxWidth: 120 });
  doc.text(
    `Place of Supply: ${inv.placeOfSupply} (${inv.placeOfSupplyCode})`,
    14,
    70
  );

  if (inv.irn) {
    doc.setFontSize(7.5);
    doc.text(`IRN: ${inv.irn}`, 14, 75, { maxWidth: 182 });
  }

  autoTable(doc, {
    startY: inv.irn ? 80 : 75,
    margin: { left: 14, right: 14 },
    head: [
      [
        "#",
        "Item",
        "HSN",
        "Qty",
        "Rate",
        "Taxable",
        "CGST",
        "SGST",
        "IGST",
        "Total",
      ],
    ],
    body: inv.items.map((li, idx) => [
      String(idx + 1),
      li.itemName,
      li.hsnCode,
      `${Number(li.quantity).toFixed(0)} ${li.unit}`,
      formatPdfRs(li.unitPrice),
      formatPdfRs(li.taxableAmount),
      formatPdfRs(li.cgstAmount),
      formatPdfRs(li.sgstAmount),
      formatPdfRs(li.igstAmount),
      formatPdfRs(li.totalAmount),
    ]),
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [35, 23, 15],
    },
    headStyles: {
      fillColor: [120, 53, 15],
      textColor: [255, 253, 249],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "right" },
      8: { halign: "right" },
      9: { halign: "right" },
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 140;

  // Clean aligned totals table on the right side (never clips past 196mm)
  const balance = (Number(inv.totalAmount) - Number(inv.paidAmount)).toFixed(2);
  autoTable(doc, {
    startY: finalY + 6,
    margin: { left: 118, right: 14 },
    theme: "plain",
    body: [
      ["Taxable Value", formatPdfRs(inv.taxableAmount)],
      ["CGST", formatPdfRs(inv.cgstAmount)],
      ["SGST", formatPdfRs(inv.sgstAmount)],
      ["IGST", formatPdfRs(inv.igstAmount)],
      ["Invoice Total", formatPdfRs(inv.totalAmount)],
      ["Amount Paid", formatPdfRs(inv.paidAmount)],
      ["Balance Due", formatPdfRs(balance)],
    ],
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 1.5,
      textColor: [35, 23, 15],
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "normal" },
      1: { halign: "right", fontStyle: "bold" },
    },
    didParseCell: (hook) => {
      if (hook.row.index === 4) {
        hook.cell.styles.fontSize = 10;
        hook.cell.styles.textColor = [120, 53, 15];
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });

  const footerY = Math.max(
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? finalY + 42) + 8,
    finalY + 46
  );

  if (inv.seller.bankDetails) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Bank Details:", 14, finalY + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(inv.seller.bankDetails, 14, finalY + 17, { maxWidth: 96 });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`For ${inv.seller.companyName}`, 196, footerY, { align: "right" });
  doc.text("Authorized Signatory", 196, footerY + 10, { align: "right" });

  doc.save(`${inv.invoiceNumber.replace(/\//g, "-")}.pdf`);
}

export interface PrintablePaymentReceipt {
  receiptId: string;
  companyName: string;
  companyGstin: string;
  customerName: string;
  paymentDate: string;
  amount: string;
  paymentMode: string;
  referenceNumber: string | null;
  invoiceNumber: string | null;
  notes: string | null;
}

export async function downloadPaymentReceiptPdf(rec: PrintablePaymentReceipt) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  const logo = await loadLogoDataUrl();

  const leftX = logo ? 30 : 14;
  if (logo) {
    doc.addImage(logo, "PNG", 14, 12, 13, 13);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(35, 23, 15);
  doc.text(rec.companyName, leftX, 17, { maxWidth: 105 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(92, 71, 56);
  doc.text(`GSTIN: ${rec.companyGstin}`, leftX, 23);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(120, 53, 15);
  doc.text("PAYMENT RECEIPT VOUCHER", 14, 34);

  autoTable(doc, {
    startY: 39,
    margin: { left: 14, right: 14 },
    body: [
      ["Receipt Ref", rec.receiptId.slice(0, 8).toUpperCase()],
      ["Date", rec.paymentDate],
      ["Received From", rec.customerName],
      ["Applied Invoice", rec.invoiceNumber ?? "On-Account / FIFO Settlement"],
      ["Payment Mode", rec.paymentMode.replace("_", " ")],
      ["UTR / Reference #", rec.referenceNumber ?? "-"],
      ["Amount Received", formatPdfRs(rec.amount)],
      ["Notes", rec.notes ?? "-"],
    ],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 2.8,
      textColor: [35, 23, 15],
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42, fillColor: [243, 236, 224] },
    },
  });

  doc.save(
    `Receipt-${rec.customerName.replace(/\s+/g, "-")}-${rec.paymentDate}.pdf`
  );
}

export interface PrintableDeliveryChallan {
  challanNumber: string;
  invoiceNumber: string;
  dispatchedDate: string;
  vehicleNumber: string | null;
  notes: string | null;
  seller: { companyName: string; gstin: string; address: string };
  buyer: { name: string; address: string; phone: string };
  items: Array<{ itemName: string; quantity: string; unit: string }>;
}

export async function downloadDeliveryChallanPdf(ch: PrintableDeliveryChallan) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  const logo = await loadLogoDataUrl();
  const leftX = logo ? 30 : 14;
  if (logo) doc.addImage(logo, "PNG", 14, 12, 13, 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(35, 23, 15);
  doc.text(ch.seller.companyName, leftX, 17, { maxWidth: 105 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(92, 71, 56);
  doc.text(`GSTIN: ${ch.seller.gstin}`, leftX, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(120, 53, 15);
  doc.text("DELIVERY CHALLAN", 14, 33);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(35, 23, 15);
  doc.text(`Challan #: ${ch.challanNumber} | Invoice #: ${ch.invoiceNumber}`, 14, 39);
  doc.text(
    `Date: ${ch.dispatchedDate}${ch.vehicleNumber ? ` | Vehicle: ${ch.vehicleNumber}` : ""}`,
    14,
    44
  );
  doc.text(`Deliver To: ${ch.buyer.name} (${ch.buyer.phone})`, 14, 50);
  doc.text(ch.buyer.address, 14, 55, { maxWidth: 120 });

  autoTable(doc, {
    startY: 63,
    margin: { left: 14, right: 14 },
    head: [["#", "Item Description", "Dispatched Qty"]],
    body: ch.items.map((li, idx) => [
      String(idx + 1),
      li.itemName,
      `${li.quantity} ${li.unit}`,
    ]),
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.3, textColor: [35, 23, 15] },
    headStyles: { fillColor: [120, 53, 15], textColor: [255, 253, 249], fontStyle: "bold" },
    columnStyles: { 0: { halign: "center", cellWidth: 10 }, 2: { halign: "right" } },
  });

  if (ch.notes) {
    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
    doc.setFontSize(8);
    doc.text(`Notes: ${ch.notes}`, 14, finalY + 8, { maxWidth: 120 });
  }

  doc.save(`${ch.challanNumber.replace(/\//g, "-")}.pdf`);
}

export interface PrintableCreditNote {
  creditNoteNumber: string;
  invoiceNumber: string;
  issuedDate: string;
  type: string;
  reason: string;
  seller: { companyName: string; gstin: string };
  buyer: { name: string; gstin: string | null };
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  amount: string;
  items: Array<{
    itemName: string;
    returnedQty: string;
    unit: string;
    condition: string;
    totalAmount: string;
  }>;
}

export async function downloadCreditNotePdf(cn: PrintableCreditNote) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  const logo = await loadLogoDataUrl();
  const leftX = logo ? 30 : 14;
  if (logo) doc.addImage(logo, "PNG", 14, 12, 13, 13);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.setTextColor(35, 23, 15);
  doc.text(cn.seller.companyName, leftX, 17, { maxWidth: 105 });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(92, 71, 56);
  doc.text(`GSTIN: ${cn.seller.gstin}`, leftX, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(120, 53, 15);
  doc.text(`CREDIT NOTE (${cn.type.replace("_", " ")})`, 14, 33);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(35, 23, 15);
  doc.text(`Credit Note #: ${cn.creditNoteNumber} | Against: ${cn.invoiceNumber}`, 14, 39);
  doc.text(`Date: ${cn.issuedDate} | Customer: ${cn.buyer.name}`, 14, 44);
  doc.text(`Reason: ${cn.reason}`, 14, 49, { maxWidth: 120 });

  if (cn.items.length > 0) {
    autoTable(doc, {
      startY: 56,
      margin: { left: 14, right: 14 },
      head: [["Item", "Qty", "Condition", "Credit"]],
      body: cn.items.map((li) => [
        li.itemName,
        `${li.returnedQty} ${li.unit}`,
        li.condition,
        formatPdfRs(li.totalAmount),
      ]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: [35, 23, 15] },
      headStyles: { fillColor: [120, 53, 15], textColor: [255, 253, 249], fontStyle: "bold" },
      columnStyles: { 1: { halign: "right" }, 3: { halign: "right" } },
    });
  }

  const nextY =
    cn.items.length > 0
      ? ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 85) + 6
      : 58;

  autoTable(doc, {
    startY: nextY,
    margin: { left: 14, right: 14 },
    body: [
      ["Taxable Credit", formatPdfRs(cn.taxableAmount)],
      ["CGST + SGST", formatPdfRs(Number(cn.cgstAmount) + Number(cn.sgstAmount))],
      ["IGST", formatPdfRs(cn.igstAmount)],
      ["Total Credit Note Value", formatPdfRs(cn.amount)],
    ],
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.5, textColor: [35, 23, 15] },
    columnStyles: { 0: { textColor: [92, 71, 56] }, 1: { halign: "right", fontStyle: "bold" } },
  });

  doc.save(`${cn.creditNoteNumber.replace(/\//g, "-")}.pdf`);
}
