"use client";

/**
 * Garfix ERP — لوحة المعلومات (المرحلة 4: التحليلات)
 */
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Receipt,
  Package,
  Users,
  Truck,
  Building2,
  AlertTriangle,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { fmtEGP, fmtDate, INVOICE_STATUS, PURCHASE_STATUS, CHART_COLORS } from "./format";

interface DashData {
  kpis: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    outstanding: number;
    overdueCount: number;
    overdueAmount: number;
    inventoryValue: number;
    clientCount: number;
    invoiceCount: number;
    revenueGrowth: number;
    avgInvoice: number;
    // المرحلة 6
    supplierPayables: number;
    supplierOverdueCount: number;
    supplierOverdueAmount: number;
    purchaseCount: number;
    purchasesThisMonth: number;
  };
  trend: { month: string; revenue: number; expenses: number; profit: number }[];
  invoiceStatusDist: { status: string; label: string; count: number }[];
  topClients: { name: string; total: number; count: number }[];
  recentInvoices: {
    id: string;
    number: string;
    clientName: string;
    total: number;
    paidAmount: number;
    status: string;
    issueDate: string;
    dueDate: string;
  }[];
  expenseByCategory: { category: string; label: string; amount: number }[];
  lowStock: { id: string; name: string; sku: string; stock: number; minStock: number; unit: string }[];
  // المرحلة 6
  topSuppliers: { name: string; total: number; count: number }[];
  recentPurchases: {
    id: string;
    number: string;
    supplierName: string;
    total: number;
    paidAmount: number;
    status: string;
    issueDate: string;
  }[];
}

const statusColors: Record<string, string> = {
  paid: "#10b981",
  partial: "#f59e0b",
  sent: "#6b7280",
  draft: "#a8a29e",
  overdue: "#ef4444",
  cancelled: "#dc2626",
};

function KpiCard({
  title,
  value,
  icon: Icon,
  sub,
  trend,
  tone = "default",
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  sub?: string;
  trend?: number;
  tone?: "default" | "positive" | "negative" | "warning";
}) {
  const tones = {
    default: "text-primary",
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
  };
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`rounded-lg bg-muted p-2 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</div>
        {(sub || trend !== undefined) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            {trend !== undefined && trend !== 0 && (
              <span
                className={`flex items-center gap-0.5 font-semibold ${
                  trend > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend)}%
              </span>
            )}
            {sub && <span>{sub}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardSection({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { data, isLoading, isError, error } = useQuery<DashData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 text-destructive p-6">
          <AlertTriangle className="h-5 w-5" />
          <span>تعذر تحميل لوحة المعلومات: {error?.message}</span>
        </CardContent>
      </Card>
    );
  }

  const k = data.kpis;
  const pieData = data.invoiceStatusDist.filter((s) => s.count > 0);

  return (
    <div className="space-y-6">
      {/* ===== بطاقات المؤشرات ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title="الإيرادات المحصلة"
          value={fmtEGP(k.totalRevenue)}
          icon={Wallet}
          trend={k.revenueGrowth}
          sub="عن الشهر الحالي"
          tone="positive"
        />
        <KpiCard
          title="إجمالي المصروفات"
          value={fmtEGP(k.totalExpenses)}
          icon={Receipt}
          sub="آخر 6 أشهر"
          tone="warning"
        />
        <KpiCard
          title="صافي الربح"
          value={fmtEGP(k.netProfit)}
          icon={PiggyBank}
          sub={k.netProfit >= 0 ? "ربح تشغيلي" : "عجز — مراجعة عاجلة"}
          tone={k.netProfit >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          title="ذمم مستحقة"
          value={fmtEGP(k.outstanding)}
          icon={Activity}
          sub={`${k.overdueCount} فاتورة متأخرة — ${fmtEGP(k.overdueAmount)}`}
          tone={k.overdueCount > 0 ? "negative" : "default"}
        />
        <KpiCard
          title="قيمة المخزون"
          value={fmtEGP(k.inventoryValue)}
          icon={Package}
          sub={`${data.lowStock.length} منتج تحت الحد`}
          tone={data.lowStock.length > 0 ? "warning" : "default"}
        />
        <KpiCard
          title="عملاء نشطون"
          value={String(k.clientCount)}
          icon={Users}
          sub={`${k.invoiceCount} فاتورة إجمالاً`}
        />
        <KpiCard
          title="مستحقات الموردين"
          value={fmtEGP(k.supplierPayables)}
          icon={Truck}
          sub={`${k.supplierOverdueCount} فاتورة متأخرة — ${fmtEGP(k.supplierOverdueAmount)}`}
          tone={k.supplierOverdueCount > 0 ? "negative" : "warning"}
        />
        <KpiCard
          title="مشتريات الشهر الحالي"
          value={fmtEGP(k.purchasesThisMonth)}
          icon={Building2}
          sub={`${k.purchaseCount} فاتورة شراء إجمالاً`}
        />
      </div>

      {/* ===== الرسوم البيانية ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">الإيرادات مقابل المصروفات</CardTitle>
            <CardDescription>آخر 6 أشهر — حسب المدفوعات الفعلية المستلمة</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="var(--muted-foreground)"
                    tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      fmtEGP(value),
                      name === "revenue" ? "الإيرادات" : name === "expenses" ? "المصروفات" : "الصافي",
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--popover)",
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Legend formatter={(v: string) => (v === "revenue" ? "الإيرادات" : v === "expenses" ? "المصروفات" : "صافي الربح")} />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revGradient)" />
                  <Area type="monotone" dataKey="expenses" stroke="#f59e0b" strokeWidth={2} fill="url(#expGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">حالة الفواتير</CardTitle>
            <CardDescription>{k.invoiceCount} فاتورة إجمالاً</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">لا توجد فواتير بعد</p>
            ) : (
              <div className="h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.status} fill={statusColors[entry.status] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--popover)",
                        color: "var(--popover-foreground)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="space-y-1.5 mt-2">
              {pieData.map((s) => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColors[s.status] }} />
                    <span className="text-muted-foreground">{s.label}</span>
                  </div>
                  <span className="font-semibold tabular-nums">{s.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ===== أعلى العملاء ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">أعلى العملاء بالفواتير</CardTitle>
            <CardDescription>إجمالي الفواتير الصادرة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topClients.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>
            )}
            {data.topClients.map((c, i) => {
              const max = data.topClients[0].total || 1;
              return (
                <div key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{i + 1}. {c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{fmtEGP(c.total)}</span>
                  </div>
                  <Progress value={(c.total / max) * 100} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ===== تنبيهات المخزون ===== */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">تنبيهات المخزون</CardTitle>
              <CardDescription>منتجات تحت الحد الأدنى</CardDescription>
            </div>
            {data.lowStock.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onNavigate?.("inventory")} className="gap-1 text-primary">
                المخزون
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2.5 max-h-72 overflow-y-auto">
            {data.lowStock.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">✓ المخزون بحالة سليمة</p>
            )}
            {data.lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.sku}</p>
                </div>
                <Badge variant="destructive" className="tabular-nums">
                  {p.stock} / {p.minStock} {p.unit}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ===== المصروفات بالتصنيف ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">المصروفات بالتصنيف</CardTitle>
            <CardDescription>آخر 6 أشهر</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.expenseByCategory} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="label"
                    type="category"
                    tick={{ fontSize: 12 }}
                    stroke="var(--muted-foreground)"
                    width={70}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmtEGP(v), "المصروف"]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--popover)",
                      color: "var(--popover-foreground)",
                    }}
                  />
                  <Bar dataKey="amount" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== أحدث الفواتير ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">أحدث الفواتير</CardTitle>
            <CardDescription>آخر 8 فواتير صادرة</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => onNavigate?.("invoices")} className="gap-1 no-print">
            كل الفواتير
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 text-right font-medium">رقم</th>
                  <th className="py-2 text-right font-medium">العميل</th>
                  <th className="py-2 text-right font-medium">الإجمالي</th>
                  <th className="py-2 text-right font-medium">المدفوع</th>
                  <th className="py-2 text-right font-medium">الإصدار</th>
                  <th className="py-2 text-right font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {data.recentInvoices.map((inv) => {
                  const st = INVOICE_STATUS[inv.status];
                  return (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 font-mono text-xs">{inv.number}</td>
                      <td className="py-2.5 font-medium">{inv.clientName}</td>
                      <td className="py-2.5 tabular-nums">{fmtEGP(inv.total)}</td>
                      <td className="py-2.5 tabular-nums text-muted-foreground">{fmtEGP(inv.paidAmount)}</td>
                      <td className="py-2.5 text-muted-foreground">{fmtDate(inv.issueDate)}</td>
                      <td className="py-2.5">
                        <Badge
                          variant={st?.variant === "success" ? "default" : st?.variant || "outline"}
                          className={
                            inv.status === "paid"
                              ? "bg-emerald-600 hover:bg-emerald-600"
                              : inv.status === "overdue"
                                ? "bg-red-600 hover:bg-red-600"
                                : inv.status === "partial"
                                  ? "bg-amber-500 hover:bg-amber-500 text-white"
                                  : ""
                          }
                        >
                          {st?.label || inv.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ===== المرحلة 6: المشتريات والموردون ===== */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">أعلى الموردين بالتعامل</CardTitle>
            <CardDescription>إجمالي فواتير الشراء النشطة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data.topSuppliers || []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>
            )}
            {(data.topSuppliers || []).map((s, i) => {
              const max = data.topSuppliers[0]?.total || 1;
              return (
                <div key={s.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate">{i + 1}. {s.name}</span>
                    <span className="tabular-nums text-muted-foreground">{fmtEGP(s.total)}</span>
                  </div>
                  <Progress value={(s.total / max) * 100} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">أحدث فواتير الشراء</CardTitle>
              <CardDescription>آخر عمليات التوريد من الموردين</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate?.("purchases")} className="gap-1 no-print">
              كل المشتريات
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {(data.recentPurchases || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد مشتريات بعد</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 text-right font-medium">رقم</th>
                      <th className="py-2 text-right font-medium">المورد</th>
                      <th className="py-2 text-right font-medium">الإجمالي</th>
                      <th className="py-2 text-right font-medium">المدفوع</th>
                      <th className="py-2 text-right font-medium">الإصدار</th>
                      <th className="py-2 text-right font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.recentPurchases || []).map((p) => {
                      const st = PURCHASE_STATUS[p.status];
                      return (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-2.5 font-mono text-xs">{p.number}</td>
                          <td className="py-2.5 font-medium">{p.supplierName}</td>
                          <td className="py-2.5 tabular-nums">{fmtEGP(p.total)}</td>
                          <td className="py-2.5 tabular-nums text-muted-foreground">{fmtEGP(p.paidAmount)}</td>
                          <td className="py-2.5 text-muted-foreground">{fmtDate(p.issueDate)}</td>
                          <td className="py-2.5">
                            <Badge
                              variant={st?.variant === "success" || st?.variant === "default" ? "default" : st?.variant || "outline"}
                              className={
                                p.status === "paid"
                                  ? "bg-emerald-600 hover:bg-emerald-600"
                                  : p.status === "overdue"
                                    ? "bg-red-600 hover:bg-red-600"
                                    : p.status === "received"
                                      ? "bg-primary hover:bg-primary"
                                      : ""
                              }
                            >
                              {st?.label || p.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
