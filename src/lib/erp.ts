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

/** رقم فاتورة الشراء التالي (PUR-2001...) */
export async function nextPurchaseNumber(): Promise<string> {
  const last = await db.purchase.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const lastSeq = last ? parseInt(last.number.replace("PUR-", ""), 10) : 2000;
  return `PUR-${(isNaN(lastSeq) ? 2000 : lastSeq) + 1}`;
}

export async function logActivity(action: string, entity: string, detail?: string, userEmail?: string) {
  await db.activityLog.create({ data: { action, entity, detail, userEmail } });
}

// ============ المرحلة 6: منطق المشتريات والمخزون ============

/** الحالات التي تعني أن البضاعة وصلت فعلاً للمخزون */
export const RECEIVED_STATUSES = ["received", "partial", "paid"];

/** هل فاتورة الشراء مستلمة (بضاعتها في المخزون)؟ */
export function isReceived(status: string): boolean {
  return RECEIVED_STATUSES.includes(status);
}

/**
 * إدخال بضاعة للمخزون بترحيل التكلفة بالمتوسط المرجح:
 * newCost = (الرصيد الحالي × التكلفة الحالية + الكمية الواردة × تكلفة الشراء) / (الرصيد + الكمية)
 */
export async function receiveStock(
  items: Array<{ productId: string | null; quantity: number; unitCost: number }>
): Promise<void> {
  for (const it of items) {
    if (!it.productId || it.quantity <= 0) continue;
    const product = await db.product.findUnique({ where: { id: it.productId } });
    if (!product) continue;
    const oldQty = Math.max(product.stock, 0);
    const newQty = oldQty + Math.round(it.quantity);
    const newCost =
      oldQty + it.quantity > 0
        ? (oldQty * product.cost + it.quantity * it.unitCost) / (oldQty + it.quantity)
        : it.unitCost;
    await db.product.update({
      where: { id: it.productId },
      data: {
        stock: newQty,
        cost: Math.round(newCost * 100) / 100,
      },
    });
  }
}

/** إخراج بضاعة من المخزون (إلغاء استلام) — يعيد التكلفة لما كانت عليه تقريبياً */
export async function reverseStock(
  items: Array<{ productId: string | null; quantity: number; unitCost: number }>
): Promise<void> {
  for (const it of items) {
    if (!it.productId || it.quantity <= 0) continue;
    await db.product.update({
      where: { id: it.productId },
      data: { stock: { decrement: Math.round(it.quantity) } },
    });
  }
}

/** تحديث حالة السداد بعد دفعة مورد: paid | partial | تبقى كما هي */
export function payStatusFor(total: number, paidAmount: number, current: string): string {
  if (current === "cancelled" || current === "draft" || current === "ordered") return current;
  if (paidAmount >= total - 0.01) return "paid";
  if (paidAmount > 0) return "partial";
  return current;
}
