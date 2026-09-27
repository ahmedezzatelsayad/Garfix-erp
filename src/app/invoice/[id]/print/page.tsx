/**
 * Garfix ERP — صفحة طباعة الفاتورة (المرحلة 5)
 * A4 عربي RTL — تُحوَّل PDF من حوار الطباعة
 */
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/erp";
import { getSessionUser } from "@/lib/auth";
import { PrintToolbar } from "./print-toolbar";
import { Wrench } from "lucide-react";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> };

const AR_MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

const fmtDate = (d: Date) => `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const EGP = (n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "مسودة", cls: "bg-slate-100 text-slate-600 border-slate-300" },
  sent: { label: "مُرسلة", cls: "bg-sky-50 text-sky-700 border-sky-300" },
  partial: { label: "مدفوعة جزئياً", cls: "bg-amber-50 text-amber-700 border-amber-300" },
  paid: { label: "مدفوعة بالكامل", cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  overdue: { label: "متأخرة السداد", cls: "bg-red-50 text-red-700 border-red-300" },
  cancelled: { label: "ملغاة", cls: "bg-zinc-100 text-zinc-500 line-through border-zinc-300" },
};

const METHOD_LABELS: Record<string, string> = {
  cash: "نقدي",
  bank: "تحويل بنكي",
  wallet: "محفظة إلكترونية",
  cheque: "شيك",
};

export default async function InvoicePrintPage({ params, searchParams }: Props) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { auto } = await searchParams;

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      items: { include: { product: { select: { sku: true } } } },
      payments: { orderBy: { date: "asc" } },
    },
  });
  if (!invoice) notFound();

  const s = await getSettings();
  const company = {
    name: s.company_name || "Garfix",
    phone: s.company_phone || "",
    email: s.company_email || "",
    address: s.company_address || "",
  };

  const st = STATUS_LABELS[invoice.status] ?? { label: invoice.status, cls: "bg-slate-100 text-slate-600 border-slate-300" };
  const balance = invoice.total - invoice.paidAmount;
  const isOverdue =
    invoice.status !== "paid" && invoice.status !== "cancelled" && invoice.status !== "draft" &&
    invoice.dueDate.getTime() < Date.now() && balance > 0.01;

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      <PrintToolbar auto={auto === "1"} />

      {/* ===== الفاتورة A4 ===== */}
      <div dir="rtl" className="bg-white text-zinc-800 mx-auto my-6 print:my-0 shadow-lg print:shadow-none w-[210mm] max-w-full print:w-auto font-cairo">
        <style>{`
          @page { size: A4 portrait; margin: 0; }
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
          }
          .inv-table th, .inv-table td { border-color: #e4e4e7 !important; }
        `}</style>

        <div className="p-10 print:p-12">
          {/* ===== الترويسة ===== */}
          <div className="flex items-start justify-between gap-6 pb-6 border-b-2 border-emerald-600">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-600 p-2.5">
                <Wrench className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-2xl leading-tight text-zinc-900">{company.name}</p>
                <p className="text-xs text-zinc-500 tracking-wide">نظام Garfix ERP</p>
              </div>
            </div>
            <div className="text-xs text-zinc-600 space-y-0.5 text-left">
              {company.phone && <p dir="ltr">{company.phone}</p>}
              {company.email && <p dir="ltr">{company.email}</p>}
              {company.address && <p>{company.address}</p>}
            </div>
          </div>

          {/* ===== عنوان الفاتورة والبيانات ===== */}
          <div className="flex items-stretch justify-between gap-6 py-7">
            <div className="flex-1">
              <p className="text-emerald-700 font-bold text-lg mb-3">فاتورة ضريبية</p>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 text-sm space-y-1">
                <p className="text-xs font-semibold text-zinc-500 mb-1.5">فاتورة إلى</p>
                <p className="font-bold text-base text-zinc-900">{invoice.client.company || invoice.client.name}</p>
                <p className="text-zinc-600">{invoice.client.name}</p>
                {invoice.client.phone && <p dir="ltr" className="text-zinc-600 text-right">{invoice.client.phone}</p>}
                {invoice.client.address && (
                  <p className="text-zinc-600">{invoice.client.address}{invoice.client.city ? ` — ${invoice.client.city}` : ""}</p>
                )}
              </div>
            </div>
            <div className="w-56 shrink-0 space-y-2 text-sm">
              <div className="flex justify-between rounded-lg bg-zinc-900 text-white px-3.5 py-2.5">
                <span className="text-zinc-300">رقم الفاتورة</span>
                <span className="font-mono font-bold" dir="ltr">{invoice.number}</span>
              </div>
              <div className="flex justify-between border border-zinc-200 rounded-lg px-3.5 py-2.5">
                <span className="text-zinc-500">تاريخ الإصدار</span>
                <span className="font-semibold">{fmtDate(invoice.issueDate)}</span>
              </div>
              <div className="flex justify-between border border-zinc-200 rounded-lg px-3.5 py-2.5">
                <span className="text-zinc-500">تاريخ الاستحقاق</span>
                <span className={`font-semibold ${isOverdue ? "text-red-600" : ""}`}>{fmtDate(invoice.dueDate)}</span>
              </div>
              <div className={`flex justify-center border rounded-lg px-3.5 py-2 font-bold ${st.cls}`}>
                {isOverdue ? STATUS_LABELS.overdue.label : st.label}
              </div>
            </div>
          </div>

          {/* ===== البنود ===== */}
          <table className="inv-table w-full text-sm border-collapse">
            <thead>
              <tr className="bg-emerald-600 text-white">
                <th className="py-2.5 px-3 text-right font-medium rounded-tr-lg w-10">#</th>
                <th className="py-2.5 px-3 text-right font-medium">الوصف</th>
                <th className="py-2.5 px-3 text-center font-medium w-20">الكمية</th>
                <th className="py-2.5 px-3 text-center font-medium w-28">سعر الوحدة</th>
                <th className="py-2.5 px-3 text-center font-medium w-28 rounded-tl-lg">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it, idx) => (
                <tr key={it.id} className="border-b border-zinc-200">
                  <td className="py-2.5 px-3 text-zinc-400 tabular-nums">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-zinc-800">{it.description}</span>
                    {it.product?.sku && <span className="block text-[10px] text-zinc-400 font-mono" dir="ltr">{it.product.sku}</span>}
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums">{it.quantity}</td>
                  <td className="py-2.5 px-3 text-center tabular-nums">{EGP(it.unitPrice)}</td>
                  <td className="py-2.5 px-3 text-center tabular-nums font-semibold">{EGP(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ===== الإجماليات ===== */}
          <div className="flex justify-between items-start gap-6 pt-6">
            <div className="flex-1 text-xs text-zinc-500 space-y-1.5 max-w-xs">
              {invoice.notes && (
                <p><span className="font-semibold text-zinc-700">ملاحظات: </span>{invoice.notes}</p>
              )}
              <p>تُستحق قيمة هذه الفاتورة في موعد الاستحقاق الموضح أعلاه.</p>
            </div>
            <div className="w-64 shrink-0 space-y-1.5 text-sm">
              <div className="flex justify-between px-3.5 py-2 rounded-lg bg-zinc-50">
                <span className="text-zinc-600">الإجمالي قبل الضريبة</span>
                <span className="tabular-nums font-medium">{EGP(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between px-3.5 py-2 rounded-lg bg-zinc-50">
                <span className="text-zinc-600">ضريبة القيمة المضافة ({invoice.vatRate}%)</span>
                <span className="tabular-nums font-medium">{EGP(invoice.vatAmount)}</span>
              </div>
              <div className="flex justify-between px-3.5 py-2.5 rounded-lg bg-emerald-600 text-white">
                <span className="font-bold">الإجمالي المستحق</span>
                <span className="tabular-nums font-bold">{EGP(invoice.total)}</span>
              </div>
              {invoice.paidAmount > 0 && (
                <>
                  <div className="flex justify-between px-3.5 py-2 rounded-lg bg-zinc-50">
                    <span className="text-zinc-600">المدفوع</span>
                    <span className="tabular-nums font-medium text-emerald-700">{EGP(invoice.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between px-3.5 py-2 rounded-lg border border-amber-300 bg-amber-50">
                    <span className="text-amber-700 font-semibold">المتبقي</span>
                    <span className="tabular-nums font-bold text-amber-700">{EGP(balance)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ===== المدفوعات ===== */}
          {invoice.payments.length > 0 && (
            <div className="pt-6">
              <p className="text-sm font-bold text-zinc-700 mb-2">سجل المدفوعات</p>
              <table className="inv-table w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-100 text-zinc-600">
                    <th className="py-2 px-3 text-right font-medium border border-zinc-200 rounded-tr-lg">التاريخ</th>
                    <th className="py-2 px-3 text-right font-medium border border-zinc-200">طريقة الدفع</th>
                    <th className="py-2 px-3 text-right font-medium border border-zinc-200">مرجع</th>
                    <th className="py-2 px-3 text-center font-medium border border-zinc-200 rounded-tl-lg w-28">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 px-3 border border-zinc-200">{fmtDate(p.date)}</td>
                      <td className="py-2 px-3 border border-zinc-200">{METHOD_LABELS[p.method] || p.method}</td>
                      <td className="py-2 px-3 border border-zinc-200" dir="ltr">{p.reference || "—"}</td>
                      <td className="py-2 px-3 border border-zinc-200 text-center tabular-nums text-emerald-700 font-semibold">{EGP(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ===== الخاتمة ===== */}
          <div className="mt-10 pt-5 border-t border-zinc-200 text-center space-y-1">
            <p className="font-bold text-emerald-700">شكراً لتعاملكم مع {company.name} 🌿</p>
            <p className="text-[11px] text-zinc-500">
              صُدرت هذه الفاتورة إلكترونياً من نظام Garfix ERP — بواسطة {user.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
