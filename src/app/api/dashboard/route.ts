/**
 * Garfix ERP — Dashboard API
 * لوحة المعلومات: مؤشرات الأداء + بيانات الرسوم البيانية
 */
import { db } from "@/lib/db";
import { effectiveStatus } from "@/lib/erp";

export async function GET() {
  try {
    const [invoices, expenses, products, clients, payments] = await Promise.all([
      db.invoice.findMany({
        include: { client: { select: { name: true, company: true } }, payments: true },
        orderBy: { issueDate: "desc" },
      }),
      db.expense.findMany({ orderBy: { date: "asc" } }),
      db.product.findMany(),
      db.client.findMany({ include: { invoices: true } }),
      db.payment.findMany({ orderBy: { date: "desc" } }),
    ]);

    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    // ===== 6 أشهر: إيرادات مقابل مصروفات =====
    const months: { key: string; label: string }[] = [];
    const arMonths = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d), label: arMonths[d.getMonth()] });
    }

    const revenueByMonth = new Map<string, number>();
    for (const p of payments) {
      const k = monthKey(p.date);
      revenueByMonth.set(k, (revenueByMonth.get(k) || 0) + p.amount);
    }
    const expenseByMonth = new Map<string, number>();
    for (const e of expenses) {
      const k = monthKey(e.date);
      expenseByMonth.set(k, (expenseByMonth.get(k) || 0) + e.amount);
    }

    const trend = months.map((m) => ({
      month: m.label,
      revenue: Math.round((revenueByMonth.get(m.key) || 0) * 100) / 100,
      expenses: Math.round((expenseByMonth.get(m.key) || 0) * 100) / 100,
      profit: Math.round(((revenueByMonth.get(m.key) || 0) - (expenseByMonth.get(m.key) || 0)) * 100) / 100,
    }));

    // ===== KPIs =====
    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const activeInvoices = invoices.filter((i) => i.status !== "cancelled" && i.status !== "draft");
    const outstanding = activeInvoices.reduce((s, i) => s + (i.total - i.paidAmount), 0);
    const overdueList = activeInvoices.filter((i) => effectiveStatus(i) === "overdue");
    const overdueAmount = overdueList.reduce((s, i) => s + (i.total - i.paidAmount), 0);
    const inventoryValue = products.reduce((s, p) => s + p.stock * p.cost, 0);
    const lowStock = products.filter((p) => p.stock <= p.minStock);

    const thisMonthK = monthKey(now);
    const prevD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthK = monthKey(prevD);
    const revThis = revenueByMonth.get(thisMonthK) || 0;
    const revPrev = revenueByMonth.get(prevMonthK) || 0;
    const growth = revPrev > 0 ? ((revThis - revPrev) / revPrev) * 100 : 0;

    // ===== توزيع حالات الفواتير =====
    const statusMap = new Map<string, number>();
    for (const i of invoices) {
      const st = effectiveStatus(i);
      statusMap.set(st, (statusMap.get(st) || 0) + 1);
    }
    const statusLabels: Record<string, string> = {
      paid: "مدفوعة",
      partial: "مدفوعة جزئياً",
      sent: "مُرسلة",
      draft: "مسودة",
      overdue: "متأخرة",
      cancelled: "ملغاة",
    };
    const invoiceStatusDist = Array.from(statusMap.entries()).map(([k, v]) => ({
      status: k,
      label: statusLabels[k] || k,
      count: v,
    }));

    // ===== أعلى العملاء =====
    const clientTotals = clients
      .map((c) => ({
        name: c.company || c.name,
        total: c.invoices
          .filter((i) => i.status !== "cancelled" && i.status !== "draft")
          .reduce((s, i) => s + i.total, 0),
        count: c.invoices.length,
      }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    // ===== أحدث الفواتير =====
    const recentInvoices = invoices.slice(0, 8).map((i) => ({
      id: i.id,
      number: i.number,
      clientName: i.client.company || i.client.name,
      total: i.total,
      paidAmount: i.paidAmount,
      status: effectiveStatus(i),
      issueDate: i.issueDate,
      dueDate: i.dueDate,
    }));

    // ===== توزيع المصروفات =====
    const expCats = new Map<string, number>();
    for (const e of expenses) {
      expCats.set(e.category, (expCats.get(e.category) || 0) + e.amount);
    }
    const catLabels: Record<string, string> = {
      rent: "إيجار",
      salaries: "رواتب",
      purchases: "مشتريات",
      marketing: "تسويق",
      utilities: "مرافق",
      other: "أخرى",
    };
    const expenseByCategory = Array.from(expCats.entries())
      .map(([k, v]) => ({ category: k, label: catLabels[k] || k, amount: Math.round(v * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);

    return Response.json({
      kpis: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        netProfit: Math.round((totalRevenue - totalExpenses) * 100) / 100,
        outstanding: Math.round(outstanding * 100) / 100,
        overdueCount: overdueList.length,
        overdueAmount: Math.round(overdueAmount * 100) / 100,
        inventoryValue: Math.round(inventoryValue * 100) / 100,
        clientCount: clients.filter((c) => c.status === "active").length,
        invoiceCount: invoices.length,
        revenueGrowth: Math.round(growth * 10) / 10,
        avgInvoice: activeInvoices.length
          ? Math.round((activeInvoices.reduce((s, i) => s + i.total, 0) / activeInvoices.length) * 100) / 100
          : 0,
      },
      trend,
      invoiceStatusDist,
      topClients: clientTotals,
      recentInvoices,
      expenseByCategory,
      lowStock: lowStock.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        minStock: p.minStock,
        unit: p.unit,
      })),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
