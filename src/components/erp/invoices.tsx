"use client";

/**
 * Garfix ERP — إدارة الفواتير
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  FilePlus2,
  Search,
  AlertTriangle,
  Trash2,
  Plus,
  Banknote,
  Send,
  Eye,
  Printer,
  MessageCircle,
} from "lucide-react";
import { fmtEGP, fmtDate, fmtDateInput, INVOICE_STATUS, PAYMENT_METHODS } from "./format";
import { waLink } from "@/lib/whatsapp";
import { can, type SessionUser } from "@/lib/roles";

interface InvoiceRow {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  issueDate: string;
  dueDate: string;
  status: string;
  itemCount: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  balance: number;
  notes: string | null;
}

interface ClientOption {
  id: string;
  name: string;
  company: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  price: number;
  unit: string;
}

interface InvoiceDetail {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  notes: string | null;
  client: { name: string; company: string | null; phone: string | null; email: string | null; address: string | null };
  items: { id: string; description: string; quantity: number; unitPrice: number; total: number; product: { sku: string } | null }[];
  payments: { id: string; amount: number; method: string; date: string; reference: string | null }[];
}

type LineItem = { productId: string; description: string; quantity: string; unitPrice: string };

const emptyItem: LineItem = { productId: "", description: "", quantity: "1", unitPrice: "" };

export function InvoicesSection({ user }: { user: SessionUser }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<InvoiceRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  const canPay = can(user, "payments:write");
  const canDelete = user.role !== "sales";

  // نموذج الإنشاء
  const [cClientId, setCClientId] = useState("");
  const [cItems, setCItems] = useState<LineItem[]>([{ ...emptyItem }]);
  const [cApplyVat, setCApplyVat] = useState(true);
  const [cIssueDate, setCIssueDate] = useState(fmtDateInput(new Date()));
  const [cDueDate, setCDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return fmtDateInput(d);
  });
  const [cStatus, setCStatus] = useState("draft");
  const [cNotes, setCNotes] = useState("");

  const { data: invoices, isLoading } = useQuery<InvoiceRow[]>({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await fetch("/api/invoices");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  const { data: clients } = useQuery<ClientOption[]>({
    queryKey: ["clients"],
    queryFn: async () => (await fetch("/api/clients")).json(),
  });

  const { data: products } = useQuery<ProductOption[]>({
    queryKey: ["products"],
    queryFn: async () => (await fetch("/api/products")).json(),
  });

  const { data: settingsData } = useQuery<{ settings: Record<string, string> }>({
    queryKey: ["settings"],
    queryFn: async () => (await fetch("/api/settings")).json(),
  });
  const companyName = settingsData?.settings?.company_name || "Garfix";

  const { data: detail } = useQuery<InvoiceDetail>({
    queryKey: ["invoice", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${detailId}`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const items = cItems
        .filter((it) => it.description.trim() && Number(it.quantity) > 0)
        .map((it) => ({
          productId: it.productId || null,
          description: it.description,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice) || 0,
        }));
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: cClientId,
          items,
          applyVat: cApplyVat,
          issueDate: cIssueDate,
          dueDate: cDueDate,
          status: cStatus,
          notes: cNotes,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: (inv: { number: string }) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم إنشاء الفاتورة", description: `رقم ${inv.number}` });
      setCreateOpen(false);
      setCItems([{ ...emptyItem }]);
      setCClientId("");
      setCNotes("");
      setCStatus("draft");
    },
    onError: (e: Error) => toast({ title: "خطأ في الإنشاء", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "تم تحديث حالة الفاتورة" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payFor) return;
      const res = await fetch(`/api/invoices/${payFor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "payment", amount: Number(payAmount), method: payMethod }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "تم تسجيل الدفعة بنجاح" });
      setPayFor(null);
      setPayAmount("");
    },
    onError: (e: Error) => toast({ title: "خطأ في تسجيل الدفعة", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم حذف الفاتورة" });
    },
    onError: (e: Error) => toast({ title: "تعذر الحذف", description: e.message, variant: "destructive" }),
  });

  const totals = useMemo(() => {
    const subtotal = cItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
    const vat = cApplyVat ? subtotal * 0.14 : 0;
    return { subtotal, vat, total: subtotal + vat };
  }, [cItems, cApplyVat]);

  const filtered = (invoices || []).filter(
    (i) =>
      (statusFilter === "all" || i.status === statusFilter) &&
      (!search || i.number.includes(search) || i.clientName.includes(search))
  );

  const stats = {
    total: (invoices || []).length,
    unpaid: (invoices || []).filter((i) => i.balance > 0.01 && i.status !== "cancelled" && i.status !== "draft").length,
    outstanding: (invoices || []).reduce((s, i) => (i.status !== "cancelled" && i.status !== "draft" ? s + i.balance : s), 0),
  };

  const statusBadge = (status: string) => {
    const st = INVOICE_STATUS[status];
    const cls =
      status === "paid"
        ? "bg-emerald-600 hover:bg-emerald-600"
        : status === "overdue"
          ? "bg-red-600 hover:bg-red-600"
          : status === "partial"
            ? "bg-amber-500 hover:bg-amber-500 text-white"
            : "";
    return (
      <Badge variant={st?.variant === "success" ? "default" : st?.variant || "outline"} className={cls}>
        {st?.label || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث برقم الفاتورة أو العميل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="paid">مدفوعة</TabsTrigger>
              <TabsTrigger value="partial">جزئية</TabsTrigger>
              <TabsTrigger value="overdue">متأخرة</TabsTrigger>
              <TabsTrigger value="draft">مسودات</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <FilePlus2 className="h-4 w-4" />
          فاتورة جديدة
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">الفواتير</CardTitle>
          <CardDescription>
            {stats.total} فاتورة — {stats.unpaid} غير محصلة بالكامل — مستحقات: {fmtEGP(stats.outstanding)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">لا توجد فواتير مطابقة</p>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-lg border p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold" dir="ltr">{inv.number}</span>
                      {statusBadge(inv.status)}
                      <span className="text-sm text-muted-foreground">— {inv.clientName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      إصدار: {fmtDate(inv.issueDate)} • استحقاق: {fmtDate(inv.dueDate)} • {inv.itemCount} بند
                    </p>
                  </div>
                  <div className="flex items-center justify-between lg:justify-end gap-4 lg:gap-6">
                    <div className="text-left lg:text-right">
                      <p className="font-bold tabular-nums">{fmtEGP(inv.total)}</p>
                      {inv.balance > 0.01 && inv.status !== "cancelled" && inv.status !== "draft" ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400 tabular-nums">متبقٍ: {fmtEGP(inv.balance)}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {inv.status === "cancelled" ? "ملغاة" : inv.status === "draft" ? "لم تُرسل بعد" : "محصلة بالكامل"}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setDetailId(inv.id)} aria-label="عرض">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {inv.balance > 0.01 && inv.status !== "cancelled" && inv.status !== "draft" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-emerald-500"
                          aria-label="تذكير واتساب"
                          title="إرسال تذكير تحصيل واتساب"
                          onClick={() => {
                            const link = waLink({
                              phone: inv.clientPhone,
                              company: companyName,
                              clientName: inv.clientName,
                              invoiceNumber: inv.number,
                              balance: inv.balance,
                              dueDate: inv.dueDate,
                              overdueDays: inv.status === "overdue"
                                ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400000)
                                : undefined,
                            });
                            if (link) window.open(link, "_blank");
                            else toast({ title: "لا يوجد رقم واتساب صالح لهذا العميل", variant: "destructive" });
                          }}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {canPay && inv.balance > 0.01 && inv.status !== "cancelled" && inv.status !== "draft" && (
                        <Button variant="ghost" size="icon" className="text-emerald-600" onClick={() => { setPayFor(inv); setPayAmount(String(Math.round(inv.balance))); }} aria-label="تسجيل دفعة">
                          <Banknote className="h-4 w-4" />
                        </Button>
                      )}
                      {inv.status === "draft" && (
                        <Button variant="ghost" size="icon" className="text-primary" onClick={() => statusMutation.mutate({ id: inv.id, status: "sent" })} aria-label="إرسال">
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(inv.id)} aria-label="حذف">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===== نافذة إنشاء فاتورة ===== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>إنشاء فاتورة جديدة</DialogTitle>
            <DialogDescription>اختر العميل وأضف بنود الفاتورة</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] px-1">
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2 sm:col-span-1">
                  <Label>العميل *</Label>
                  <Select value={cClientId} onValueChange={setCClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العميل" />
                    </SelectTrigger>
                    <SelectContent>
                      {(clients || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.company || c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="issue">تاريخ الإصدار</Label>
                  <Input id="issue" type="date" value={cIssueDate} onChange={(e) => setCIssueDate(e.target.value)} dir="ltr" className="text-right" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due">تاريخ الاستحقاق</Label>
                  <Input id="due" type="date" value={cDueDate} onChange={(e) => setCDueDate(e.target.value)} dir="ltr" className="text-right" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>بنود الفاتورة *</Label>
                {cItems.map((item, idx) => (
                  <div key={idx} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">بند #{idx + 1}</span>
                      {cItems.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCItems(cItems.filter((_, i) => i !== idx))} aria-label="حذف البند">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-3 space-y-2">
                        <Select
                          value={item.productId}
                          onValueChange={(v) => {
                            const p = products?.find((x) => x.id === v);
                            setCItems(
                              cItems.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      productId: v,
                                      description: p?.name || it.description,
                                      unitPrice: p ? String(p.price) : it.unitPrice,
                                    }
                                  : it
                              )
                            );
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="اختر منتجاً من المخزون (أو اكتب وصفاً يدوياً)" />
                          </SelectTrigger>
                          <SelectContent>
                            {(products || []).map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} — {fmtEGP(p.price)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-3">
                        <Input
                          placeholder="وصف البند"
                          value={item.description}
                          onChange={(e) => setCItems(cItems.map((it, i) => (i === idx ? { ...it, description: e.target.value } : it)))}
                        />
                      </div>
                      <Input
                        type="number"
                        min="1"
                        placeholder="الكمية"
                        value={item.quantity}
                        onChange={(e) => setCItems(cItems.map((it, i) => (i === idx ? { ...it, quantity: e.target.value } : it)))}
                        dir="ltr"
                        className="text-right"
                      />
                      <Input
                        type="number"
                        min="0"
                        placeholder="سعر الوحدة"
                        value={item.unitPrice}
                        onChange={(e) => setCItems(cItems.map((it, i) => (i === idx ? { ...it, unitPrice: e.target.value } : it)))}
                        dir="ltr"
                        className="text-right"
                      />
                      <div className="flex items-center px-2 rounded-lg bg-muted text-sm tabular-nums">
                        = {fmtEGP((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={() => setCItems([...cItems, { ...emptyItem }])}>
                  <Plus className="h-4 w-4" /> إضافة بند
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="vat" className="text-sm">تطبيق ضريبة القيمة المضافة (14%)</Label>
                  <p className="text-xs text-muted-foreground">ضريبة المبيعات المصرية</p>
                </div>
                <Switch id="vat" checked={cApplyVat} onCheckedChange={setCApplyVat} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>حالة الإصدار</Label>
                  <Select value={cStatus} onValueChange={setCStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">مسودة (بدون خصم مخزون)</SelectItem>
                      <SelectItem value="sent">مُرسلة (خصم المخزون)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea id="notes" rows={2} value={cNotes} onChange={(e) => setCNotes(e.target.value)} placeholder="شروط الدفع، ملاحظات..." />
                </div>
              </div>

              <div className="rounded-lg bg-muted/60 p-4 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الإجمالي قبل الضريبة</span>
                  <span className="tabular-nums font-medium">{fmtEGP(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ضريبة القيمة المضافة (14%)</span>
                  <span className="tabular-nums font-medium">{fmtEGP(totals.vat)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-base font-bold">
                  <span>الإجمالي النهائي</span>
                  <span className="tabular-nums text-primary">{fmtEGP(totals.total)}</span>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !cClientId || cItems.every((it) => !it.description.trim())}
            >
              {createMutation.isPending ? "جارٍ الإنشاء..." : "إنشاء الفاتورة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== نافذة تفاصيل الفاتورة ===== */}
      <Dialog open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="sm:max-w-2xl">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono" dir="ltr">{detail.number}</span>
                  {statusBadge(detail.status)}
                </DialogTitle>
                <DialogDescription>
                  {detail.client.company || detail.client.name} • إصدار {fmtDate(detail.issueDate)} • استحقاق {fmtDate(detail.dueDate)}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[55vh]">
                <div className="space-y-4 py-1">
                  <div className="rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-muted-foreground">
                          <th className="py-2 px-3 text-right font-medium">البند</th>
                          <th className="py-2 px-3 text-right font-medium tabular-nums">كمية</th>
                          <th className="py-2 px-3 text-right font-medium tabular-nums">سعر</th>
                          <th className="py-2 px-3 text-right font-medium tabular-nums">إجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.map((it) => (
                          <tr key={it.id} className="border-b last:border-0">
                            <td className="py-2 px-3">
                              {it.description}
                              {it.product?.sku && <p className="text-xs text-muted-foreground font-mono" dir="ltr">{it.product.sku}</p>}
                            </td>
                            <td className="py-2 px-3 tabular-nums">{it.quantity}</td>
                            <td className="py-2 px-3 tabular-nums">{fmtEGP(it.unitPrice)}</td>
                            <td className="py-2 px-3 tabular-nums font-semibold">{fmtEGP(it.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted/60 p-3 space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">قبل الضريبة</span><span className="tabular-nums">{fmtEGP(detail.subtotal)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">ض.ق.م ({detail.vatRate}%)</span><span className="tabular-nums">{fmtEGP(detail.vatAmount)}</span></div>
                      <div className="flex justify-between font-bold"><span>الإجمالي</span><span className="tabular-nums text-primary">{fmtEGP(detail.total)}</span></div>
                    </div>
                    <div className="rounded-lg bg-muted/60 p-3 space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">المدفوع</span><span className="tabular-nums text-emerald-600">{fmtEGP(detail.paidAmount)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">المتبقي</span><span className="tabular-nums text-amber-600">{fmtEGP(detail.total - detail.paidAmount)}</span></div>
                      {detail.notes && <p className="text-xs text-muted-foreground pt-1">{detail.notes}</p>}
                    </div>
                  </div>

                  {detail.payments.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold">المدفوعات المسجلة</p>
                      {detail.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                          <span className="text-muted-foreground">{fmtDate(p.date)} • {PAYMENT_METHODS.find((m) => m.value === p.method)?.label || p.method}</span>
                          <span className="tabular-nums font-semibold text-emerald-600">{fmtEGP(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
              <DialogFooter className="sm:justify-between gap-2">
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-1.5" onClick={() => window.open(`/invoice/${detail.id}/print`, "_blank")}>
                    <Printer className="h-4 w-4" /> طباعة / PDF
                  </Button>
                  {detail.client.phone && detail.total - detail.paidAmount > 0.01 && (
                    <Button
                      variant="outline"
                      className="gap-1.5 text-emerald-600 hover:text-emerald-600"
                      onClick={() => {
                        const link = waLink({
                          phone: detail.client.phone,
                          company: companyName,
                          clientName: detail.client.company || detail.client.name,
                          invoiceNumber: detail.number,
                          balance: detail.total - detail.paidAmount,
                          dueDate: detail.dueDate,
                        });
                        if (link) window.open(link, "_blank");
                      }}
                    >
                      <MessageCircle className="h-4 w-4" /> تذكير
                    </Button>
                  )}
                </div>
                {canPay && (
                  <Button
                    className="gap-1.5"
                    onClick={() => {
                      const inv = invoices?.find((i) => i.id === detailId);
                      if (inv) {
                        setDetailId(null);
                        setPayFor(inv);
                        setPayAmount(String(Math.round(inv.balance)));
                      }
                    }}
                    disabled={detail.total - detail.paidAmount <= 0.01}
                  >
                    <Banknote className="h-4 w-4" /> تسجيل دفعة
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : (
            <div className="py-10 space-y-3">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-40" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== نافذة تسجيل دفعة ===== */}
      <Dialog open={!!payFor} onOpenChange={(v) => !v && setPayFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة — {payFor?.number}</DialogTitle>
            <DialogDescription>
              {payFor?.clientName} — المتبقي: {fmtEGP(payFor?.balance || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="pamount">قيمة الدفعة *</Label>
              <Input
                id="pamount"
                type="number"
                min="1"
                max={payFor?.balance}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                dir="ltr"
                className="text-right"
              />
              {payFor && payFor.balance > 0.01 && (
                <div className="flex gap-2">
                  {[0.25, 0.5, 1].map((f) => (
                    <Button key={f} variant="outline" size="sm" onClick={() => setPayAmount(String(Math.round(payFor.balance * f)))}>
                      {f === 1 ? "كامل المتبقي" : `${f * 100}%`}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>إلغاء</Button>
            <Button onClick={() => payMutation.mutate()} disabled={payMutation.isPending || !Number(payAmount)}>
              {payMutation.isPending ? "جارٍ التسجيل..." : "تأكيد الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
