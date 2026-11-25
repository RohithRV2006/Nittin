import { createHash } from "crypto";

export interface EInvoiceParty {
  gstin: string | null;
  legalName: string;
  address: string;
  state: string;
  stateCode: string;
  phone?: string | null;
}

export interface EInvoiceLineInput {
  slNo: number;
  itemName: string;
  hsnCode: string;
  qty: string;
  unit: string;
  unitPrice: string;
  taxableAmount: string;
  taxRate: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalAmount: string;
}

export interface EInvoiceInput {
  invoiceNumber: string;
  invoiceDateIso: string;
  financialYear: string;
  seller: EInvoiceParty;
  buyer: EInvoiceParty;
  taxableAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalAmount: string;
  items: EInvoiceLineInput[];
}

function formatNicDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function generateMockNicDocuments(input: EInvoiceInput) {
  const sellerGstin = input.seller.gstin || "URP";
  const irn = createHash("sha256")
    .update(`${sellerGstin}|${input.financialYear}|INV|${input.invoiceNumber}`)
    .digest("hex");

  const ackSeed = createHash("sha1").update(irn).digest("hex").slice(0, 12);
  const ackNo = String(BigInt(`0x${ackSeed}`)).slice(0, 15).padStart(15, "1");
  const ackDt = new Date().toISOString().replace("T", " ").slice(0, 19);

  const isInterState =
    input.seller.stateCode.trim() !== input.buyer.stateCode.trim();

  const eInvoiceJson = {
    Version: "1.1",
    AckNo: ackNo,
    AckDt: ackDt,
    Irn: irn,
    SignedQRCode: `MOCK-NIC-QR:${irn.slice(0, 24)}:${input.invoiceNumber}:${input.totalAmount}`,
    TranDtls: {
      TaxSch: "GST",
      SupTyp: input.buyer.gstin ? "B2B" : "B2C",
      RegRev: "N",
      IgstOnIntra: "N",
    },
    DocDtls: {
      Typ: "INV",
      No: input.invoiceNumber,
      Dt: formatNicDate(input.invoiceDateIso),
    },
    SellerDtls: {
      Gstin: sellerGstin,
      LglNm: input.seller.legalName,
      Addr1: input.seller.address,
      Loc: input.seller.state,
      Stcd: input.seller.stateCode,
      Ph: input.seller.phone ?? undefined,
    },
    BuyerDtls: {
      Gstin: input.buyer.gstin || "URP",
      LglNm: input.buyer.legalName,
      Pos: input.buyer.stateCode,
      Addr1: input.buyer.address,
      Loc: input.buyer.state,
      Stcd: input.buyer.stateCode,
      Ph: input.buyer.phone ?? undefined,
    },
    ItemList: input.items.map((item) => ({
      SlNo: String(item.slNo),
      PrdDesc: item.itemName,
      IsServc: "N",
      HsnCd: item.hsnCode,
      Qty: Number(item.qty),
      Unit: item.unit,
      UnitPrice: Number(item.unitPrice),
      TotAmt: Number(item.taxableAmount),
      AssAmt: Number(item.taxableAmount),
      GstRt: Number(item.taxRate),
      IgstAmt: Number(item.igstAmount),
      CgstAmt: Number(item.cgstAmount),
      SgstAmt: Number(item.sgstAmount),
      TotItemVal: Number(item.totalAmount),
    })),
    ValDtls: {
      AssVal: Number(input.taxableAmount),
      CgstVal: Number(input.cgstAmount),
      SgstVal: Number(input.sgstAmount),
      IgstVal: Number(input.igstAmount),
      TotInvVal: Number(input.totalAmount),
    },
  };

  const eWayBillJson = {
    supplyType: "O",
    subSupplyType: "1",
    docType: "INV",
    docNo: input.invoiceNumber,
    docDate: formatNicDate(input.invoiceDateIso),
    fromGstin: sellerGstin,
    fromTrdName: input.seller.legalName,
    fromAddr1: input.seller.address,
    fromStateCode: Number(input.seller.stateCode) || 0,
    toGstin: input.buyer.gstin || "URP",
    toTrdName: input.buyer.legalName,
    toAddr1: input.buyer.address,
    toStateCode: Number(input.buyer.stateCode) || 0,
    transactionType: isInterState ? 2 : 1,
    totalValue: Number(input.taxableAmount),
    cgstValue: Number(input.cgstAmount),
    sgstValue: Number(input.sgstAmount),
    igstValue: Number(input.igstAmount),
    totInvValue: Number(input.totalAmount),
    transMode: "1",
    itemList: input.items.map((item) => ({
      productName: item.itemName,
      hsnCode: Number(item.hsnCode) || 0,
      quantity: Number(item.qty),
      qtyUnit: item.unit,
      taxableAmount: Number(item.taxableAmount),
      cgstRate: isInterState ? 0 : Number(item.taxRate) / 2,
      sgstRate: isInterState ? 0 : Number(item.taxRate) / 2,
      igstRate: isInterState ? Number(item.taxRate) : 0,
    })),
  };

  return {
    irn,
    ackNo,
    ackDt,
    eInvoiceJson,
    eWayBillJson,
  };
}
