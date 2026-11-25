import Decimal from "decimal.js";

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

export type DecimalInput = Decimal | string | number;

export function toDec(value: DecimalInput | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") {
    return new Decimal(0);
  }
  return new Decimal(value.toString());
}

/** Round to 2 decimal places (INR paise precision, ROUND_HALF_UP). */
export function money(value: DecimalInput): Decimal {
  return toDec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Round to 3 decimal places (physical unit precision, ROUND_HALF_UP). */
export function qty(value: DecimalInput): Decimal {
  return toDec(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
}

/** Round percentage to 2 decimal places (ROUND_HALF_UP). */
export function percent(value: DecimalInput): Decimal {
  return toDec(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function moneyStr(value: DecimalInput): string {
  return money(value).toFixed(2);
}

export function qtyStr(value: DecimalInput): string {
  return qty(value).toFixed(3);
}

export function formatINR(value: DecimalInput): string {
  const num = Number(money(value).toFixed(2));
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
