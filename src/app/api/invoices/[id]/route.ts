/**
 * Garfix ERP — Invoice [id] API
 * GET: تفاصيل كاملة | PATCH: تغيير حالة أو تسجيل دفعة | DELETE
 */
import { db } from "@/lib/db";
import { jsonErr, logActivity } from "@/lib/erp";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        items: { include: { product: { select: { sku: true } } } },
        payments: { orderBy: { date: "desc" } },
      },
    });
    if (!invoice) return jsonErr("الفاتورة غير موجودة", 404);
    return Response.json(invoice);
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const invoice = await db.invoice.findUnique({ where: { id }, include: { items: true } });
    if (!invoice) return jsonErr("الفاتورة غير موجودة", 404);

    // ===== تسجيل دفعة =====
    if (body.action === "payment") {
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return jsonErr("قيمة الدفعة غير صحيحة");
      const balance = invoice.total - invoice.paidAmount;
      if (amount > balance + 0.01) return jsonErr(`الدفعة أكبر من المتبقي (${Math.round(balance * 100) / 100})`);
      const newPaid = Math.round((invoice.paidAmount + amount) * 100) / 100;
      const newStatus = newPaid >= invoice.total - 0.01 ? "paid" : "partial";
      await db.payment.create({
        data: {
          invoiceId: id,
          amount,
          method: body.method || "cash",
          reference: body.reference?.trim() || null,
          notes: body.notes?.trim() || null,
          date: body.date ? new Date(body.date) : new Date(),
        },
      });
      const updated = await db.invoice.update({ where: { id }, data: { paidAmount: newPaid, status: newStatus } });
      await logActivity("payment", "invoice", `تسجيل دفعة ${amount} على فاتورة ${invoice.number}`);
      return Response.json(updated);
    }

    // ===== تغيير الحالة =====
    if (body.status) {
      const allowed = ["draft", "sent", "partial", "paid", "cancelled"];
      if (!allowed.includes(body.status)) return jsonErr("حالة غير صحيحة");
      // خصم المخزون عند الانتقال من مسودة إلى مُرسلة
      if (invoice.status === "draft" && (body.status === "sent" || body.status === "paid")) {
        for (const it of invoice.items) {
          if (it.productId) {
            await db.product.update({
              where: { id: it.productId },
              data: { stock: { decrement: Math.round(it.quantity) } },
            });
          }
        }
      }
      const updated = await db.invoice.update({
        where: { id },
        data: { status: body.status, paidAmount: body.status === "paid" ? invoice.total : invoice.paidAmount },
      });
      await logActivity("status", "invoice", `تغيير حالة فاتورة ${invoice.number} إلى ${body.status}`);
      return Response.json(updated);
    }

    return jsonErr("لا يوجد تغيير مطلوب");
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const invoice = await db.invoice.findUnique({ where: { id }, include: { items: true } });
    if (!invoice) return jsonErr("الفاتورة غير موجودة", 404);
    // إرجاع المخزون إذا كانت الفاتورة مؤثرة على المخزون
    if (invoice.status === "sent" || invoice.status === "partial" || invoice.status === "paid") {
      for (const it of invoice.items) {
        if (it.productId) {
          await db.product.update({
            where: { id: it.productId },
            data: { stock: { increment: Math.round(it.quantity) } },
          });
        }
      }
    }
    await db.invoice.delete({ where: { id } });
    await logActivity("delete", "invoice", `حذف فاتورة ${invoice.number}`);
    return Response.json({ ok: true });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
