/**
 * Garfix ERP — Backup API (المرحلة 5 — للمدير فقط)
 * GET  /api/backup                    → نسخة JSON كاملة (تنزيل)
 * GET  /api/backup?format=csv&table=X → CSV لجدول واحد (clients|products|invoices|payments|expenses)
 * POST /api/backup                    → استرجاع نسخة JSON (يستبدل البيانات الحالية)
 */
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { jsonErr, logActivity } from "@/lib/erp";

const TABLES = ["clients", "products", "invoices", "invoiceItems", "payments", "expenses", "agentRuns", "activityLogs", "settings"] as const;

interface BackupShape {
  app: string;
  version: number;
  exportedAt: string;
  counts: Record<string, number>;
  data: {
    clients: unknown[];
    products: unknown[];
    invoices: unknown[];
    invoiceItems: unknown[];
    payments: unknown[];
    expenses: unknown[];
    agentRuns: unknown[];
    activityLogs: unknown[];
    settings: { key: string; value: string; updatedAt?: string | Date }[];
  };
}

async function buildBackup(): Promise<BackupShape> {
  const [clients, products, invoices, invoiceItems, payments, expenses, agentRuns, activityLogs, settings] =
    await Promise.all([
      db.client.findMany(),
      db.product.findMany(),
      db.invoice.findMany(),
      db.invoiceItem.findMany(),
      db.payment.findMany(),
      db.expense.findMany(),
      db.agentRun.findMany(),
      db.activityLog.findMany(),
      db.setting.findMany(),
    ]);

  return {
    app: "garfix-erp",
    version: 5,
    exportedAt: new Date().toISOString(),
    counts: {
      clients: clients.length,
      products: products.length,
      invoices: invoices.length,
      invoiceItems: invoiceItems.length,
      payments: payments.length,
      expenses: expenses.length,
    },
    data: { clients, products, invoices, invoiceItems, payments, expenses, agentRuns, activityLogs, settings },
  };
}

/** CSV rows */
const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(","));
  // BOM لتظهر العربية سليمة في Excel
  return "\uFEFF" + lines.join("\n");
}

export async function GET(request: Request) {
  const auth = await requireUser(["admin"]);
  if ("error" in auth) return auth.error;

  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    const table = url.searchParams.get("table");

    if (format === "csv") {
      const stamp = new Date().toISOString().slice(0, 10);
      let rows: Record<string, unknown>[];
      let name = table || "export";
      switch (table) {
        case "clients":
          rows = (await db.client.findMany({ orderBy: { createdAt: "asc" } })) as Record<string, unknown>[];
          break;
        case "products":
          rows = (await db.product.findMany({ orderBy: { createdAt: "asc" } })) as Record<string, unknown>[];
          break;
        case "invoices":
          rows = (await db.invoice.findMany({ orderBy: { issueDate: "asc" } })) as Record<string, unknown>[];
          break;
        case "payments":
          rows = (await db.payment.findMany({ orderBy: { date: "asc" } })) as Record<string, unknown>[];
          break;
        case "expenses":
          rows = (await db.expense.findMany({ orderBy: { date: "asc" } })) as Record<string, unknown>[];
          break;
        default:
          return jsonErr("جدول غير معروف — المتاح: clients | products | invoices | payments | expenses");
      }
      return new Response(toCSV(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="garfix-${name}-${stamp}.csv"`,
        },
      });
    }

    const backup = await buildBackup();
    const stamp = backup.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="garfix-backup-${stamp}.json"`,
      },
    });
  } catch (e) {
    return jsonErr((e as Error).message, 500);
  }
}

/** استرجاع نسخة احتياطية — يستبدل كل بيانات ERP (ليس المستخدمين/الجلسات) */
export async function POST(request: Request) {
  const auth = await requireUser(["admin"]);
  if ("error" in auth) return auth.error;
  try {
    const body = (await request.json()) as Partial<BackupShape>;
    if (body.app !== "garfix-erp" || !body.data) {
      return jsonErr("ملف غير صالح — ليس نسخة Garfix ERP احتياطية");
    }
    const d = body.data;
    if (!Array.isArray(d.clients) || !Array.isArray(d.invoices) || !Array.isArray(d.invoiceItems)) {
      return jsonErr("بنية النسخة ناقصة (clients/invoices/invoiceItems مطلوبة)");
    }

    // تعقيم التواريخ (JSON يخزنها نصوصاً)
    const revive = (rows: unknown[] | undefined, dateKeys: string[]) =>
      (rows ?? []).map((r) => {
        const row = { ...(r as Record<string, unknown>) };
        for (const k of dateKeys) if (typeof row[k] === "string") row[k] = new Date(row[k] as string);
        return row;
      });

    const clients = revive(d.clients, ["createdAt", "updatedAt"]);
    const products = revive(d.products, ["createdAt", "updatedAt"]);
    const invoices = revive(d.invoices, ["issueDate", "dueDate", "createdAt", "updatedAt"]);
    const invoiceItems = revive(d.invoiceItems, []);
    const payments = revive(d.payments, ["date"]);
    const expenses = revive(d.expenses, ["date"]);
    const agentRuns = revive(d.agentRuns, ["createdAt"]);
    const activityLogs = revive(d.activityLogs, ["createdAt"]);
    const settings = (d.settings ?? []).map((s) => ({
      key: String(s.key),
      value: String(s.value),
      ...(s.updatedAt ? { updatedAt: new Date(s.updatedAt) } : {}),
    }));

    await db.$transaction([
      db.payment.deleteMany(),
      db.invoiceItem.deleteMany(),
      db.invoice.deleteMany(),
      db.expense.deleteMany(),
      db.product.deleteMany(),
      db.client.deleteMany(),
      db.agentRun.deleteMany(),
      db.activityLog.deleteMany(),
      db.setting.deleteMany(),
      ...clients.map((c) => db.client.create({ data: c as never })),
      ...products.map((p) => db.product.create({ data: p as never })),
      ...invoices.map((i) => db.invoice.create({ data: i as never })),
      ...invoiceItems.map((i) => db.invoiceItem.create({ data: i as never })),
      ...payments.map((p) => db.payment.create({ data: p as never })),
      ...expenses.map((e) => db.expense.create({ data: e as never })),
      ...agentRuns.map((a) => db.agentRun.create({ data: a as never })),
      ...activityLogs.map((a) => db.activityLog.create({ data: a as never })),
      ...settings.map((s) => db.setting.create({ data: s as never })),
    ]);

    await logActivity(
      "create",
      "backup",
      `استرجاع نسخة احتياطية: ${invoices.length} فاتورة، ${clients.length} عميل، ${payments.length} دفعة`,
      auth.user.email
    );
    return Response.json({ ok: true, restored: { invoices: invoices.length, clients: clients.length, payments: payments.length } });
  } catch (e) {
    return jsonErr(`تعذر الاسترجاع: ${(e as Error).message}`, 500);
  }
}
