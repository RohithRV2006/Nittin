import Decimal from "decimal.js";
import { money, toDec, type DecimalInput } from "@/lib/decimal";

export interface GstSplitResult {
  isIntraState: boolean;
  taxableAmount: Decimal;
  cgstAmount: Decimal;
  sgstAmount: Decimal;
  igstAmount: Decimal;
  totalTax: Decimal;
  totalAmount: Decimal;
}

/**
 * Computes GST breakdown from origin and destination 2-digit GST state codes.
 * Zero hardcoding: caller supplies `originStateCode` from `CompanySettings.stateCode`.
 */
export function computeGstSplit(
  taxableInput: DecimalInput,
  taxRatePercent: DecimalInput,
  originStateCode: string,
  placeOfSupplyStateCode: string
): GstSplitResult {
  const taxableAmount = money(taxableInput);
  const rate = toDec(taxRatePercent);
  const totalTax = money(taxableAmount.mul(rate).div(100));

  const isIntraState =
    originStateCode.trim() !== "" &&
    originStateCode.trim() === placeOfSupplyStateCode.trim();

  if (isIntraState) {
    const cgstAmount = money(totalTax.div(2));
    const sgstAmount = money(totalTax.minus(cgstAmount));
    return {
      isIntraState: true,
      taxableAmount,
      cgstAmount,
      sgstAmount,
      igstAmount: money(0),
      totalTax: money(cgstAmount.plus(sgstAmount)),
      totalAmount: money(taxableAmount.plus(cgstAmount).plus(sgstAmount)),
    };
  }

  return {
    isIntraState: false,
    taxableAmount,
    cgstAmount: money(0),
    sgstAmount: money(0),
    igstAmount: totalTax,
    totalTax,
    totalAmount: money(taxableAmount.plus(totalTax)),
  };
}
