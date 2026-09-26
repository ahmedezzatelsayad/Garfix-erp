/**
 * Garfix ERP — Users API (المرحلة 5 — للمدير فقط)
 * GET: قائمة المستخدمين | POST: إنشاء مستخدم
 */
import { db } from "@/lib/db";
import { requireUser, hashPassword, type Role } from "@/lib/auth";
import { jsonErr, logActivity } from "@/lib/erp";

const ROLES: Role[] = ["admin", "accountant", "sales"];

export async function GET() {
  const auth = await requireUser(["admin"]);
  if ("error" in auth) return auth.error;
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    return Response.json({ users });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin"]);
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const role = String(body.role || "sales") as Role;

    if (!name) return jsonErr("اسم المستخدم مطلوب");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return jsonErr("بريد إلكتروني غير صالح");
    if (password.length < 8) return jsonErr("كلمة المرور 8 أحرف على الأقل");
    if (!ROLES.includes(role)) return jsonErr("دور غير معروف");

    const exists = await db.user.findUnique({ where: { email } });
    if (exists) return jsonErr("هذا البريد مستخدم بالفعل");

    const user = await db.user.create({
      data: { name, email, role, passwordHash: hashPassword(password) },
    });
    await logActivity("create", "user", `إنشاء مستخدم ${name} (${role})`, auth.user.email);
    return Response.json({ ok: true, user: { id: user.id, name, email, role } }, { status: 201 });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
