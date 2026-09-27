/**
 * Garfix ERP — روابط تحصيل واتساب (المرحلة 5)
 * بلا تبعيات — يعمل في الواجهة والخادم
 */

/** توحيد رقم الهاتف المصري/الدولي لصيغة wa.me */
export function normalizeWaPhone(phone: string): string | null {
  const p = phone.replace(/[\s\-()]/g, "");
  // مصري: 01xxxxxxxxx / +201xxxxxxxxx / 201xxxxxxxxx
  if (/^\+201\d{9}$/.test(p)) return p.slice(1);
  if (/^201\d{9}$/.test(p)) return p;
  if (/^01\d{9}$/.test(p)) return "2" + p;
  // دولي آخر (8-15 رقماً) — كما هو
  if (/^\d{8,15}$/.test(p)) return p;
  return null;
}

const AR_DATE = (d: string | Date) =>
  new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });

const EGP = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ج.م`;

/** صياغة رسالة تذكير تحصيل مهذبة بالعربية */
export function reminderMessage(opts: {
  company: string;
  clientName: string;
  invoiceNumber: string;
  balance: number;
  dueDate: string | Date;
  overdueDays?: number;
}): string {
  const lines = [
    `السلام عليكم ورحمة الله، ${opts.clientName} 🌿`,
    "",
    `نودّ تذكيركم بفاتورة رقم *${opts.invoiceNumber}*`,
    `المبلغ المستحق: *${EGP(opts.balance)}*`,
    `تاريخ الاستحقاق: ${AR_DATE(opts.dueDate)}`,
  ];
  if (opts.overdueDays && opts.overdueDays > 0) {
    lines.push(`متعثرة منذ ${opts.overdueDays} يوماً`);
  }
  lines.push("", `نشكر لكم تعاونكم ودعمكم، ونسعد بخدمتكم دائماً.`,
    `— ${opts.company}`);
  return lines.join("\n");
}

/** بناء رابط wa.me كامل — null إن كان الرقم غير صالح */
export function waLink(opts: {
  phone: string | null;
  company: string;
  clientName: string;
  invoiceNumber: string;
  balance: number;
  dueDate: string | Date;
  overdueDays?: number;
}): string | null {
  if (!opts.phone) return null;
  const intl = normalizeWaPhone(opts.phone);
  if (!intl) return null;
  const text = encodeURIComponent(
    reminderMessage({
      company: opts.company,
      clientName: opts.clientName,
      invoiceNumber: opts.invoiceNumber,
      balance: opts.balance,
      dueDate: opts.dueDate,
      overdueDays: opts.overdueDays,
    })
  );
  return `https://wa.me/${intl}?text=${text}`;
}
