/**
 * Garfix ERP — أدوات التنسيق المشتركة للواجهة
 */

export const fmtEGP = (n: number | undefined | null) =>
  `${Math.round((n ?? 0)).toLocaleString("en-US")} ج.م`;

export const fmtNum = (n: number | undefined | null) =>
  (n ?? 0).toLocaleString("en-US");

export const fmtDate = (d: string | Date | undefined | null) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
};

export const fmtDateInput = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const INVOICE_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" }> = {
  paid: { label: "مدفوعة", variant: "success" },
  partial: { label: "جزئية", variant: "secondary" },
  sent: { label: "مُرسلة", variant: "outline" },
  draft: { label: "مسودة", variant: "outline" },
  overdue: { label: "متأخرة", variant: "destructive" },
  cancelled: { label: "ملغاة", variant: "destructive" },
};

/** حالات فاتورة الشراء (المرحلة 6) */
export const PURCHASE_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" }> = {
  paid: { label: "مدفوعة", variant: "success" },
  partial: { label: "مدفوعة جزئياً", variant: "secondary" },
  received: { label: "مُستلمة", variant: "default" },
  ordered: { label: "مطلوبة", variant: "outline" },
  draft: { label: "مسودة", variant: "outline" },
  overdue: { label: "متأخرة السداد", variant: "destructive" },
  cancelled: { label: "ملغاة", variant: "destructive" },
};

export const SUPPLIER_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  active: { label: "نشط", variant: "default" },
  inactive: { label: "غير نشط", variant: "outline" },
};

export const CLIENT_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  active: { label: "نشط", variant: "default" },
  inactive: { label: "غير نشط", variant: "outline" },
  lead: { label: "عميل محتمل", variant: "secondary" },
};

export const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "rent", label: "إيجار" },
  { value: "salaries", label: "رواتب" },
  { value: "purchases", label: "مشتريات" },
  { value: "marketing", label: "تسويق" },
  { value: "utilities", label: "مرافق" },
  { value: "other", label: "أخرى" },
];

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "cash", label: "نقدي" },
  { value: "bank", label: "تحويل بنكي" },
  { value: "wallet", label: "محفظة إلكترونية" },
  { value: "cheque", label: "شيك" },
];

/** ألوان الرسوم البيانية (زمردي + كهرماني) */
export const CHART_COLORS = {
  primary: "var(--chart-1)",
  secondary: "var(--chart-2)",
  negative: "var(--chart-5)",
  neutral: "var(--chart-3)",
  light: "var(--chart-4)",
};

export const monthsAgoLabel = (n: number) => {
  const ar = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${ar[d.getMonth()]} ${d.getFullYear()}`;
};
