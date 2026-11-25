import { getFinancialYear } from "@/lib/security";

export interface DateRangeFilter {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  fromDate: Date;
  toDate: Date;
  fy: string;
}

export function parseDateRangeParams(params: {
  from?: string;
  to?: string;
  fy?: string;
}): DateRangeFilter {
  const now = new Date();
  const defaultFy = getFinancialYear(now);
  const fy = params.fy || defaultFy;

  let fromStr = params.from;
  let toStr = params.to;

  if (!fromStr || !toStr) {
    // Default to current month start -> today
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    fromStr = fromStr || monthStart.toISOString().slice(0, 10);
    toStr = toStr || now.toISOString().slice(0, 10);
  }

  const fromDate = new Date(`${fromStr}T00:00:00.000Z`);
  const toDate = new Date(`${toStr}T23:59:59.999Z`);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    const fallbackStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      from: fallbackStart.toISOString().slice(0, 10),
      to: now.toISOString().slice(0, 10),
      fromDate: new Date(`${fallbackStart.toISOString().slice(0, 10)}T00:00:00.000Z`),
      toDate: new Date(`${now.toISOString().slice(0, 10)}T23:59:59.999Z`),
      fy,
    };
  }

  return {
    from: fromStr,
    to: toStr,
    fromDate,
    toDate,
    fy,
  };
}
