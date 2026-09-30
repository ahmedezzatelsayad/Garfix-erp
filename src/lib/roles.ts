/**
 * Garfix ERP — الأدوار والصلاحيات (مشترك بين الخادم والواجهة — بلا تبعيات)
 */

export type Role = "admin" | "accountant" | "sales";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  accountant: "محاسب",
  sales: "مبيعات",
};

/** صلاحيات كل دور — تُستخدم لفلترة الواجهة */
export const ROLE_ACCESS: Record<Role, { nav: string[]; can: string[] }> = {
  admin: {
    nav: ["dashboard", "invoices", "clients", "purchases", "inventory", "expenses", "agent", "reports", "users", "settings"],
    can: ["*"],
  },
  accountant: {
    nav: ["dashboard", "invoices", "clients", "purchases", "inventory", "expenses", "agent", "reports", "settings"],
    can: ["invoices:write", "payments:write", "expenses:write", "clients:write", "products:write", "purchases:write", "suppliers:write", "settings:read", "agent:run"],
  },
  sales: {
    nav: ["dashboard", "invoices", "clients", "inventory", "agent"],
    can: ["invoices:write", "clients:write", "agent:run"],
  },
};

export const can = (user: { role: Role }, capability: string): boolean => {
  const perms = ROLE_ACCESS[user.role]?.can ?? [];
  return perms.includes("*") || perms.includes(capability);
};
