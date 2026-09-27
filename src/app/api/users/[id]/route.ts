/**
 * Garfix ERP — User [id] API (المرحلة 5 — للمدير فقط)
 * PATCH: تعديل البيانات/الدور/الحالة/كلمة المرور | DELETE: حذف المستخدم
 */
import { db } from "@/lib/db";
import { requireUser, hashPassword, type Role } from "@/lib/auth";
import { jsonErr, logActivity } from "@/lib/erp";

const ROLES: Role[] = ["admin", "accountant", "sales"];

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireUser(["admin"]);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return jsonErr("المستخدم غير موجود", 404);

    const data: Record<string, unknown> = {};

    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.role === "string") {
      if (!ROLES.includes(body.role as Role)) return jsonErr("دور غير معروف");
      data.role = body.role;
    }
    if (typeof body.isActive === "boolean") {
      if (!body.isActive && user.id === auth.user.id) return jsonErr("لا يمكنك إيقاف حسابك الخاص");
      data.isActive = body.isActive;
    }
    if (typeof body.password === "string" && body.password) {
      if (body.password.length < 8) return jsonErr("كلمة المرور 8 أحرف على الأقل");
      data.passwordHash = hashPassword(body.password);
    }

    if (Object.keys(data).length === 0) return jsonErr("لا توجد تغييرات");

    await db.user.update({ where: { id }, data });
    await logActivity("update", "user", `تحديث المستخدم ${user.name}`, auth.user.email);
    return Response.json({ ok: true });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await requireUser(["admin"]);
  if ("error" in auth) return auth.error;
  try {
    const { id } = await ctx.params;
    if (id === auth.user.id) return jsonErr("لا يمكنك حذف حسابك الخاص");
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return jsonErr("المستخدم غير موجود", 404);

    // حماية: لا حذف لآخر مدير نشط
    if (user.role === "admin" && user.isActive) {
      const activeAdmins = await db.user.count({ where: { role: "admin", isActive: true, NOT: { id } } });
      if (activeAdmins === 0) return jsonErr("لا يمكن حذف آخر مدير نشط في النظام");
    }

    await db.user.delete({ where: { id } }); // الجلسات تُحذف تلقائياً (Cascade)
    await logActivity("delete", "user", `حذف المستخدم ${user.name}`, auth.user.email);
    return Response.json({ ok: true });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
