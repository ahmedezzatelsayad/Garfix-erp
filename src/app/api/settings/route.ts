/**
 * Garfix ERP — Settings API (الإعدادات)
 */
import { db } from "@/lib/db";
import { getSettings, jsonErr, logActivity } from "@/lib/erp";

export async function GET() {
  try {
    const settings = await getSettings();
    const activity = await db.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return Response.json({ settings, activity });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string>;
    const allowed = [
      "company_name",
      "company_phone",
      "company_email",
      "company_address",
      "currency",
      "vat_rate",
      "invoice_prefix",
      "fiscal_year_start",
    ];
    const entries = Object.entries(body).filter(([k, v]) => allowed.includes(k) && typeof v === "string" && v.trim() !== "");
    if (entries.length === 0) return jsonErr("لا توجد إعدادات صحيحة للتحديث");

    for (const [key, value] of entries) {
      await db.setting.upsert({
        where: { key },
        update: { value: value.trim() },
        create: { key, value: value.trim() },
      });
    }
    await logActivity("update", "settings", `تحديث الإعدادات: ${entries.map(([k]) => k).join(", ")}`);
    const settings = await getSettings();
    return Response.json({ settings, ok: true });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
