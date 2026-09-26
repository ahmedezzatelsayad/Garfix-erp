"use client";

/**
 * Garfix ERP — الإعدادات (المرحلة 5: بيانات الشركة + النسخ الاحتياطي + سجل النشاط)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Settings2,
  Building2,
  Save,
  History,
  Percent,
  Hash,
  Download,
  Upload,
  DatabaseBackup,
  FileSpreadsheet,
  ShieldAlert,
  User as UserIcon,
} from "lucide-react";
import { fmtDate } from "./format";
import { type SessionUser } from "@/lib/roles";

interface SettingsData {
  settings: Record<string, string>;
  activity: { id: string; action: string; entity: string; detail: string | null; userEmail: string | null; createdAt: string }[];
}

const actionLabels: Record<string, string> = {
  create: "إنشاء",
  update: "تحديث",
  delete: "حذف",
  payment: "دفعة",
  status: "حالة",
  seed: "تهيئة",
  login: "دخول",
  logout: "خروج",
};

const CSV_TABLES = [
  { key: "clients", label: "العملاء" },
  { key: "products", label: "المنتجات" },
  { key: "invoices", label: "الفواتير" },
  { key: "payments", label: "المدفوعات" },
  { key: "expenses", label: "المصروفات" },
];

export function SettingsSection({ user }: { user: SessionUser }) {
  const queryClient = useQueryClient();
  // نمط «القيم المُستبدلة فقط» — يقرأ من بيانات السيرفر مباشرة دون تأثيرات جانبية
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreData, setRestoreData] = useState<{ name: string; text: string; counts?: Record<string, number> } | null>(null);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);

  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const merged = { ...(data?.settings || {}), ...overrides };
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setOverrides({});
      toast({ title: "تم حفظ الإعدادات", description: "تم تحديث بيانات الشركة" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const restoreMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: (j) => {
      queryClient.invalidateQueries();
      setRestoreData(null);
      setRestoreResult(
        `تم الاسترجاع بنجاح — ${j.restored.invoices} فاتورة، ${j.restored.clients} عميل، ${j.restored.payments} دفعة`
      );
      toast({ title: "تم استرجاع النسخة الاحتياطية", description: "أُعيد تحميل كل البيانات" });
    },
    onError: (e: Error) => {
      setRestoreResult(null);
      toast({ title: "تعذر الاسترجاع", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const isAdmin = user.role === "admin";
  const getValue = (key: string) => overrides[key] ?? data?.settings?.[key] ?? "";
  const setValue = (key: string, v: string) => setOverrides((o) => ({ ...o, [key]: v }));

  const field = (
    key: string,
    label: string,
    props?: { placeholder?: string; type?: string; ltr?: boolean; hint?: string; icon?: React.ElementType; disabled?: boolean }
  ) => {
    const Icon = props?.icon;
    return (
      <div className="space-y-2">
        <Label htmlFor={key} className="flex items-center gap-1.5">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          {label}
        </Label>
        <Input
          id={key}
          value={getValue(key)}
          onChange={(e) => setValue(key, e.target.value)}
          placeholder={props?.placeholder}
          type={props?.type}
          dir={props?.ltr ? "ltr" : undefined}
          className={props?.ltr ? "text-right" : ""}
          disabled={props?.disabled}
        />
        {props?.hint && <p className="text-xs text-muted-foreground">{props.hint}</p>}
      </div>
    );
  };

  const onPickBackupFile = (f: File | null) => {
    if (!f) return;
    if (!f.name.endsWith(".json")) {
      toast({ title: "اختر ملف JSON", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setRestoreResult(null);
        setRestoreData({ name: f.name, text: String(reader.result), counts: parsed.counts });
      } catch {
        toast({ title: "الملف ليس JSON صالحاً", variant: "destructive" });
      }
    };
    reader.readAsText(f);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            بيانات الشركة
          </CardTitle>
          <CardDescription>
            تظهر على الفواتير والتقارير المطبوعة
            {!isAdmin && " — التعديل للمدير فقط"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("company_name", "اسم الشركة", { placeholder: "شركة جارفكس للحلول التجارية", disabled: !isAdmin })}
            {field("company_phone", "رقم الهاتف", { placeholder: "+20 100 123 4567", ltr: true, disabled: !isAdmin })}
            {field("company_email", "البريد الإلكتروني", { placeholder: "info@garfix.app", type: "email", ltr: true, disabled: !isAdmin })}
            {field("company_address", "العنوان", { placeholder: "٢٤ شارع التحرير، القاهرة", disabled: !isAdmin })}
          </div>
          <Separator />
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5 mb-4">
              <Settings2 className="h-4 w-4 text-primary" />
              إعدادات الفوترة
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("vat_rate", "نسبة ضريبة القيمة المضافة %", {
                placeholder: "14",
                type: "number",
                ltr: true,
                hint: "النسبة المطبقة على الفواتير الجديدة",
                icon: Percent,
                disabled: !isAdmin,
              })}
              {field("invoice_prefix", "بادئة أرقام الفواتير", {
                placeholder: "INV-",
                ltr: true,
                hint: "الرقم التالي: INV-1043",
                icon: Hash,
                disabled: !isAdmin,
              })}
            </div>
          </div>
          {isAdmin && (
            <div className="flex justify-end">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || Object.keys(overrides).length === 0}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending
                  ? "جارٍ الحفظ..."
                  : Object.keys(overrides).length > 0
                    ? `حفظ التغييرات (${Object.keys(overrides).length})`
                    : "لا توجد تغييرات"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DatabaseBackup className="h-4 w-4 text-primary" />
              النسخ الاحتياطي والتصدير
            </CardTitle>
            <CardDescription>حماية بيانات شركتك — تنزيل كامل أو تصدير CSV ثم الاسترجاع عند الحاجة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <Download className="h-4 w-4 text-primary" />
                  نسخة JSON كاملة
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  كل العملاء والفواتير والبنود والمدفوعات والمصروفات والإعدادات في ملف واحد — أصلح للاسترجاع الكامل.
                </p>
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = "/api/backup";
                    a.download = "";
                    a.click();
                    toast({ title: "بدأ تنزيل النسخة الاحتياطية" });
                  }}
                >
                  <Download className="h-4 w-4" />
                  تنزيل نسخة احتياطية
                </Button>
              </div>

              <div className="rounded-xl border p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  تصدير CSV
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ملفات جاهزة لـ Excel — بترميز UTF-8 تظهر العربية سليمة.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CSV_TABLES.map((t) => (
                    <Button
                      key={t.key}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs h-8"
                      onClick={() => {
                        const a = document.createElement("a");
                        a.href = `/api/backup?format=csv&table=${t.key}`;
                        a.download = "";
                        a.click();
                      }}
                    >
                      <FileSpreadsheet className="h-3 w-3" />
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <div className="rounded-xl border border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-3">
              <p className="text-sm font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <ShieldAlert className="h-4 w-4" />
                استرجاع نسخة احتياطية — يستبدل كل بيانات ERP الحالية
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                اختر ملف نسخة JSON نزّلته سابقاً. سيُحذف كل المحتوى الحالي (فواتير، عملاء، مدفوعات...) ويُستبدل بمحتوى النسخة —
                الحسابات والجلسات لا تتأثر. يُفضّل تنزيل نسخة من الوضع الحالي أولاً.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => onPickBackupFile(e.target.files?.[0] ?? null)}
                />
                <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  اختيار ملف النسخة...
                </Button>
                <span className="text-xs text-muted-foreground">{restoreData?.name}</span>
              </div>
              {restoreResult && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{restoreResult}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            سجل نشاط النظام
          </CardTitle>
          <CardDescription>آخر 30 إجراءً على النظام مع من نفّذها</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {(data?.activity || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">لا يوجد نشاط مسجل</p>
            )}
            {(data?.activity || []).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
                <Badge
                  variant={
                    a.action === "create"
                      ? "default"
                      : a.action === "delete"
                        ? "destructive"
                        : a.action === "payment" || a.action === "login"
                          ? "secondary"
                          : "outline"
                  }
                  className="shrink-0"
                >
                  {actionLabels[a.action] || a.action}
                </Badge>
                <span className="flex-1 truncate">{a.detail || a.entity}</span>
                {a.userEmail && (
                  <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground shrink-0" title={a.userEmail}>
                    <UserIcon className="h-3 w-3" />
                    {a.userEmail}
                  </span>
                )}
                <span className="text-xs text-muted-foreground shrink-0">{fmtDate(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ===== تأكيد الاسترجاع ===== */}
      <Dialog open={!!restoreData} onOpenChange={(o) => !o && setRestoreData(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              تأكيد الاسترجاع
            </DialogTitle>
            <DialogDescription>
              سيُستبدل كل محتوى ERP الحالي ببيانات «{restoreData?.name}»
              {restoreData?.counts ? ` (${restoreData.counts.invoices ?? 0} فاتورة، ${restoreData.counts.clients ?? 0} عميل)` : ""}.
              الإجراء لا يمكن التراجع عنه.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRestoreData(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              disabled={restoreMutation.isPending}
              onClick={() => restoreData && restoreMutation.mutate(restoreData.text)}
            >
              {restoreMutation.isPending ? "جارٍ الاسترجاع..." : "استرجاع الآن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
