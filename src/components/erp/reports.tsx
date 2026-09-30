"use client";

/**
 * Garfix ERP — التقارير المالية المتقدمة (المرحلة 4)
 * قائمة الدخل | تقادم الذمم | تقييم المخزون | أداء العملاء
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Printer, FileSpreadsheet, TrendingUp, Truck } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { fmtEGP, fmtDate } from "./format";

interface ReportsData {
  pnl: {
    month: string;
    revenue: number;
    cogs: number;
    grossProfit: number;
    opex: number;
    netProfit: number;
    grossMargin: number;
    netMargin: number;
  }[];
  aging: { label: string; amount: number; count: number }[];
  overdueInvoices: {
    number: string;
    client: string;
    total: number;
    balance: number;
    daysLate: number;
    bucket: string;
  }[];
  inventoryValuation: {
    totalValue: number;
    totalRetail: number;
    itemCount: number;
    lowStockCount: number;
    byCategory: { category: string; value: number; count: number }[];
  };
  clientPerformance: {
    name: string;
    city: string | null;
    status: string;
    invoiceCount: number;
    billed: number;
    paid: number;
    balance: number;
    overdueCount: number;
    overdueAmount: number;
    paymentRate: number;
  }[];
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    totalReceivables: number;
    overdueTotal: number;
  };
  // المرحلة 6
  purchasesByMonth: { month: string; purchases: number; supplierPayments: number }[];
  supplierPerformance: {
    name: string;
    city: string | null;
    status: string;
    purchaseCount: number;
    purchased: number;
    paid: number;
    balance: number;
    overdueCount: number;
    overdueAmount: number;
    paymentRate: number;
  }[];
  purchasesSummary: {
    totalPurchases: number;
    totalPurchasesNet: number;
    totalSupplierPayments: number;
    supplierPayables: number;
    supplierOverdue: number;
    purchaseCount: number;
    receivedCount: number;
    supplierCount: number;
  };
}

export function ReportsSection() {
  const { data, isLoading, isError, error } = useQuery<ReportsData>({
    queryKey: ["reports"],
    queryFn: async () => {
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-destructive p-6">
          <AlertTriangle className="h-5 w-5" />
          <span>تعذر تحميل التقارير: {error?.message}</span>
        </CardContent>
      </Card>
    );
  }

  const s = data.summary;

  return (
    <div className="space-y-4 print-area">
      {/* ملخص تنفيذي */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>إجمالي الإيرادات</CardDescription>
            <CardTitle className="text-xl tabular-nums text-emerald-600 dark:text-emerald-400">{fmtEGP(s.totalRevenue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>إجمالي المصروفات</CardDescription>
            <CardTitle className="text-xl tabular-nums text-amber-600 dark:text-amber-400">{fmtEGP(s.totalExpenses)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>صافي الربح</CardDescription>
            <CardTitle className={`text-xl tabular-nums ${s.netProfit >= 0 ? "text-primary" : "text-red-600"}`}>{fmtEGP(s.netProfit)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ذمم مستحقة</CardDescription>
            <CardTitle className="text-xl tabular-nums">{fmtEGP(s.totalReceivables)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>منها متأخرة</CardDescription>
            <CardTitle className="text-xl tabular-nums text-red-600 dark:text-red-400">{fmtEGP(s.overdueTotal)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardDescription>مستحقات الموردين</CardDescription>
            <CardTitle className="text-xl tabular-nums text-primary">{fmtEGP(data.purchasesSummary?.supplierPayables || 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="pnl" dir="rtl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList className="no-print">
            <TabsTrigger value="pnl">قائمة الدخل</TabsTrigger>
            <TabsTrigger value="aging">تقادم الذمم</TabsTrigger>
            <TabsTrigger value="inventory">تقييم المخزون</TabsTrigger>
            <TabsTrigger value="clients">أداء العملاء</TabsTrigger>
            <TabsTrigger value="purchases">المشتريات والموردون</TabsTrigger>
          </TabsList>
          <Button variant="outline" className="gap-1.5 no-print" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            طباعة التقرير
          </Button>
        </div>

        {/* ===== قائمة الدخل ===== */}
        <TabsContent value="pnl" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                قائمة الدخل — آخر 6 أشهر
              </CardTitle>
              <CardDescription>
                الإيرادات محسوبة على أساس الاستلام النقدي، والتكاليف على أساس الاستحقاق
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 mb-6" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.pnl} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          revenue: "الإيرادات",
                          cogs: "تكلفة البضاعة",
                          grossProfit: "الربح الإجمالي",
                          opex: "مصروفات تشغيلية",
                          netProfit: "صافي الربح",
                        };
                        return [fmtEGP(value), labels[name] || name];
                      }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--popover)",
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Legend
                      formatter={(v: string) => {
                        const labels: Record<string, string> = {
                          revenue: "الإيرادات",
                          cogs: "تكلفة البضاعة",
                          opex: "مصروفات تشغيلية",
                          netProfit: "صافي الربح",
                        };
                        return labels[v] || v;
                      }}
                    />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={26} />
                    <Bar dataKey="cogs" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={26} />
                    <Bar dataKey="opex" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={26} />
                    <Line type="monotone" dataKey="netProfit" stroke="#0891b2" strokeWidth={2.5} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground bg-muted/40">
                      <th className="py-2.5 px-3 text-right font-medium">الشهر</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">الإيرادات</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">تكلفة البضاعة</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">الربح الإجمالي</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">م. تشغيلية</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">صافي الربح</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">هامش صافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pnl.map((row) => (
                      <tr key={row.month} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-medium">{row.month}</td>
                        <td className="py-2.5 px-3 tabular-nums">{fmtEGP(row.revenue)}</td>
                        <td className="py-2.5 px-3 tabular-nums text-muted-foreground">{fmtEGP(row.cogs)}</td>
                        <td className="py-2.5 px-3 tabular-nums">{fmtEGP(row.grossProfit)}</td>
                        <td className="py-2.5 px-3 tabular-nums text-amber-600 dark:text-amber-400">{fmtEGP(row.opex)}</td>
                        <td className={`py-2.5 px-3 tabular-nums font-semibold ${row.netProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>
                          {fmtEGP(row.netProfit)}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant={row.netMargin >= 10 ? "default" : row.netMargin >= 0 ? "secondary" : "destructive"} className="tabular-nums">
                            {row.netMargin}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-bold bg-muted/40">
                      <td className="py-3 px-3">الإجمالي (6 أشهر)</td>
                      <td className="py-3 px-3 tabular-nums">{fmtEGP(data.pnl.reduce((s2, r) => s2 + r.revenue, 0))}</td>
                      <td className="py-3 px-3 tabular-nums">{fmtEGP(data.pnl.reduce((s2, r) => s2 + r.cogs, 0))}</td>
                      <td className="py-3 px-3 tabular-nums">{fmtEGP(data.pnl.reduce((s2, r) => s2 + r.grossProfit, 0))}</td>
                      <td className="py-3 px-3 tabular-nums">{fmtEGP(data.pnl.reduce((s2, r) => s2 + r.opex, 0))}</td>
                      <td className="py-3 px-3 tabular-nums text-primary">{fmtEGP(data.pnl.reduce((s2, r) => s2 + r.netProfit, 0))}</td>
                      <td className="py-3 px-3">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== تقادم الذمم ===== */}
        <TabsContent value="aging" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">توزيع الذمم بالأعمار</CardTitle>
                <CardDescription>المبالغ غير المحصلة مصنفة حسب مدة التأخير</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.aging.map((b) => {
                    const max = Math.max(...data.aging.map((x) => x.amount), 1);
                    const pct = (b.amount / max) * 100;
                    const color =
                      b.label.includes("غير مستحقة")
                        ? "bg-emerald-500"
                        : b.label.includes("1-30")
                          ? "bg-amber-400"
                          : b.label.includes("31-60")
                            ? "bg-orange-500"
                            : b.label.includes("61-90")
                              ? "bg-red-500"
                              : "bg-red-700";
                    return (
                      <div key={b.label} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {b.label} <span className="text-xs">({b.count})</span>
                          </span>
                          <span className="font-semibold tabular-nums">{fmtEGP(b.amount)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(pct, b.amount > 0 ? 4 : 0)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">أكثر الفواتير تأخراً</CardTitle>
                <CardDescription>مرتبة تنازلياً حسب الأيام</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-72">
                  {data.overdueInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">✓ لا توجد متأخرات</p>
                  ) : (
                    <div className="space-y-2">
                      {data.overdueInvoices.slice(0, 12).map((inv) => (
                        <div key={inv.number} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                          <div>
                            <p className="font-mono text-xs font-semibold" dir="ltr">{inv.number}</p>
                            <p className="text-xs text-muted-foreground truncate">{inv.client}</p>
                          </div>
                          <div className="text-left">
                            <p className="tabular-nums font-semibold text-red-600 dark:text-red-400">{fmtEGP(inv.balance)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              متأخرة {inv.daysLate} يوم • {inv.bucket}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== تقييم المخزون ===== */}
        <TabsContent value="inventory" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3 mb-2">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>قيمة بالتكلفة</CardDescription>
                <CardTitle className="text-xl tabular-nums text-primary">{fmtEGP(data.inventoryValuation.totalValue)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>قيمة بسعر البيع</CardDescription>
                <CardTitle className="text-xl tabular-nums">{fmtEGP(data.inventoryValuation.totalRetail)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>ربح متوقع من المخزون</CardDescription>
                <CardTitle className="text-xl tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fmtEGP(data.inventoryValuation.totalRetail - data.inventoryValuation.totalValue)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">القيمة حسب التصنيف</CardTitle>
              <CardDescription>
                {data.inventoryValuation.itemCount} منتج — {data.inventoryValuation.lowStockCount} تحت الحد الأدنى
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2.5 text-right font-medium">التصنيف</th>
                      <th className="py-2.5 text-right font-medium tabular-nums">عدد المنتجات</th>
                      <th className="py-2.5 text-right font-medium tabular-nums">القيمة (تكلفة)</th>
                      <th className="py-2.5 text-right font-medium">النسبة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.inventoryValuation.byCategory
                      .sort((a, b) => b.value - a.value)
                      .map((c) => (
                        <tr key={c.category} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2.5 font-medium">{c.category}</td>
                          <td className="py-2.5 tabular-nums">{c.count}</td>
                          <td className="py-2.5 tabular-nums">{fmtEGP(c.value)}</td>
                          <td className="py-2.5">
                            <Badge variant="secondary" className="tabular-nums">
                              {data.inventoryValuation.totalValue > 0
                                ? Math.round((c.value / data.inventoryValuation.totalValue) * 100)
                                : 0}
                              %
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== أداء العملاء ===== */}
        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                أداء العملاء
              </CardTitle>
              <CardDescription>مرتب حسب إجمالي التعاملات — نسبة السداد = المدفوع ÷ إجمالي الفواتير</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground bg-muted/40">
                      <th className="py-2.5 px-3 text-right font-medium">العميل</th>
                      <th className="py-2.5 px-3 text-right font-medium">المدينة</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">فواتير</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">إجمالي</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">مدفوع</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">الرصيد</th>
                      <th className="py-2.5 px-3 text-right font-medium">نسبة السداد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.clientPerformance.map((c) => (
                      <tr key={c.name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-medium">{c.name}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{c.city || "—"}</td>
                        <td className="py-2.5 px-3 tabular-nums">{c.invoiceCount}</td>
                        <td className="py-2.5 px-3 tabular-nums">{fmtEGP(c.billed)}</td>
                        <td className="py-2.5 px-3 tabular-nums text-emerald-600 dark:text-emerald-400">{fmtEGP(c.paid)}</td>
                        <td className="py-2.5 px-3">
                          <span className={`tabular-nums ${c.overdueCount > 0 ? "text-red-600 dark:text-red-400 font-semibold" : ""}`}>
                            {fmtEGP(c.balance)}
                          </span>
                          {c.overdueCount > 0 && <Badge variant="destructive" className="ms-1.5">{c.overdueCount} متأخرة</Badge>}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={c.paymentRate >= 90 ? "default" : c.paymentRate >= 60 ? "secondary" : "destructive"}
                            className={c.paymentRate >= 90 ? "bg-emerald-600 hover:bg-emerald-600" : ""}
                          >
                            {c.paymentRate}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== المرحلة 6: المشتريات والموردون ===== */}
        <TabsContent value="purchases" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>إجمالي المشتريات (صافي)</CardDescription>
                <CardTitle className="text-lg tabular-nums">{fmtEGP(data.purchasesSummary?.totalPurchasesNet || 0)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>مدفوع للموردين</CardDescription>
                <CardTitle className="text-lg tabular-nums text-emerald-600 dark:text-emerald-400">{fmtEGP(data.purchasesSummary?.totalSupplierPayments || 0)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>مستحقات غير مسددة</CardDescription>
                <CardTitle className="text-lg tabular-nums text-amber-600 dark:text-amber-400">{fmtEGP(data.purchasesSummary?.supplierPayables || 0)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>منها متأخرة السداد</CardDescription>
                <CardTitle className="text-lg tabular-nums text-red-600 dark:text-red-400">{fmtEGP(data.purchasesSummary?.supplierOverdue || 0)}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                المشتريات ومدفوعات الموردين — آخر 6 أشهر
              </CardTitle>
              <CardDescription>
                فواتير الشراء النشطة مقابل المدفوع الفعلي للموردين شهرياً
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.purchasesByMonth || []} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="var(--muted-foreground)"
                      tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        const labels: Record<string, string> = {
                          purchases: "المشتريات (صافي)",
                          supplierPayments: "مدفوع للموردين",
                        };
                        return [fmtEGP(value), labels[name] || name];
                      }}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--popover)",
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Legend
                      formatter={(v: string) => {
                        const labels: Record<string, string> = {
                          purchases: "المشتريات (صافي)",
                          supplierPayments: "مدفوع للموردين",
                        };
                        return labels[v] || v;
                      }}
                    />
                    <Bar dataKey="purchases" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={26} />
                    <Bar dataKey="supplierPayments" fill="#10b981" radius={[4, 4, 0, 0]} barSize={26} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                أداء الموردين
              </CardTitle>
              <CardDescription>
                مرتب حسب حجم التعامل — نسبة السداد = المدفوع للمورد ÷ إجمالي مشترياته
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground bg-muted/40">
                      <th className="py-2.5 px-3 text-right font-medium">المورد</th>
                      <th className="py-2.5 px-3 text-right font-medium">المدينة</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">فواتير</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">إجمالي المشتريات</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">مدفوع</th>
                      <th className="py-2.5 px-3 text-right font-medium tabular-nums">الرصيد</th>
                      <th className="py-2.5 px-3 text-right font-medium">نسبة السداد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.supplierPerformance || []).map((sp) => (
                      <tr key={sp.name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-medium">{sp.name}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{sp.city || "—"}</td>
                        <td className="py-2.5 px-3 tabular-nums">{sp.purchaseCount}</td>
                        <td className="py-2.5 px-3 tabular-nums">{fmtEGP(sp.purchased)}</td>
                        <td className="py-2.5 px-3 tabular-nums text-emerald-600 dark:text-emerald-400">{fmtEGP(sp.paid)}</td>
                        <td className="py-2.5 px-3">
                          <span className={`tabular-nums ${sp.overdueCount > 0 ? "text-red-600 dark:text-red-400 font-semibold" : ""}`}>
                            {fmtEGP(sp.balance)}
                          </span>
                          {sp.overdueCount > 0 && <Badge variant="destructive" className="ms-1.5">{sp.overdueCount} متأخرة</Badge>}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={sp.paymentRate >= 90 ? "default" : sp.paymentRate >= 60 ? "secondary" : "destructive"}
                            className={sp.paymentRate >= 90 ? "bg-emerald-600 hover:bg-emerald-600" : ""}
                          >
                            {sp.paymentRate}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
