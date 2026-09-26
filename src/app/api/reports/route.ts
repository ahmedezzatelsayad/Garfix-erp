/**
 * Garfix ERP — Reports API (المرحلة 4: التقارير المالية)
 * قائمة الدخل | تقادم الذمم | تقييم المخزون | أداء العملاء
 */
import { db } from "@/lib/db";
import { effectiveStatus } from "@/lib/erp";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const auth = await requireUser(["admin", "accountant"]);
  if ("error" in auth) return auth.error;
  try {
    const [invoices, expenses, products, clients, payments] = await Promise.all([
      db.invoice.findMany({
        include: { client: true, items: { include: { product: true } } },
      }),
      db.expense.findMany(),
      db.product.findMany(),
      db.client.findMany({ include: { invoices: { include: { payments: true } } } }),
      db.payment.findMany({ include: { invoice: { include: { items: { include: { product: { select: { cost: true } } } } } } } }),
    ]);

    const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const now = new Date();

    // ===== قائمة الدخل (آخر 6 أشهر + الإجمالي) =====
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthsList: { key: string; label: string; year: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsList.push({ key: monthKey(d), label: arMonths[d.getMonth()], year: d.getFullYear() });
    }

    const revenueByMonth = new Map<string, number>();
    const cogsByMonth = new Map<string, number>();
    for (const p of payments) {
      const k = monthKey(p.date);
      revenueByMonth.set(k, (revenueByMonth.get(k) || 0) + p.amount);
      // تكلفة البضاعة المباعة تقديرياً من بنود الفاتورة
      let cogs = 0;
      for (const item of p.invoice.items) {
        cogs += (item.product?.cost ?? item.unitPrice * 0.8) * item.quantity;
      }
      cogsByMonth.set(k, (cogsByMonth.get(k) || 0) + cogs);
    }
    const opexByMonth = new Map<string, number>();
    for (const e of expenses) {
      const k = monthKey(e.date);
      opexByMonth.set(k, (opexByMonth.get(k) || 0) + e.amount);
    }

    const pnl = monthsList.map((m) => {
      const revenue = revenueByMonth.get(m.key) || 0;
      const cogs = cogsByMonth.get(m.key) || 0;
      const opex = opexByMonth.get(m.key) || 0;
      const gross = revenue - cogs;
      return {
        month: m.label,
        revenue: Math.round(revenue * 100) / 100,
        cogs: Math.round(cogs * 100) / 100,
        grossProfit: Math.round(gross * 100) / 100,
        opex: Math.round(opex * 100) / 100,
        netProfit: Math.round((gross - opex) * 100) / 100,
        grossMargin: revenue > 0 ? Math.round((gross / revenue) * 1000) / 10 : 0,
        netMargin: revenue > 0 ? Math.round(((gross - opex) / revenue) * 1000) / 10 : 0,
      };
    });

    // ===== تقادم الذمم (Aging) =====
    const agingBuckets = [
      { label: "غير مستحقة بعد", min: -Infinity, max: 0, amount: 0, count: 0 },
      { label: "1-30 يوم", min: 1, max: 30, amount: 0, count: 0 },
      { label: "31-60 يوم", min: 31, max: 60, amount: 0, count: 0 },
      { label: "61-90 يوم", min: 61, max: 90, amount: 0, count: 0 },
      { label: "أكثر من 90 يوم", min: 91, max: Infinity, amount: 0, count: 0 },
    ];
    const overdueInvoices: {
      number: string;
      client: string;
      total: number;
      balance: number;
      daysLate: number;
      bucket: string;
    }[] = [];

    for (const inv of invoices) {
      if (inv.status === "paid" || inv.status === "cancelled" || inv.status === "draft") continue;
      const balance = inv.total - inv.paidAmount;
      if (balance <= 0.01) continue;
      const daysDiff = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000);
      const bucket = agingBuckets.find((b) => daysDiff >= b.min && daysDiff <= b.max)!;
      bucket.amount += balance;
      bucket.count += 1;
      if (daysDiff > 0) {
        overdueInvoices.push({
          number: inv.number,
          client: inv.client.company || inv.client.name,
          total: inv.total,
          balance: Math.round(balance * 100) / 100,
          daysLate: daysDiff,
          bucket: bucket.label,
        });
      }
    }
    const aging = agingBuckets.map((b) => ({
      label: b.label,
      amount: Math.round(b.amount * 100) / 100,
      count: b.count,
    }));
    overdueInvoices.sort((a, b) => b.daysLate - a.daysLate);

    // ===== تقييم المخزون =====
    const inventoryValuation = {
      totalValue: Math.round(products.reduce((s, p) => s + p.stock * p.cost, 0) * 100) / 100,
      totalRetail: Math.round(products.reduce((s, p) => s + p.stock * p.price, 0) * 100) / 100,
      itemCount: products.length,
      lowStockCount: products.filter((p) => p.stock <= p.minStock).length,
      byCategory: Object.entries(
        products.reduce<Record<string, { value: number; count: number }>>((acc, p) => {
          const cat = p.category || "غير مصنف";
          if (!acc[cat]) acc[cat] = { value: 0, count: 0 };
          acc[cat].value += p.stock * p.cost;
          acc[cat].count += 1;
          return acc;
        }, {})
      ).map(([cat, v]) => ({
        category: cat,
        value: Math.round(v.value * 100) / 100,
        count: v.count,
      })),
    };

    // ===== أداء العملاء =====
    const clientPerformance = clients
      .map((c) => {
        const active = c.invoices.filter((i) => i.status !== "cancelled" && i.status !== "draft");
        const billed = active.reduce((s, i) => s + i.total, 0);
        const paid = active.reduce((s, i) => s + i.paidAmount, 0);
        const overdue = active.filter((i) => effectiveStatus(i) === "overdue");
        return {
          name: c.company || c.name,
          city: c.city,
          status: c.status,
          invoiceCount: active.length,
          billed: Math.round(billed * 100) / 100,
          paid: Math.round(paid * 100) / 100,
          balance: Math.round((billed - paid) * 100) / 100,
          overdueCount: overdue.length,
          overdueAmount: Math.round(overdue.reduce((s, i) => s + (i.total - i.paidAmount), 0) * 100) / 100,
          paymentRate: billed > 0 ? Math.round((paid / billed) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.billed - a.billed);

    // ===== ملخص تنفيذي =====
    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const summary = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round((totalRevenue - totalExpenses) * 100) / 100,
      totalReceivables: aging.reduce((s, b) => s + b.amount, 0),
      overdueTotal: aging.slice(1).reduce((s, b) => s + b.amount, 0),
    };

    return Response.json({ pnl, aging, overdueInvoices, inventoryValuation, clientPerformance, summary });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
