/**
 * Garfix ERP — Expenses API (المصروفات)
 */
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { jsonErr, logActivity } from "@/lib/erp";

export async function GET() {
  const auth = await requireUser(["admin", "accountant"]);
  if ("error" in auth) return auth.error;
  try {
    const expenses = await db.expense.findMany({ orderBy: { date: "desc" } });
    const catLabels: Record<string, string> = {
      rent: "إيجار",
      salaries: "رواتب",
      purchases: "مشتريات",
      marketing: "تسويق",
      utilities: "مرافق",
      other: "أخرى",
    };
    return Response.json(
      expenses.map((e) => ({
        ...e,
        categoryLabel: catLabels[e.category] || e.category,
      }))
    );
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "accountant"]);
  if ("error" in auth) return auth.error;
  try {
    const body = await request.json();
    const amount = Number(body.amount);
    if (!body.category) return jsonErr("اختيار التصنيف مطلوب");
    if (!amount || amount <= 0) return jsonErr("قيمة المصروف غير صحيحة");
    const expense = await db.expense.create({
      data: {
        category: body.category,
        description: body.description?.trim() || null,
        amount: Math.round(amount * 100) / 100,
        vendor: body.vendor?.trim() || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });
    await logActivity("create", "expense", `تسجيل مصروف ${expense.amount} — ${expense.category}`, auth.user.email);
    return Response.json(expense, { status: 201 });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}
