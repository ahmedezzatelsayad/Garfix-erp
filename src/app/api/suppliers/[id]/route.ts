/**
 * Garfix ERP — Supplier [id] API (المرحلة 6)
 */
import { db } from "@/lib/db";
import { jsonErr, logActivity } from "@/lib/erp";
import { requireUser } from "@/lib/auth";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["admin", "accountant"]);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) return jsonErr("المورد غير موجود", 404);

    const data: Record<string, string | null> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.company !== undefined) data.company = body.company?.trim() || null;
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.email !== undefined) data.email = body.email?.trim() || null;
    if (body.city !== undefined) data.city = body.city?.trim() || null;
    if (body.address !== undefined) data.address = body.address?.trim() || null;
    if (body.taxId !== undefined) data.taxId = body.taxId?.trim() || null;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
    if (body.status !== undefined) data.status = body.status;

    const supplier = await db.supplier.update({ where: { id }, data });

    await logActivity("update", "supplier", `تعديل مورد ${supplier.name}`, auth.user.email);
    return Response.json(supplier);
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["admin", "accountant"]);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await ctx.params;
    const existing = await db.supplier.findUnique({
      where: { id },
      include: { purchases: { select: { id: true, status: true } } },
    });
    if (!existing) return jsonErr("المورد غير موجود", 404);

    // منع حذف مورد له فواتير مشتريات فعلية — الحل: تعطيله بدلاً من الحذف
    const realPurchases = existing.purchases.filter((p) => p.status !== "cancelled");
    if (realPurchases.length > 0) {
      await db.supplier.update({ where: { id }, data: { status: "inactive" } });
      await logActivity(
        "deactivate",
        "supplier",
        `تعطيل مورد ${existing.name} (له ${realPurchases.length} فاتورة مشتريات)`,
        auth.user.email
      );
      return Response.json({
        ok: true,
        deactivated: true,
        message: `لا يمكن حذف مورد له فواتير مشتريات — تم تعطيله بدلاً من الحذف`,
      });
    }

    await db.supplier.delete({ where: { id } });
    await logActivity("delete", "supplier", `حذف مورد ${existing.name}`, auth.user.email);
    return Response.json({ ok: true });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
