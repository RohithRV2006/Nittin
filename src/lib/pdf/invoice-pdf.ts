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

export function downloadGstInvoicePdf(inv: PrintableInvoice) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(inv.seller.companyName, 14, 18);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`GSTIN: ${inv.seller.gstin} | State: ${inv.seller.state} (${inv.seller.stateCode})`, 14, 24);
  doc.text(inv.seller.address, 14, 29, { maxWidth: 120 });
  if (inv.seller.phone) {
    doc.text(`Phone: ${inv.seller.phone}`, 14, 36);
  }

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(
    inv.status === "CANCELLED" ? "TAX INVOICE (CANCELLED)" : "TAX INVOICE",
    196,
    18,
    { align: "right" }
  );

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice #: ${inv.invoiceNumber}`, 196, 25, { align: "right" });
  doc.text(`Order Ref: ${inv.orderNumber}`, 196, 30, { align: "right" });
  doc.text(`Date: ${inv.invoiceDate} | Due: ${inv.dueDate}`, 196, 35, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.line(14, 42, 196, 42);

  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 14, 48);
  doc.setFont("helvetica", "normal");
  doc.text(inv.buyer.name, 14, 53);
  doc.text(`GSTIN: ${inv.buyer.gstin ?? "Unregistered"} | Phone: ${inv.buyer.phone}`, 14, 58);
  doc.text(inv.buyer.address, 14, 63, { maxWidth: 110 });
  doc.text(`Place of Supply: ${inv.placeOfSupply} (${inv.placeOfSupplyCode})`, 14, 70);

  if (inv.irn) {
    doc.setFontSize(7.5);
    doc.text(`IRN: ${inv.irn}`, 14, 75, { maxWidth: 182 });
  }

  autoTable(doc, {
    startY: inv.irn ? 80 : 75,
    head: [["#", "Item", "HSN", "Qty", "Rate", "Taxable", "CGST", "SGST", "IGST", "Total"]],
    body: inv.items.map((li, idx) => [
      String(idx + 1),
      li.itemName,
      li.hsnCode,
      `${Number(li.quantity).toFixed(0)} ${li.unit}`,
      `₹${li.unitPrice}`,
      `₹${li.taxableAmount}`,
      `₹${li.cgstAmount}`,
      `₹${li.sgstAmount}`,
      `₹${li.igstAmount}`,
      `₹${li.totalAmount}`,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [4, 120, 87] },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 140;

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Taxable Value: ₹${inv.taxableAmount}`, 196, finalY + 10, { align: "right" });
  doc.text(`CGST: ₹${inv.cgstAmount}  |  SGST: ₹${inv.sgstAmount}  |  IGST: ₹${inv.igstAmount}`, 196, finalY + 16, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Invoice Total: ₹${inv.totalAmount}`, 196, finalY + 23, { align: "right" });

  const balance = (Number(inv.totalAmount) - Number(inv.paidAmount)).toFixed(2);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Paid: ₹${inv.paidAmount}  |  Balance Due: ₹${balance}`, 196, finalY + 29, { align: "right" });

  if (inv.seller.bankDetails) {
    doc.setFont("helvetica", "bold");
    doc.text("Bank Details:", 14, finalY + 38);
    doc.setFont("helvetica", "normal");
    doc.text(inv.seller.bankDetails, 14, finalY + 43, { maxWidth: 120 });
  }

  doc.setFontSize(8);
  doc.text("For " + inv.seller.companyName, 196, finalY + 48, { align: "right" });
  doc.text("Authorized Signatory", 196, finalY + 58, { align: "right" });

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

export function downloadPaymentReceiptPdf(rec: PrintablePaymentReceipt) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(rec.companyName, 14, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`GSTIN: ${rec.companyGstin}`, 14, 24);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT RECEIPT VOUCHER", 14, 34);

  autoTable(doc, {
    startY: 40,
    body: [
      ["Receipt Ref", rec.receiptId.slice(0, 8).toUpperCase()],
      ["Date", rec.paymentDate],
      ["Received From", rec.customerName],
      ["Applied Invoice", rec.invoiceNumber ?? "On-Account / FIFO Settlement"],
      ["Payment Mode", rec.paymentMode.replace("_", " ")],
      ["UTR / Reference #", rec.referenceNumber ?? "—"],
      ["Amount Received", `₹${rec.amount}`],
      ["Notes", rec.notes ?? "—"],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
  });

  doc.save(`Receipt-${rec.customerName.replace(/\s+/g, "-")}-${rec.paymentDate}.pdf`);
}
