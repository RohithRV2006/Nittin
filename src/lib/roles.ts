export type UserRole =
  | "SALESMAN"
  | "FACTORY_ADMIN"
  | "PRODUCTION_SUPERVISOR"
  | "AUDITOR"
  | "OWNER";

export const ROLE_HOME_ROUTES: Record<UserRole, string> = {
  SALESMAN: "/salesman",
  FACTORY_ADMIN: "/admin",
  PRODUCTION_SUPERVISOR: "/production",
  AUDITOR: "/auditor",
  OWNER: "/dashboard",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SALESMAN: "Salesman",
  FACTORY_ADMIN: "Factory Admin",
  PRODUCTION_SUPERVISOR: "Production Supervisor",
  AUDITOR: "Auditor / Accountant",
  OWNER: "Business Owner",
};

export const ROUTE_ACCESS_RULES: Array<{
  prefix: string;
  allowedRoles: UserRole[];
}> = [
  { prefix: "/salesman", allowedRoles: ["SALESMAN"] },
  { prefix: "/admin", allowedRoles: ["FACTORY_ADMIN"] },
  { prefix: "/production", allowedRoles: ["PRODUCTION_SUPERVISOR", "FACTORY_ADMIN"] },
  { prefix: "/auditor", allowedRoles: ["AUDITOR", "FACTORY_ADMIN", "OWNER"] },
  { prefix: "/dashboard", allowedRoles: ["OWNER", "FACTORY_ADMIN"] },
];

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const matched = ROUTE_ACCESS_RULES.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)
  );
  if (!matched) return true;
  return matched.allowedRoles.includes(role);
}
