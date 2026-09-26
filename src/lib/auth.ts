/**
 * Garfix ERP — المصادقة والجلسات (المرحلة 5: المستخدمون والأمان)
 * تجزئة scrypt + جلسات خادمية في قاعدة البيانات + كوكي httpOnly موقّع بالنطاق
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { type Role, type SessionUser } from "@/lib/roles";

export { ROLE_LABELS, ROLE_ACCESS, type Role, type SessionUser } from "@/lib/roles";

export const SESSION_COOKIE = "garfix_session";
export const SESSION_TTL_DAYS = 7;

// ============ كلمات المرور ============

/** تجزئة كلمة المرور بصيغة salt:hash (scrypt) */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/** تحقق من كلمة المرور (timing-safe) */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ============ الجلسات ============

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** إنشاء جلسة جديدة — يعيد التوكن الخام (يوضع في الكوكي) */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt } });
  // تنظيف الجلسات المنتهية (صيانة تدريجية)
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return token;
}

/** إنهاء جلسة بالتوكن الخام */
export async function destroySession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

/** قراءة المستخدم الحالي من كوكي الجلسة — null عند عدم وجودها أو انتهائها */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const u = session.user;
  return { id: u.id, name: u.name, email: u.email, role: u.role as Role };
}

// ============ حماية مسارات الـ API ============

const json401 = () => Response.json({ error: "غير مصرح — سجّل الدخول أولاً" }, { status: 401 });
const json403 = () => Response.json({ error: "ليست لديك صلاحية لهذا الإجراء" }, { status: 403 });

/**
 * حارس مسارات الـ API:
 * const auth = await requireUser();                     // أي مستخدم مسجّل
 * const auth = await requireUser(["admin"]);            // أدوار محددة
 * if ("error" in auth) return auth.error;
 */
export async function requireUser(roles?: Role[]): Promise<{ user: SessionUser } | { error: Response }> {
  const user = await getSessionUser();
  if (!user) return { error: json401() };
  if (roles && !roles.includes(user.role)) return { error: json403() };
  return { user };
}
