/**
 * Garfix ERP — Products API (المخزون)
 */
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonErr, logActivity } from "@/lib/erp";

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const products = await db.product.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
    });
    const result = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      unit: p.unit,
      price: p.price,
      cost: p.cost,
      stock: p.stock,
      minStock: p.minStock,
      soldCount: p._count.items,
      stockValue: Math.round(p.stock * p.cost * 100) / 100,
      low: p.stock <= p.minStock,
      margin: p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 1000) / 10 : 0,
    }));
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
    if (!body.name?.trim()) return jsonErr("اسم المنتج مطلوب");
    if (!body.sku?.trim()) return jsonErr("رمز المنتج (SKU) مطلوب");
    const dup = await db.product.findUnique({ where: { sku: body.sku.trim() } });
    if (dup) return jsonErr("رمز المنتج مستخدم بالفعل", 409);
    const product = await db.product.create({
      data: {
        name: body.name.trim(),
        sku: body.sku.trim(),
        category: body.category?.trim() || null,
        unit: body.unit?.trim() || "قطعة",
        price: Number(body.price) || 0,
        cost: Number(body.cost) || 0,
        stock: Number(body.stock) || 0,
        minStock: Number(body.minStock) ?? 5,
      },
    });
    await logActivity("create", "product", `إضافة منتج: ${product.name}`, auth.user.email);
    return Response.json(product, { status: 201 });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
