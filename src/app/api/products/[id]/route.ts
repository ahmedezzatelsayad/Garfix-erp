/**
 * Garfix ERP — Product [id] API
 */
import { db } from "@/lib/db";
import { jsonErr, logActivity } from "@/lib/erp";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser(["admin", "accountant"]);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) return jsonErr("المنتج غير موجود", 404);
    if (body.sku && body.sku.trim() !== existing.sku) {
      const dup = await db.product.findUnique({ where: { sku: body.sku.trim() } });
      if (dup) return jsonErr("رمز المنتج مستخدم بالفعل", 409);
    }
    const product = await db.product.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existing.name,
        sku: body.sku?.trim() ?? existing.sku,
        category: body.category?.trim() ?? existing.category,
        unit: body.unit?.trim() ?? existing.unit,
        price: body.price !== undefined ? Number(body.price) : existing.price,
        cost: body.cost !== undefined ? Number(body.cost) : existing.cost,
        stock: body.stock !== undefined ? Number(body.stock) : existing.stock,
        minStock: body.minStock !== undefined ? Number(body.minStock) : existing.minStock,
      },
    });
    await logActivity("update", "product", `تحديث منتج: ${product.name}`, auth.user.email);
    return Response.json(product);
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser(["admin", "accountant"]);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const existing = await db.product.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!existing) return jsonErr("المنتج غير موجود", 404);
    await db.product.delete({ where: { id } });
    await logActivity("delete", "product", `حذف منتج: ${existing.name}`, auth.user.email);
    return Response.json({ ok: true });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
