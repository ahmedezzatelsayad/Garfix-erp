/**
 * Garfix ERP — Invoices API
 */
import { db } from "@/lib/db";
import { jsonErr, logActivity, nextInvoiceNumber, getSettings } from "@/lib/erp";

export async function GET() {
  try {
    const invoices = await db.invoice.findMany({
      include: {
        client: { select: { name: true, company: true, phone: true } },
        items: true,
        payments: true,
      },
      orderBy: { issueDate: "desc" },
    });
    const now = Date.now();
    const result = invoices.map((i) => {
      const overdue =
        i.status !== "paid" && i.status !== "cancelled" && i.status !== "draft" &&
        i.dueDate.getTime() < now && i.paidAmount < i.total;
      return {
        id: i.id,
        number: i.number,
        clientId: i.clientId,
        clientName: i.client.company || i.client.name,
        clientPhone: i.client.phone,
        issueDate: i.issueDate,
        dueDate: i.dueDate,
        status: overdue ? "overdue" : i.status,
        itemCount: i.items.length,
        subtotal: i.subtotal,
        vatRate: i.vatRate,
        vatAmount: i.vatAmount,
        total: i.total,
        paidAmount: i.paidAmount,
        balance: Math.round((i.total - i.paidAmount) * 100) / 100,
        notes: i.notes,
        payments: i.payments,
      };
    });
    return Response.json(result);
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.clientId) return jsonErr("اختيار العميل مطلوب");
    const client = await db.client.findUnique({ where: { id: body.clientId } });
    if (!client) return jsonErr("العميل غير موجود", 404);

    const items: Array<{ productId?: string | null; description?: string; quantity: number; unitPrice: number }> =
      Array.isArray(body.items) ? body.items.filter((it: { description?: string }) => it.description?.trim()) : [];
    if (items.length === 0) return jsonErr("أضف بنداً واحداً على الأقل للفاتورة");

    const settings = await getSettings();
    const vatRate = Number(settings.vat_rate ?? 14);
    const applyVat = body.applyVat !== false;

    const preparedItems = items.map((it) => {
      const quantity = Number(it.quantity) || 1;
      const unitPrice = Number(it.unitPrice) || 0;
      return {
        productId: it.productId || null,
        description: it.description!.trim(),
        quantity,
        unitPrice,
        total: Math.round(quantity * unitPrice * 100) / 100,
      };
    });

    const subtotal = Math.round(preparedItems.reduce((s, it) => s + it.total, 0) * 100) / 100;
    const vatAmount = applyVat ? Math.round(subtotal * (vatRate / 100) * 100) / 100 : 0;
    const total = Math.round((subtotal + vatAmount) * 100) / 100;

    const number = await nextInvoiceNumber();
    const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
    const dueDate = body.dueDate ? new Date(body.dueDate) : (() => {
      const d = new Date(issueDate);
      d.setDate(d.getDate() + 30);
      return d;
    })();

    const invoice = await db.invoice.create({
      data: {
        number,
        clientId: body.clientId,
        issueDate,
        dueDate,
        status: body.status || "draft",
        subtotal,
        vatRate: applyVat ? vatRate : 0,
        vatAmount,
        total,
        paidAmount: 0,
        notes: body.notes?.trim() || null,
        items: { create: preparedItems },
      },
      include: { items: true, client: { select: { name: true, company: true } } },
    });

    // خصم المخزون إذا الفاتورة مُرسلة/مدفوعة
    if (body.status === "sent" || body.status === "paid") {
      for (const it of preparedItems) {
        if (it.productId) {
          await db.product.update({
            where: { id: it.productId },
            data: { stock: { decrement: Math.round(it.quantity) } },
          });
        }
      }
    }

    await logActivity("create", "invoice", `إنشاء فاتورة ${number} للعميل ${client.name}`);
    return Response.json(invoice, { status: 201 });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
