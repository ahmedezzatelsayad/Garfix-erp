/**
 * Garfix ERP — Client [id] API
 */
import { db } from "@/lib/db";
import { jsonErr, logActivity } from "@/lib/erp";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await db.client.findUnique({ where: { id } });
    if (!existing) return jsonErr("العميل غير موجود", 404);
    const client = await db.client.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existing.name,
        company: body.company?.trim() ?? existing.company,
        phone: body.phone?.trim() ?? existing.phone,
        email: body.email?.trim() ?? existing.email,
        city: body.city?.trim() ?? existing.city,
        address: body.address?.trim() ?? existing.address,
        status: body.status ?? existing.status,
        notes: body.notes?.trim() ?? existing.notes,
      },
    });
    await logActivity("update", "client", `تحديث عميل: ${client.name}`, auth.user.email);
    return Response.json(client);
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireUser(["admin", "accountant"]);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await params;
    const existing = await db.client.findUnique({
      where: { id },
      include: { _count: { select: { invoices: true } } },
    });
    if (!existing) return jsonErr("العميل غير موجود", 404);
    if (existing._count.invoices > 0) {
      return jsonErr(`لا يمكن حذف العميل لوجود ${existing._count.invoices} فاتورة مرتبطة به`, 409);
    }
    await db.client.delete({ where: { id } });
    await logActivity("delete", "client", `حذف عميل: ${existing.name}`, auth.user.email);
    return Response.json({ ok: true });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
