/**
 * Garfix ERP — Suppliers API (المرحلة 6: المشتريات والموردون)
 */
import { db } from "@/lib/db";
import { jsonErr, logActivity } from "@/lib/erp";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const suppliers = await db.supplier.findMany({
      include: {
        purchases: {
          where: { status: { notIn: ["cancelled", "draft"] } },
          select: { status: true, total: true, paidAmount: true, dueDate: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    const now = Date.now();
    const result = suppliers.map((s) => {
      const purchased = s.purchases.reduce((sum, p) => sum + p.total, 0);
      const paid = s.purchases.reduce((sum, p) => sum + p.paidAmount, 0);
      const overdue = s.purchases.filter(
        (p) => p.status !== "paid" && p.total - p.paidAmount > 0.01 && p.dueDate.getTime() < now
      );
      return {
        id: s.id,
        name: s.name,
        company: s.company,
        phone: s.phone,
        email: s.email,
        city: s.city,
        address: s.address,
        taxId: s.taxId,
        notes: s.notes,
        status: s.status,
        purchaseCount: s.purchases.length,
        purchased: Math.round(purchased * 100) / 100,
        paid: Math.round(paid * 100) / 100,
        balance: Math.round((purchased - paid) * 100) / 100,
        overdueCount: overdue.length,
        overdueAmount: Math.round(overdue.reduce((sum, p) => sum + (p.total - p.paidAmount), 0) * 100) / 100,
        createdAt: s.createdAt,
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
    if (!body.name?.trim()) return jsonErr("اسم المورد مطلوب");

    const supplier = await db.supplier.create({
      data: {
        name: body.name.trim(),
        company: body.company?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        city: body.city?.trim() || null,
        address: body.address?.trim() || null,
        taxId: body.taxId?.trim() || null,
        notes: body.notes?.trim() || null,
        status: body.status || "active",
      },
    });

    await logActivity("create", "supplier", `إضافة مورد ${supplier.name}`, auth.user.email);
    return Response.json(supplier, { status: 201 });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
