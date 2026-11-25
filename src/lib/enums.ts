export const UNIT_TYPES = [
  "KG",
  "GRAM",
  "LITRE",
  "ML",
  "PIECE",
  "PACKET",
  "CARTON",
] as const;

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
