export const UNIT_TYPES = [
  "KG",
  "GRAM",
  "LITRE",
  "ML",
  "PIECE",
  "PACKET",
  "CARTON",
] as const;

export const INTEGER_UNITS = ["PIECE", "PACKET", "CARTON"] as const;

export function isIntegerUnit(unit: string): boolean {
  return (INTEGER_UNITS as readonly string[]).includes(unit);
}

export function formatDisplayQty(value: string | number, unit: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return isIntegerUnit(unit) ? String(Math.round(num)) : num.toFixed(3);
}

export const ITEM_CATEGORIES = [
  "RAW_MATERIAL",
  "PACKAGING",
  "FINISHED_GOOD",
] as const;

export const CUSTOMER_TYPES = ["RETAILER", "DISTRIBUTOR"] as const;

export const PAYMENT_MODES = [
  "CASH",
  "UPI",
  "BANK_TRANSFER",
  "CHEQUE",
] as const;

export const USER_ROLES = [
  "SALESMAN",
  "FACTORY_ADMIN",
  "PRODUCTION_SUPERVISOR",
  "AUDITOR",
  "OWNER",
] as const;
