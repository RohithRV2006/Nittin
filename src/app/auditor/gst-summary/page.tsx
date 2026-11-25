import type { Metadata } from "next";
import { InvoiceStatus } from "@prisma/client";
import {
  GstSummaryClient,
  type GstSummaryData,
} from "@/components/auditor/GstSummaryClient";
import { money } from "@/lib/decimal";
import { parseDateRangeParams } from "@/lib/engines/reports";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "GST Summary",
  description: "GSTR-1 and GSTR-3B tax liability and credit note summary.",
};

export const dynamic = "force-dynamic";

export default async function AuditorGstSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; fy?: string }>;
}) {
  const filter = parseDateRangeParams(await searchParams);

  const [invoices, creditNotes] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.POSTED,
        invoiceDate: { gte: filter.fromDate, lte: filter.toDate },
      },
      include: { customer: { select: { gstin: true } }, items: true },
    }),
    prisma.creditNote.findMany({
      where: {
        issuedAt: { gte: filter.fromDate, lte: filter.toDate },
      },
    }),
  ]);

  const initBucket = () => ({
    docCount: 0,
    taxable: money(0),
    cgst: money(0),
    sgst: money(0),
    igst: money(0),
    total: money(0),
  });

  const b2b = initBucket();
  const b2c = initBucket();
  const cn = initBucket();

  const rateMap = new Map<
    string,
    {
      taxRate: string;
      taxable: ReturnType<typeof money>;
      cgst: ReturnType<typeof money>;
      sgst: ReturnType<typeof money>;
      igst: ReturnType<typeof money>;
    }
  >();

  for (const inv of invoices) {
    const bucket = inv.customer.gstin ? b2b : b2c;
    bucket.docCount += 1;
    bucket.taxable = money(bucket.taxable.plus(inv.taxableAmount.toString()));
    bucket.cgst = money(bucket.cgst.plus(inv.cgstAmount.toString()));
    bucket.sgst = money(bucket.sgst.plus(inv.sgstAmount.toString()));
    bucket.igst = money(bucket.igst.plus(inv.igstAmount.toString()));
    bucket.total = money(bucket.total.plus(inv.totalAmount.toString()));

    for (const li of inv.items) {
      const rateKey = li.taxRate.toFixed(2);
      const r = rateMap.get(rateKey) ?? {
        taxRate: rateKey,
        taxable: money(0),
        cgst: money(0),
        sgst: money(0),
        igst: money(0),
      };
      r.taxable = money(r.taxable.plus(li.taxableAmount.toString()));
      r.cgst = money(r.cgst.plus(li.cgstAmount.toString()));
      r.sgst = money(r.sgst.plus(li.sgstAmount.toString()));
      r.igst = money(r.igst.plus(li.igstAmount.toString()));
      rateMap.set(rateKey, r);
    }
  }

  for (const note of creditNotes) {
    cn.docCount += 1;
    cn.taxable = money(cn.taxable.plus(note.taxableAmount.toString()));
    cn.cgst = money(cn.cgst.plus(note.cgstAmount.toString()));
    cn.sgst = money(cn.sgst.plus(note.sgstAmount.toString()));
    cn.igst = money(cn.igst.plus(note.igstAmount.toString()));
    cn.total = money(cn.total.plus(note.amount.toString()));
  }

  const data: GstSummaryData = {
    from: filter.from,
    to: filter.to,
    totals: {
      taxable: money(b2b.taxable.plus(b2c.taxable)).toFixed(2),
      cgst: money(b2b.cgst.plus(b2c.cgst)).toFixed(2),
      sgst: money(b2b.sgst.plus(b2c.sgst)).toFixed(2),
      igst: money(b2b.igst.plus(b2c.igst)).toFixed(2),
      creditNoteTax: money(cn.cgst.plus(cn.sgst).plus(cn.igst)).toFixed(2),
    },
    sections: [
      {
        section: "Table 4 (B2B)",
        description: "Registered Buyers (With GSTIN)",
        docCount: b2b.docCount,
        taxable: b2b.taxable.toFixed(2),
        cgst: b2b.cgst.toFixed(2),
        sgst: b2b.sgst.toFixed(2),
        igst: b2b.igst.toFixed(2),
        total: b2b.total.toFixed(2),
      },
      {
        section: "Table 5 / 7 (B2C)",
        description: "Unregistered Buyers (Without GSTIN)",
        docCount: b2c.docCount,
        taxable: b2c.taxable.toFixed(2),
        cgst: b2c.cgst.toFixed(2),
        sgst: b2c.sgst.toFixed(2),
        igst: b2c.igst.toFixed(2),
        total: b2c.total.toFixed(2),
      },
      {
        section: "Table 9B (CDNR)",
        description: "Credit Notes Issued (Reversals)",
        docCount: cn.docCount,
        taxable: cn.taxable.toFixed(2),
        cgst: cn.cgst.toFixed(2),
        sgst: cn.sgst.toFixed(2),
        igst: cn.igst.toFixed(2),
        total: cn.total.toFixed(2),
      },
    ],
    rateSummary: Array.from(rateMap.values()).map((r) => ({
      taxRate: r.taxRate,
      taxable: r.taxable.toFixed(2),
      cgst: r.cgst.toFixed(2),
      sgst: r.sgst.toFixed(2),
      igst: r.igst.toFixed(2),
      totalTax: money(r.cgst.plus(r.sgst).plus(r.igst)).toFixed(2),
    })),
  };

  return <GstSummaryClient data={data} />;
}
