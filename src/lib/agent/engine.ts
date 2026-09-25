/**
 * Garfix ERP — Agent Engine
 * محرك الوكلاء الأذكياء: يجمع سياق الأعمال من قاعدة البيانات
 * ثم يمرره لنموذج الذكاء الاصطناعي عبر z-ai-web-dev-sdk (server-side only)
 */
import { db } from "@/lib/db";
import { effectiveStatus } from "@/lib/erp";

export type AgentType = "finance" | "inventory" | "crm" | "general";

export const AGENTS: Record<
  AgentType,
  { name: string; description: string; systemPrompt: string }
> = {
  finance: {
    name: "المستشار المالي",
    description: "تحليل الإيرادات والمصروفات والأرباح واقتراح قرارات مالية",
    systemPrompt: `أنت "المستشار المالي" في نظام Garfix ERP — محلل مالي خبير في السوق المصري.
مهمتك: تحليل البيانات المالية للشركة والإجابة على أسئلة المستخدم بدقة ووضوح.
التزم بـ:
- الرد بالعربية الفصحى المبسطة مع مصطلحات مالية واضحة.
- ذكر أرقام محددة من البيانات المتاحة عند الاستشهاد.
- تقديم توصيات عملية قابلة للتنفيذ (بنود مرقمة عند الحاجة).
- الإشارة لأي مخاطر مالية (تدفق نقدي، ذمم متأخرة، هوامش ربح).`,
  },
  inventory: {
    name: "مساعد المخزون",
    description: "مراقبة مستويات المخزون وتنبيهات إعادة الطلب",
    systemPrompt: `أنت "مساعد المخزون" في نظام Garfix ERP — خبير إدارة مخزون.
مهمتك: تحليل مستويات المخزون، كشف النواقص، واقتراح كميات إعادة الطلب.
التزم بـ:
- الرد بالعربية الفصحى المبسطة.
- تحديد المنتجات الناقصة بدقة (الاسم والكمية الحالية والحد الأدنى).
- اقتراح كمية طلب معقولة بناءً على معدل الاستهلاك إن أمكن.
- التنبيه لمنتجات الحركة البطيئة إن وجدت.`,
  },
  crm: {
    name: "مساعد العملاء",
    description: "متابعة الذمم المتأخرة وصياغة رسائل تحصيل",
    systemPrompt: `أنت "مساعد العملاء" في نظام Garfix ERP — خبير علاقات عملاء وتحصيل ذمم.
مهمتك: تحليل حالة العملاء، متابعة الفواتير المتأخرة، وصياغة رسائل تحصيل مهذبة وفعالة.
التزم بـ:
- الرد بالعربية.
- عند طلب رسالة تحصيل: اكتبها بصيغة جاهزة للإرسال (مهذبة، حازمة، بالعربية).
- تحديد العملاء الأكثر تأخراً مع المبالغ وعدد الأيام.
- اقتراح خطة متابعة واقعية (مكالمة، رسالة، زيارة).`,
  },
  general: {
    name: "مساعد Garfix",
    description: "مساعد عام يجيب عن أي سؤال متعلق بالنظام والبيانات",
    systemPrompt: `أنت "مساعد Garfix" — المساعد الذكي العام لنظام Garfix ERP.
مهمتك: الإجابة عن أي سؤال حول بيانات الشركة (عملاء، فواتير، مخزون، مصروفات).
التزم بـ:
- الرد بالعربية.
- استخدام البيانات المتاحة في سياقك للإجابة بدقة.
- إذا كان السؤال خارج نطاق البيانات، أجب بمعرفتك العامة باختصار.`,
  },
};

const EGP = (n: number) =>
  `${Math.round(n).toLocaleString("en-US")} ج.م`;

/** يجمع سياق الأعمال الحالي من قاعدة البيانات */
export async function buildBusinessContext(): Promise<string> {
  const [invoices, expenses, products, clients, payments] = await Promise.all([
    db.invoice.findMany({
      include: { client: { select: { name: true, company: true } }, items: true },
    }),
    db.expense.findMany(),
    db.product.findMany(),
    db.client.findMany(),
    db.payment.findMany(),
  ]);

  const now = new Date();
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

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
  const last6: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = monthKey(d);
    last6.push(`${k}: إيرادات ${EGP(revenueByMonth.get(k) || 0)} / مصروفات ${EGP(expenseByMonth.get(k) || 0)}`);
  }

  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const active = invoices.filter((i) => i.status !== "cancelled" && i.status !== "draft");
  const receivables = active.reduce((s, i) => s + (i.total - i.paidAmount), 0);
  const overdue = active
    .filter((i) => effectiveStatus(i) === "overdue")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const overdueStr = overdue
    .slice(0, 10)
    .map(
      (i) =>
        `${i.number} — ${i.client.company || i.client.name} — متبقٍ ${EGP(i.total - i.paidAmount)} — متأخرة ${Math.floor(
          (now.getTime() - i.dueDate.getTime()) / 86400000
        )} يوم`
    )
    .join("\n");

  const lowStock = products.filter((p) => p.stock <= p.minStock);
  const lowStockStr = lowStock
    .map((p) => `${p.name} (${p.sku}) — متوفر ${p.stock} ${p.unit} / الحد الأدنى ${p.minStock}`)
    .join("\n");

  const inventoryValue = products.reduce((s, p) => s + p.stock * p.cost, 0);

  const topClients = clients
    .map((c) => ({
      name: c.company || c.name,
      total: c.invoices?.reduce((s, i) => s + i.total, 0) || 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((c) => `${c.name}: ${EGP(c.total)}`)
    .join("\n");

  const expenseByCat = new Map<string, number>();
  for (const e of expenses) {
    expenseByCat.set(e.category, (expenseByCat.get(e.category) || 0) + e.amount);
  }

  return `بيانات الشركة الحالية (محدّثة الآن):
— عدد العملاء: ${clients.length} (نشط: ${clients.filter((c) => c.status === "active").length})
— عدد المنتجات: ${products.length} / قيمة المخزون بالتكلفة: ${EGP(inventoryValue)}
— إجمالي الفواتير: ${invoices.length} (نشطة: ${active.length})
— إجمالي المدفوعات المستلمة: ${EGP(totalRevenue)}
— إجمالي المصروفات: ${EGP(totalExpenses)}
— صافي الربح التقديري: ${EGP(totalRevenue - totalExpenses)}
— الذمم المستحقة (غير محصلة): ${EGP(receivables)}
— إجمالي المتأخر: ${EGP(overdue.reduce((s, i) => s + (i.total - i.paidAmount), 0))} في ${overdue.length} فاتورة

الأداء الشهري (آخر 6 أشهر):
${last6.join("\n")}

المصروفات بالتصنيف:
${Array.from(expenseByCat.entries())
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${k}: ${EGP(v)}`)
  .join("\n")}

أهم العملاء:
${topClients || "لا يوجد"}

منتجات تحت الحد الأدنى:
${lowStockStr || "لا يوجد — المخزون سليم"}

الفواتير المتأخرة:
${overdueStr || "لا يوجد متأخرات — ممتاز!"}`;
}

/** تشغيل وكيل: يعيد رد النموذج مع تسجيل العملية */
export async function runAgent(agent: AgentType, query: string): Promise<{ response: string; duration: number }> {
  const started = Date.now();
  const agentDef = AGENTS[agent] ?? AGENTS.general;
  const context = await buildBusinessContext();

  const run = await db.agentRun.create({
    data: { agent, query: query.slice(0, 2000), status: "running" },
  });

  try {
    const { default: ZAI } = await import("z-ai-web-dev-sdk");
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: `${agentDef.systemPrompt}\n\n=== سياق بيانات الشركة ===\n${context}` },
        { role: "user", content: query },
      ],
      thinking: { type: "disabled" },
    });

    const response = completion.choices[0]?.message?.content ?? "لم يرد الوكيل برد.";
    const duration = Date.now() - started;
    await db.agentRun.update({
      where: { id: run.id },
      data: { response, status: "done", duration },
    });
    return { response, duration };
  } catch (e) {
    const duration = Date.now() - started;
    await db.agentRun.update({
      where: { id: run.id },
      data: { response: `خطأ: ${(e as Error).message}`, status: "error", duration },
    });
    throw e;
  }
}
