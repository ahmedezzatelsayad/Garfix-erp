/**
 * Garfix ERP — Purchase [id] API (المرحلة 6)
 * PATCH: استلام البضاعة / تغيير الحالة / تسجيل دفعة للمورد / إلغاء
 */
import { db } from "@/lib/db";
import {
  jsonErr,
  logActivity,
  receiveStock,
  reverseStock,
  isReceived,
  payStatusFor,
} from "@/lib/erp";
import { requireUser } from "@/lib/auth";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["admin", "accountant"]);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const purchase = await db.purchase.findUnique({
      where: { id },
      include: { items: true, supplier: { select: { name: true } } },
    });
    if (!purchase) return jsonErr("فاتورة الشراء غير موجودة", 404);
    if (purchase.status === "cancelled") return jsonErr("لا يمكن تعديل فاتورة ملغاة");

    const action = body.action as string;

    // ===== 1) استلام البضاعة: يرحّل الكميات للمخزون ويحدّث التكلفة بالمتوسط المرجح =====
    if (action === "receive") {
      if (isReceived(purchase.status)) return jsonErr("البضاعة مستلمة بالفعل");
      await receiveStock(purchase.items);
      const updated = await db.purchase.update({
        where: { id },
        data: { status: "received" },
        include: { items: true, payments: true },
      });
      await logActivity(
        "receive",
        "purchase",
        `استلام فاتورة شراء ${purchase.number} — ${purchase.items.length} بند ترحّل للمخزون بالمتوسط المرجح`,
        auth.user.email
      );
      return Response.json(updated);
    }

    // ===== 2) تسجيل دفعة للمورد =====
    if (action === "payment") {
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return jsonErr("أدخل مبلغاً صحيحاً");
      const balance = purchase.total - purchase.paidAmount;
      if (amount > balance + 0.01) return jsonErr(`المبلغ أكبر من المتبقي (${Math.round(balance)} ج.م)`);
      if (!isReceived(purchase.status) && purchase.status !== "ordered") {
        return jsonErr("سجّل الدفعة بعد الاستلام أو على فاتورة مطلوبة");
      }

      await db.supplierPayment.create({
        data: {
          purchaseId: id,
          amount: Math.round(amount * 100) / 100,
          method: body.method || "cash",
          date: body.date ? new Date(body.date) : new Date(),
          reference: body.reference?.trim() || null,
          notes: body.notes?.trim() || null,
        },
      });

      const paidAmount = Math.round((purchase.paidAmount + amount) * 100) / 100;
      const newStatus = payStatusFor(purchase.total, paidAmount, purchase.status);
      const updated = await db.purchase.update({
        where: { id },
        data: { paidAmount, status: newStatus },
        include: { items: true, payments: true },
      });
      await logActivity(
        "payment",
        "purchase",
        `دفعة مورد ${Math.round(amount)} ج.م على فاتورة شراء ${purchase.number}`,
        auth.user.email
      );
      return Response.json(updated);
    }

    // ===== 3) طلب من المورد (مسودة → مطلوبة) =====
    if (action === "order") {
      if (purchase.status !== "draft") return jsonErr("الطلب متاح من حالة المسودة فقط");
      const updated = await db.purchase.update({
        where: { id },
        data: { status: "ordered" },
        include: { items: true, payments: true },
      });
      await logActivity("order", "purchase", `طلب فاتورة شراء ${purchase.number} من ${purchase.supplier.name}`, auth.user.email);
      return Response.json(updated);
    }

    // ===== 4) إلغاء الفاتورة (مع إرجاع المخزون إن كانت مستلمة) =====
    if (action === "cancel") {
      if (isReceived(purchase.status)) {
        await reverseStock(purchase.items);
      }
      const updated = await db.purchase.update({
        where: { id },
        data: { status: "cancelled" },
        include: { items: true, payments: true },
      });
      await logActivity(
        "cancel",
        "purchase",
        `إلغاء فاتورة شراء ${purchase.number}${isReceived(purchase.status) ? " — أُرجعت الكميات للمخزون" : ""}`,
        auth.user.email
      );
      return Response.json(updated);
    }

    // ===== 5) تعديل ملاحظات فقط =====
    if (action === "notes") {
      const updated = await db.purchase.update({
        where: { id },
        data: { notes: body.notes?.trim() || null },
        include: { items: true, payments: true },
      });
      return Response.json(updated);
    }

    return jsonErr("إجراء غير معروف");
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await ctx.params;
    const purchase = await db.purchase.findUnique({
      where: { id },
      include: { supplier: true, items: true, payments: true },
    });
    if (!purchase) return jsonErr("فاتورة الشراء غير موجودة", 404);
    return Response.json(purchase);
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
