"use client";

/**
 * Garfix ERP — الإعدادات (المرحلة 4: إعدادات النظام والشركة)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { toast } from "@/hooks/use-toast";
import { Settings2, Building2, Save, History, Percent, Hash } from "lucide-react";
import { fmtDate } from "./format";

interface SettingsData {
  settings: Record<string, string>;
  activity: { id: string; action: string; entity: string; detail: string | null; createdAt: string }[];
}

const actionLabels: Record<string, string> = {
  create: "إنشاء",
  update: "تحديث",
  delete: "حذف",
  payment: "دفعة",
  status: "حالة",
  seed: "تهيئة",
};

export function SettingsSection() {
  const queryClient = useQueryClient();
  // نمط «القيم المُستبدلة فقط» — يقرأ من بيانات السيرفر مباشرة دون تأثيرات جانبية
  const [overrides, setOverrides] = useState<Record<string, string>>({});

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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const getValue = (key: string) => overrides[key] ?? data?.settings?.[key] ?? "";
  const setValue = (key: string, v: string) => setOverrides((o) => ({ ...o, [key]: v }));

  const field = (
    key: string,
    label: string,
    props?: { placeholder?: string; type?: string; ltr?: boolean; hint?: string; icon?: React.ElementType }
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
        />
        {props?.hint && <p className="text-xs text-muted-foreground">{props.hint}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            بيانات الشركة
          </CardTitle>
          <CardDescription>تظهر على الفواتير والتقارير المطبوعة</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("company_name", "اسم الشركة", { placeholder: "شركة جارفكس للحلول التجارية" })}
            {field("company_phone", "رقم الهاتف", { placeholder: "+20 100 123 4567", ltr: true })}
            {field("company_email", "البريد الإلكتروني", { placeholder: "info@garfix.app", type: "email", ltr: true })}
            {field("company_address", "العنوان", { placeholder: "٢٤ شارع التحرير، القاهرة" })}
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
              })}
              {field("invoice_prefix", "بادئة أرقام الفواتير", {
                placeholder: "INV-",
                ltr: true,
                hint: "الرقم التالي: INV-1043",
                icon: Hash,
              })}
            </div>
          </div>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            سجل نشاط النظام
          </CardTitle>
          <CardDescription>آخر 30 إجراءً على النظام</CardDescription>
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
                        : a.action === "payment"
                          ? "secondary"
                          : "outline"
                  }
                  className="shrink-0"
                >
                  {actionLabels[a.action] || a.action}
                </Badge>
                <span className="flex-1 truncate">{a.detail || a.entity}</span>
                <span className="text-xs text-muted-foreground shrink-0">{fmtDate(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
