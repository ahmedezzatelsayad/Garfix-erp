/**
 * Garfix ERP — أدوات مساعدة مشتركة للـ API
 */
import { db } from "@/lib/db";

export const jsonOk = (data: unknown, status = 200) =>
  Response.json(data as object, { status });

export const jsonErr = (message: string, status = 400) =>
  Response.json({ error: message }, { status });

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** هل الفاتورة متأخرة السداد؟ */
export function isOverdue(inv: {
  status: string;
  dueDate: Date;
  paidAmount: number;
  total: number;
}): boolean {
  if (inv.status === "paid" || inv.status === "cancelled" || inv.status === "draft") return false;
  return inv.dueDate.getTime() < Date.now() && inv.paidAmount < inv.total;
}

/** حالة العرض الفعلية للفاتورة (مع المتأخر) */
export function effectiveStatus(inv: {
  status: string;
  dueDate: Date;
  paidAmount: number;
  total: number;
}): string {
  if (isOverdue(inv)) return "overdue";
  return inv.status;
}

export async function nextInvoiceNumber(): Promise<string> {
  const settings = await getSettings();
  const prefix = settings.invoice_prefix || "INV-";
  const last = await db.invoice.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const lastSeq = last ? parseInt(last.number.replace(prefix, ""), 10) : 1000;
  return `${prefix}${(isNaN(lastSeq) ? 1000 : lastSeq) + 1}`;
}

export async function logActivity(action: string, entity: string, detail?: string, userEmail?: string) {
  await db.activityLog.create({ data: { action, entity, detail, userEmail } });
}
