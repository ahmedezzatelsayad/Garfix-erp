/**
 * Garfix ERP — Purchases API (المرحلة 6: المشتريات والموردون)
 * إنشاء فواتير الشراء + الاستلام (ترحيل مخزون بالمتوسط المرجح) + مدفوعات الموردين
 */
import { db } from "@/lib/db";
import { jsonErr, logActivity, nextPurchaseNumber, receiveStock, getSettings } from "@/lib/erp";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const purchases = await db.purchase.findMany({
      include: {
        supplier: { select: { name: true, company: true, phone: true } },
        items: true,
        payments: true,
      },
      orderBy: { issueDate: "desc" },
    });
    const now = Date.now();
    const result = purchases.map((p) => {
      const balance = p.total - p.paidAmount;
      const overdue =
        p.status !== "paid" && p.status !== "cancelled" && p.status !== "draft" &&
        p.dueDate.getTime() < now && balance > 0.01;
      return {
        id: p.id,
        number: p.number,
        supplierId: p.supplierId,
        supplierName: p.supplier.company || p.supplier.name,
        supplierPhone: p.supplier.phone,
        issueDate: p.issueDate,
        dueDate: p.dueDate,
        status: overdue ? "overdue" : p.status,
        itemCount: p.items.length,
        subtotal: p.subtotal,
        vatRate: p.vatRate,
        vatAmount: p.vatAmount,
        total: p.total,
        paidAmount: p.paidAmount,
        balance: Math.round(balance * 100) / 100,
        notes: p.notes,
        payments: p.payments,
        items: p.items.map((it) => ({
          productId: it.productId,
          description: it.description,
          quantity: it.quantity,
          unitCost: it.unitCost,
          total: it.total,
        })),
      };
    });
    return Response.json(result);
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "accountant"]);
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json();
    if (!body.supplierId) return jsonErr("اختيار المورد مطلوب");
    const supplier = await db.supplier.findUnique({ where: { id: body.supplierId } });
    if (!supplier) return jsonErr("المورد غير موجود", 404);

    const items: Array<{ productId?: string | null; description?: string; quantity: number; unitCost: number }> =
      Array.isArray(body.items) ? body.items.filter((it: { description?: string }) => it.description?.trim()) : [];
    if (items.length === 0) return jsonErr("أضف بنداً واحداً على الأقل لفاتورة الشراء");

    const settings = await getSettings();
    const vatRate = Number(settings.vat_rate ?? 14);
    const applyVat = body.applyVat === true;

    const preparedItems = items.map((it) => {
      const quantity = Number(it.quantity) || 1;
      const unitCost = Number(it.unitCost) || 0;
      return {
        productId: it.productId || null,
        description: it.description!.trim(),
        quantity,
        unitCost,
        total: Math.round(quantity * unitCost * 100) / 100,
      };
    });

    const subtotal = Math.round(preparedItems.reduce((s, it) => s + it.total, 0) * 100) / 100;
    const vatAmount = applyVat ? Math.round(subtotal * (vatRate / 100) * 100) / 100 : 0;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;

    const number = await nextPurchaseNumber();
    const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
    const dueDate = body.dueDate
      ? new Date(body.dueDate)
      : (() => {
          const d = new Date(issueDate);
          d.setDate(d.getDate() + 15); // مطلوب السداد خلال 15 يوم
          return d;
        })();

    // الحالة المبدئية: draft أو ordered — الاستلام يرحّل المخزون
    const initialStatus = body.status === "ordered" ? "ordered" : "draft";

    const purchase = await db.purchase.create({
      data: {
        number,
        supplierId: body.supplierId,
        issueDate,
        dueDate,
        status: initialStatus,
        subtotal,
        vatRate: applyVat ? vatRate : 0,
        vatAmount,
        total,
        paidAmount: 0,
        notes: body.notes?.trim() || null,
        items: { create: preparedItems },
      },
      include: { items: true, supplier: { select: { name: true, company: true } } },
    });

    await logActivity(
      "create",
      "purchase",
      `إنشاء فاتورة شراء ${number} من المورد ${supplier.name} (${initialStatus === "ordered" ? "مطلوبة" : "مسودة"})`,
      auth.user.email
    );
    return Response.json(purchase, { status: 201 });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
