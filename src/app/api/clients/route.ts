/**
 * Garfix ERP — Clients API
 */
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonErr, logActivity } from "@/lib/erp";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const clients = await db.client.findMany({
      include: {
        invoices: {
          where: { status: { not: "cancelled" } },
          select: { total: true, paidAmount: true, status: true, dueDate: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    const now = Date.now();
    const result = clients.map((c) => {
      const total = c.invoices.reduce((s, i) => s + i.total, 0);
      const paid = c.invoices.reduce((s, i) => s + i.paidAmount, 0);
      const overdueCount = c.invoices.filter(
        (i) => i.status !== "paid" && i.status !== "draft" && i.dueDate.getTime() < now && i.paidAmount < i.total
      ).length;
      return {
        id: c.id,
        name: c.name,
        company: c.company,
        phone: c.phone,
        email: c.email,
        city: c.city,
        address: c.address,
        status: c.status,
        notes: c.notes,
        createdAt: c.createdAt,
        invoiceCount: c.invoices.length,
        totalBilled: Math.round(total * 100) / 100,
        totalPaid: Math.round(paid * 100) / 100,
        balance: Math.round((total - paid) * 100) / 100,
        overdueCount,
      };
    });
    return Response.json(result);
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json();
    if (!body.name?.trim()) return jsonErr("اسم العميل مطلوب");
    const client = await db.client.create({
      data: {
        name: body.name.trim(),
        company: body.company?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        city: body.city?.trim() || null,
        address: body.address?.trim() || null,
        status: body.status || "active",
        notes: body.notes?.trim() || null,
      },
    });
    await logActivity("create", "client", `إضافة عميل: ${client.name}`);
    return Response.json(client, { status: 201 });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
