/**
 * Garfix ERP — Auth API (المرحلة 5)
 * POST /api/auth/login  → تسجيل الدخول (كوكي httpOnly)
 * GET  /api/auth/login  → من أنا؟
 * DELETE /api/auth/login → تسجيل الخروج
 * PUT  /api/auth/login  → بذر الحسابات التجريبية الثلاثة
 */
import { db } from "@/lib/db";
import { createSession, destroySession, getSessionUser, hashPassword, verifyPassword, SESSION_COOKIE, SESSION_TTL_DAYS, type Role } from "@/lib/auth";
import { jsonErr, logActivity } from "@/lib/erp";
import { cookies } from "next/headers";

const ROLE_SEED: { role: Role; name: string; email: string; password: string }[] = [
  { role: "admin", name: "أحمد السيد", email: "admin@garfix.app", password: "Admin@123" },
  { role: "accountant", name: "سارة المحاسبة", email: "accountant@garfix.app", password: "Acc@12345" },
  { role: "sales", name: "خالد المبيعات", email: "sales@garfix.app", password: "Sales@12345" },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) return jsonErr("البريد الإلكتروني وكلمة المرور مطلوبان");

    let user = await db.user.findUnique({ where: { email } });

    // أول تشغيل: إنشاء حساب المدير الافتراضي تلقائياً (بيانات تجريبية — غيّرها بعد أول دخول)
    if (!user && email === "admin@garfix.app" && password === "Admin@123") {
      user = await db.user.create({
        data: { name: "أحمد السيد", email, role: "admin", passwordHash: hashPassword(password) },
      });
      await logActivity("seed", "user", "إنشاء حساب المدير الافتراضي", email);
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return jsonErr("بيانات الدخول غير صحيحة", 401);
    }
    if (!user.isActive) {
      return jsonErr("هذا الحساب موقوف — راجع مدير النظام", 403);
    }

    const token = await createSession(user.id);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_DAYS * 86400,
    });

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await logActivity("login", "user", `تسجيل دخول ${user.name}`, user.email);

    return Response.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

/** GET: من أنا؟ (للتحقق من الجلسة من الواجهة) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonErr("غير مصرح — سجّل الدخول أولاً", 401);
  return Response.json({ user });
}

/** DELETE: تسجيل الخروج */
export async function DELETE() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const user = await getSessionUser();
  if (token) await destroySession(token);
  jar.delete(SESSION_COOKIE);
  if (user) await logActivity("logout", "user", `تسجيل خروج ${user.name}`, user.email);
  return Response.json({ ok: true });
}

/** PUT: إنشاء بذر الحسابات التجريبية الثلاثة (اختياري) */
export async function PUT() {
  try {
    const created: string[] = [];
    for (const u of ROLE_SEED) {
      const exists = await db.user.findUnique({ where: { email: u.email } });
      if (!exists) {
        await db.user.create({
          data: { name: u.name, email: u.email, role: u.role, passwordHash: hashPassword(u.password) },
        });
        created.push(u.email);
      }
    }
    return Response.json({ ok: true, created });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
