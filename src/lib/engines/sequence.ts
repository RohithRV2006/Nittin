import { DocumentType, Prisma } from "@prisma/client";
import { getFinancialYear } from "@/lib/security";

const PREFIX_MAP: Record<DocumentType, string> = {
  ORDER: "ORD",
  INVOICE: "INV",
  CREDIT_NOTE: "CN",
  PRODUCTION_RUN: "PR",
  PURCHASE: "PUR",
};

/**
 * Generates a gap-free sequential document number scoped to the Indian Financial Year
 * inside an active Prisma transaction (e.g., `INV/2026-27/0001`).
 */
export async function getNextDocumentNumber(
  tx: Prisma.TransactionClient,
  docType: DocumentType,
  date: Date = new Date()
): Promise<string> {
  const fy = getFinancialYear(date);
  const seq = await tx.documentSequence.upsert({
    where: {
      docType_financialYear: {
        docType,
        financialYear: fy,
      },
    },
    create: {
      docType,
      financialYear: fy,
      lastSequence: 1,
    },
    update: {
      lastSequence: {
        increment: 1,
      },
    },
  });

  const padded = String(seq.lastSequence).padStart(4, "0");
  return `${PREFIX_MAP[docType]}/${fy}/${padded}`;
}
