"use client";

/**
 * Garfix ERP — قسم المشتريات والموردون (المرحلة 6)
 * فواتير الشراء + الاستلام بالمتوسط المرجح + مدفوعات الموردين + بطاقات الموردين
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Truck,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  PackageCheck,
  BanknoteArrowUp,
  XCircle,
  Phone,
  MapPin,
  Building2,
} from "lucide-react";
import {
  fmtEGP,
  fmtDate,
  fmtDateInput,
  PURCHASE_STATUS,
  SUPPLIER_STATUS,
  PAYMENT_METHODS,
} from "./format";

interface SupplierRow {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  status: string;
  purchaseCount: number;
  purchased: number;
  paid: number;
  balance: number;
  overdueCount: number;
  overdueAmount: number;
}

interface PurchaseRow {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string | null;
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
  payments: { id: string; amount: number; method: string; date: string; reference: string | null }[];
  items: { productId: string | null; description: string; quantity: number; unitCost: number; total: number }[];
}

interface ProductLite {
  id: string;
  name: string;
  sku: string;
  unit: string;
  cost: number;
  stock: number;
}

interface PurchaseItemForm {
  productId: string;
  description: string;
  quantity: string;
  unitCost: string;
}

const emptySupplierForm = {
  name: "",
  company: "",
  phone: "",
  email: "",
  city: "",
  address: "",
  taxId: "",
  notes: "",
  status: "active",
};

const emptyPurchaseForm = {
  supplierId: "",
  issueDate: fmtDateInput(new Date()),
  applyVat: false,
  notes: "",
};

const emptyItem: PurchaseItemForm = { productId: "", description: "", quantity: "1", unitCost: "" };

export function PurchasesSection({ user }: { user: { role: string; name: string; email: string } }) {
  const queryClient = useQueryClient();
  const canWrite = user.role === "admin" || user.role === "accountant";

  const [tab, setTab] = useState("purchases");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // فواتير الشراء
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm);
  const [items, setItems] = useState<PurchaseItemForm[]>([{ ...emptyItem }]);

  // دفعة مورد
  const [payDialog, setPayDialog] = useState<{ purchase: PurchaseRow } | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "cash", date: fmtDateInput(new Date()), reference: "" });

  // الموردون
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  const { data: purchases, isLoading: purchasesLoading } = useQuery<PurchaseRow[]>({
    queryKey: ["purchases"],
    queryFn: async () => {
      const res = await fetch("/api/purchases");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  const { data: suppliers, isLoading: suppliersLoading } = useQuery<SupplierRow[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  const { data: products } = useQuery<ProductLite[]>({
    queryKey: ["products-lite"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  // ===== ملخصات =====
  const activePurchases = (purchases || []).filter((p) => p.status !== "cancelled" && p.status !== "draft");
  const totalPurchased = activePurchases.reduce((s, p) => s + p.subtotal, 0);
  const supplierPayables = activePurchases.reduce((s, p) => s + p.balance, 0);
  const overduePurchases = activePurchases.filter((p) => p.status === "overdue");

  const filteredPurchases = (purchases || []).filter(
    (p) =>
      (statusFilter === "all" || p.status === statusFilter) &&
      (!search ||
        p.number.includes(search) ||
        p.supplierName.includes(search) ||
        p.items.some((it) => it.description.includes(search)))
  );

  const filteredSuppliers = (suppliers || []).filter(
    (s) => !search || s.name.includes(search) || (s.company || "").includes(search) || (s.phone || "").includes(search)
  );

  // ===== Mutations =====
  const createPurchase = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: purchaseForm.supplierId,
          issueDate: purchaseForm.issueDate,
          applyVat: purchaseForm.applyVat,
          notes: purchaseForm.notes,
          items: items.map((it) => ({
            productId: it.productId || null,
            description: it.description,
            quantity: Number(it.quantity) || 1,
            unitCost: Number(it.unitCost) || 0,
          })),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "تم إنشاء فاتورة الشراء", description: "استلم البضاعة لترحيلها للمخزون بالمتوسط المرجح" });
      setPurchaseDialogOpen(false);
      setPurchaseForm({ ...emptyPurchaseForm });
      setItems([{ ...emptyItem }]);
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const purchaseAction = useMutation({
    mutationFn: async ({ id, action, body }: { id: string; action: string; body?: Record<string, unknown> }) => {
      const res = await fetch(`/api/purchases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["products-lite"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      const labels: Record<string, string> = {
        receive: "تم استلام البضاعة — رُحّلت الكميات للمخزون بالمتوسط المرجح",
        payment: "تم تسجيل دفعة المورد",
        order: "تم إرسال الطلب للمورد",
        cancel: "تم إلغاء فاتورة الشراء",
      };
      toast({ title: "تم", description: labels[vars.action] });
      setPayDialog(null);
      setPayForm({ amount: "", method: "cash", date: fmtDateInput(new Date()), reference: "" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const saveSupplier = useMutation({
    mutationFn: async () => {
      const url = editingSupplierId ? `/api/suppliers/${editingSupplierId}` : "/api/suppliers";
      const res = await fetch(url, {
        method: editingSupplierId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(supplierForm),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: editingSupplierId ? "تم تعديل المورد" : "تم إضافة المورد" });
      setSupplierDialogOpen(false);
      setSupplierForm({ ...emptySupplierForm });
      setEditingSupplierId(null);
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const removeSupplier = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: (j) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast({ title: "تم", description: j.message || "تم حذف المورد" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  // ===== حسابات نموذج الشراء =====
  const formSubtotal = items.reduce(
    (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0),
    0
  );
  const formVat = purchaseForm.applyVat ? formSubtotal * 0.14 : 0;
  const formTotal = formSubtotal + formVat;

  const updateItem = (i: number, patch: Partial<PurchaseItemForm>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    if (patch.productId && products) {
      const p = products.find((pr) => pr.id === patch.productId);
      if (p) {
        if (!next[i].description) next[i].description = p.name;
        if (!next[i].unitCost) next[i].unitCost = String(p.cost);
      }
    }
    setItems(next);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const def = PURCHASE_STATUS[status] ?? { label: status, variant: "outline" as const };
    const cls =
      status === "paid"
        ? "bg-emerald-600 hover:bg-emerald-600"
        : status === "received"
          ? "bg-primary hover:bg-primary"
          : status === "overdue"
            ? "bg-red-600 hover:bg-red-600"
            : "";
    return (
      <Badge variant={def.variant === "success" || def.variant === "default" ? "default" : def.variant} className={cls}>
        {def.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* ===== بطاقات الملخص ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">إجمالي المشتريات (صافي)</p>
              <Truck className="h-4 w-4 text-primary" />
            </div>
            <p className="text-xl font-bold tabular-nums mt-1">{fmtEGP(totalPurchased)}</p>
            <p className="text-[11px] text-muted-foreground">{activePurchases.length} فاتورة نشطة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">مستحقات الموردين</p>
              <BanknoteArrowUp className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold tabular-nums mt-1 text-amber-600 dark:text-amber-400">{fmtEGP(supplierPayables)}</p>
            <p className="text-[11px] text-muted-foreground">مستحق وغير مسدد بعد</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">مشتريات متأخرة السداد</p>
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-xl font-bold tabular-nums mt-1 text-destructive">
              {fmtEGP(overduePurchases.reduce((s, p) => s + p.balance, 0))}
            </p>
            <p className="text-[11px] text-muted-foreground">{overduePurchases.length} فاتورة متأخرة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">عدد الموردين</p>
              <Building2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold tabular-nums mt-1">
              {(suppliers || []).filter((s) => s.status === "active").length}
            </p>
            <p className="text-[11px] text-muted-foreground">
              نشط من إجمالي {(suppliers || []).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="purchases" className="gap-1.5">
              <Truck className="h-4 w-4" />
              فواتير الشراء
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-1.5">
              <Building2 className="h-4 w-4" />
              الموردون
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-1 gap-2 flex-wrap justify-end">
            <div className="relative flex-1 min-w-40 max-w-64">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
            </div>
            {tab === "purchases" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  {Object.entries(PURCHASE_STATUS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canWrite && tab === "purchases" && (
              <Button onClick={() => setPurchaseDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                فاتورة شراء
              </Button>
            )}
            {canWrite && tab === "suppliers" && (
              <Button
                onClick={() => {
                  setEditingSupplierId(null);
                  setSupplierForm({ ...emptySupplierForm });
                  setSupplierDialogOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                مورد جديد
              </Button>
            )}
          </div>
        </div>

        {/* ===== تبويب فواتير الشراء ===== */}
        <TabsContent value="purchases" className="mt-4 space-y-3">
          {purchasesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : filteredPurchases.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Truck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                لا توجد فواتير شراء مطابقة
              </CardContent>
            </Card>
          ) : (
            filteredPurchases.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                        <Truck className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold tabular-nums" dir="ltr">{p.number}</p>
                          <StatusBadge status={p.status} />
                          {p.vatRate > 0 && <Badge variant="outline" className="text-[10px]">ض.ق.م {p.vatRate}%</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{p.supplierName}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(p.issueDate)} • الاستحقاق {fmtDate(p.dueDate)} • {p.itemCount} بند
                          {p.itemCount === 3 ? "" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between lg:justify-end gap-4 flex-wrap">
                      <div className="text-end">
                        <p className="font-bold tabular-nums">{fmtEGP(p.total)}</p>
                        {p.balance > 0.01 ? (
                          <p className="text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                            متبقٍ {fmtEGP(p.balance)}
                          </p>
                        ) : (
                          <p className="text-xs text-emerald-600">مسددة بالكامل</p>
                        )}
                      </div>
                      {canWrite && (
                        <div className="flex gap-1.5 flex-wrap">
                          {(p.status === "draft" || p.status === "ordered") && (
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1.5"
                              onClick={() => purchaseAction.mutate({ id: p.id, action: "receive" })}
                              disabled={purchaseAction.isPending}
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              استلام
                            </Button>
                          )}
                          {p.status === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => purchaseAction.mutate({ id: p.id, action: "order" })}
                              disabled={purchaseAction.isPending}
                            >
                              طلب
                            </Button>
                          )}
                          {p.balance > 0.01 && ["received", "partial", "ordered"].includes(p.status) && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="gap-1.5"
                              onClick={() => {
                                setPayDialog({ purchase: p });
                                setPayForm((f) => ({ ...f, amount: String(Math.round(p.balance)) }));
                              }}
                            >
                              <BanknoteArrowUp className="h-3.5 w-3.5" />
                              دفعة
                            </Button>
                          )}
                          {p.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => purchaseAction.mutate({ id: p.id, action: "cancel" })}
                              disabled={purchaseAction.isPending}
                              title="إلغاء الفاتورة"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* بنود الفاتورة */}
                  <Separator className="my-3" />
                  <div className="space-y-1.5">
                    {p.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">
                          <PackagePlus className="h-3 w-3 inline me-1 opacity-50" />
                          {it.description}
                        </span>
                        <span className="tabular-nums shrink-0" dir="ltr">
                          {it.quantity} × {fmtEGP(it.unitCost)} = <span className="text-foreground font-medium">{fmtEGP(it.total)}</span>
                        </span>
                      </div>
                    ))}
                    {(p.payments || []).length > 0 && (
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 pt-1">
                        مدفوع: {fmtEGP(p.paidAmount)} في {p.payments.length} دفعة
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* ===== تبويب الموردين ===== */}
        <TabsContent value="suppliers" className="mt-4 space-y-3">
          {suppliersLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                لا يوجد موردون مطابقون
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredSuppliers.map((s) => {
                const st = SUPPLIER_STATUS[s.status] ?? { label: s.status, variant: "outline" as const };
                return (
                  <Card key={s.id} className={s.status === "inactive" ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold truncate">{s.company || s.name}</p>
                              <Badge variant={st.variant}>{st.label}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{s.name}</p>
                          </div>
                        </div>
                        {canWrite && (
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              title="تعديل"
                              onClick={() => {
                                setEditingSupplierId(s.id);
                                setSupplierForm({
                                  name: s.name,
                                  company: s.company || "",
                                  phone: s.phone || "",
                                  email: s.email || "",
                                  city: s.city || "",
                                  address: s.address || "",
                                  taxId: s.taxId || "",
                                  notes: s.notes || "",
                                  status: s.status,
                                });
                                setSupplierDialogOpen(true);
                              }}
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="حذف / تعطيل"
                              onClick={() => removeSupplier.mutate(s.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        {s.phone && (
                          <p className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" />
                            <span dir="ltr">{s.phone}</span>
                          </p>
                        )}
                        {s.city && (
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3" />
                            {s.city}
                          </p>
                        )}
                      </div>

                      <Separator className="my-3" />
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[10px] text-muted-foreground">المشتريات</p>
                          <p className="text-sm font-semibold tabular-nums">{fmtEGP(s.purchased)}</p>
                          <p className="text-[10px] text-muted-foreground">{s.purchaseCount} فاتورة</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">المدفوع</p>
                          <p className="text-sm font-semibold tabular-nums text-emerald-600">{fmtEGP(s.paid)}</p>
                          <p className="text-[10px] text-muted-foreground">إلى المورد</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground">الرصيد</p>
                          <p className={`text-sm font-semibold tabular-nums ${s.balance > 0.01 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                            {fmtEGP(s.balance)}
                          </p>
                          {s.overdueCount > 0 && (
                            <p className="text-[10px] text-destructive">{s.overdueCount} متأخرة</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ===== حوار إنشاء فاتورة شراء ===== */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              فاتورة شراء جديدة
            </DialogTitle>
            <DialogDescription>
              أنشئ فاتورة شراء — البضاعة تُرحّل للمخزون عند الاستلام بتكلفة المتوسط المرجح
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المورد *</Label>
                <Select
                  value={purchaseForm.supplierId}
                  onValueChange={(v) => setPurchaseForm({ ...purchaseForm, supplierId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المورد" />
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliers || [])
                      .filter((s) => s.status === "active")
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.company || s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pdate">تاريخ الفاتورة</Label>
                <Input
                  id="pdate"
                  type="date"
                  value={purchaseForm.issueDate}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, issueDate: e.target.value })}
                  dir="ltr"
                  className="text-right"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>البنود *</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setItems([...items, { ...emptyItem }])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  بند
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <Select value={it.productId} onValueChange={(v) => updateItem(i, { productId: v })}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="منتج من المخزون (اختياري)" />
                        </SelectTrigger>
                        <SelectContent>
                          {(products || []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-destructive"
                          onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="الوصف"
                        value={it.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                      />
                      <Input
                        placeholder="الكمية"
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => updateItem(i, { quantity: e.target.value })}
                        dir="ltr"
                        className="text-right"
                      />
                      <Input
                        placeholder="تكلفة الوحدة"
                        type="number"
                        min="0"
                        value={it.unitCost}
                        onChange={(e) => updateItem(i, { unitCost: e.target.value })}
                        dir="ltr"
                        className="text-right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="applyVat"
                type="checkbox"
                checked={purchaseForm.applyVat}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, applyVat: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 accent-primary"
              />
              <Label htmlFor="applyVat" className="cursor-pointer text-sm font-normal">
                تطبيق ض.ق.م 14% على فاتورة المورد
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pnotes">ملاحظات</Label>
              <Textarea
                id="pnotes"
                rows={2}
                value={purchaseForm.notes}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                placeholder="شروط التسليم، رقم إذن الاستلام..."
              />
            </div>

            <div className="rounded-lg bg-muted/60 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">الإجمالي قبل الضريبة</span>
                <span className="tabular-nums font-medium">{fmtEGP(formSubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ض.ق.م</span>
                <span className="tabular-nums font-medium">{fmtEGP(formVat)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>إجمالي فاتورة الشراء</span>
                <span className="tabular-nums">{fmtEGP(formTotal)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => createPurchase.mutate()}
              disabled={createPurchase.isPending || !purchaseForm.supplierId || items.every((it) => !it.description.trim())}
            >
              {createPurchase.isPending ? "جارٍ الإنشاء..." : "إنشاء الفاتورة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== حوار دفعة مورد ===== */}
      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BanknoteArrowUp className="h-5 w-5 text-primary" />
              دفعة لمورد
            </DialogTitle>
            <DialogDescription>
              {payDialog?.purchase.number} — {payDialog?.purchase.supplierName}
              <br />
              المتبقي: {fmtEGP(payDialog?.purchase.balance || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="payamount">المبلغ *</Label>
                <Input
                  id="payamount"
                  type="number"
                  min="1"
                  value={payForm.amount}
                  onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                  dir="ltr"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label>طريقة الدفع</Label>
                <Select value={payForm.method} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paydate">التاريخ</Label>
                <Input
                  id="paydate"
                  type="date"
                  value={payForm.date}
                  onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
                  dir="ltr"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payref">مرجع</Label>
                <Input
                  id="payref"
                  value={payForm.reference}
                  onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                  placeholder="رقم الشيك / التحويل"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>
              إلغاء
            </Button>
            <Button
              onClick={() => payDialog && purchaseAction.mutate({ id: payDialog.purchase.id, action: "payment", body: { ...payForm, amount: Number(payForm.amount) } })}
              disabled={purchaseAction.isPending || !Number(payForm.amount)}
            >
              {purchaseAction.isPending ? "جارٍ التسجيل..." : "تسجيل الدفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== حوار مورد ===== */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSupplierId ? "تعديل مورد" : "مورد جديد"}</DialogTitle>
            <DialogDescription>بيانات المورد التي تظهر على فواتير الشراء</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم المسؤول *</Label>
                <Input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} placeholder="محمد سمير" />
              </div>
              <div className="space-y-2">
                <Label>اسم الشركة</Label>
                <Input value={supplierForm.company} onChange={(e) => setSupplierForm({ ...supplierForm, company: e.target.value })} placeholder="شركة النيل للتوريدات" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} placeholder="01001234567" dir="ltr" className="text-right" />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} placeholder="sales@nile.com" dir="ltr" className="text-right" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المدينة</Label>
                <Input value={supplierForm.city} onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })} placeholder="القاهرة" />
              </div>
              <div className="space-y-2">
                <Label>السجل الضريبي</Label>
                <Input value={supplierForm.taxId} onChange={(e) => setSupplierForm({ ...supplierForm, taxId: e.target.value })} placeholder="200-555-999" dir="ltr" className="text-right" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Input value={supplierForm.address} onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })} placeholder="١٢ شارع الجمهورية، العباسية" />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea rows={2} value={supplierForm.notes} onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })} placeholder="شروط التعامل، مهلة السداد..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupplierDialogOpen(false)}>إلغاء</Button>
            <Button onClick={() => saveSupplier.mutate()} disabled={saveSupplier.isPending || !supplierForm.name.trim()}>
              {saveSupplier.isPending ? "جارٍ الحفظ..." : editingSupplierId ? "حفظ التعديلات" : "إضافة المورد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
