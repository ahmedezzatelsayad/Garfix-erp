"use client";

/**
 * Garfix ERP — إدارة المخزون
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
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { PackagePlus, Pencil, Trash2, Search, AlertTriangle, Boxes, PackageX } from "lucide-react";
import { fmtEGP, fmtNum } from "./format";

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unit: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  soldCount: number;
  stockValue: number;
  low: boolean;
  margin: number;
}

const emptyForm = {
  name: "",
  sku: "",
  category: "",
  unit: "قطعة",
  price: "",
  cost: "",
  stock: "",
  minStock: "5",
};

export function InventorySection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery<ProductRow[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        sku: form.sku,
        category: form.category,
        unit: form.unit,
        price: Number(form.price) || 0,
        cost: Number(form.cost) || 0,
        stock: Number(form.stock) || 0,
        minStock: Number(form.minStock) || 0,
      };
      const res = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: editingId ? "تم تحديث المنتج" : "تمت إضافة المنتج", description: form.name });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "تم حذف المنتج" });
      setDeleteId(null);
    },
    onError: (e: Error) => toast({ title: "تعذر الحذف", description: e.message, variant: "destructive" }),
  });

  const openEdit = (p: ProductRow) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category || "",
      unit: p.unit,
      price: String(p.price),
      cost: String(p.cost),
      stock: String(p.stock),
      minStock: String(p.minStock),
    });
    setDialogOpen(true);
  };

  const filtered = (products || []).filter(
    (p) =>
      (!search || p.name.includes(search) || p.sku.toLowerCase().includes(search.toLowerCase()) || (p.category || "").includes(search)) &&
      (!onlyLow || p.low)
  );

  const totalValue = filtered.reduce((s, p) => s + p.stockValue, 0);
  const lowCount = (products || []).filter((p) => p.low).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Boxes className="h-4 w-4" /> عدد المنتجات
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{products?.length ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Boxes className="h-4 w-4" /> قيمة المخزون (تكلفة)
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums text-primary">{fmtEGP(totalValue)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <PackageX className="h-4 w-4" /> منتجات تحت الحد
            </CardDescription>
            <CardTitle className={`text-2xl tabular-nums ${lowCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}`}>
              {lowCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الرمز..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
          <Button variant={onlyLow ? "default" : "outline"} onClick={() => setOnlyLow(!onlyLow)} className="gap-1.5 whitespace-nowrap">
            <AlertTriangle className="h-4 w-4" />
            النواقص فقط
          </Button>
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
            setDialogOpen(true);
          }}
          className="gap-2"
        >
          <PackagePlus className="h-4 w-4" />
          منتج جديد
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">المخزون</CardTitle>
          <CardDescription>{filtered.length} منتج معروض</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">لا توجد منتجات مطابقة</p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2.5 text-right font-medium">المنتج</th>
                      <th className="py-2.5 text-right font-medium">التصنيف</th>
                      <th className="py-2.5 text-right font-medium tabular-nums">سعر البيع</th>
                      <th className="py-2.5 text-right font-medium tabular-nums">التكلفة</th>
                      <th className="py-2.5 text-right font-medium tabular-nums">هامش %</th>
                      <th className="py-2.5 text-right font-medium">المخزون</th>
                      <th className="py-2.5 text-right font-medium tabular-nums">قيمة</th>
                      <th className="py-2.5 text-left font-medium">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3">
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground font-mono" dir="ltr">{p.sku}</p>
                        </td>
                        <td className="py-3">
                          <Badge variant="secondary">{p.category || "غير مصنف"}</Badge>
                        </td>
                        <td className="py-3 tabular-nums">{fmtEGP(p.price)}</td>
                        <td className="py-3 tabular-nums text-muted-foreground">{fmtEGP(p.cost)}</td>
                        <td className="py-3 tabular-nums">
                          <span className={p.margin >= 15 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-amber-600 dark:text-amber-400"}>
                            {p.margin}%
                          </span>
                        </td>
                        <td className="py-3 min-w-32">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`tabular-nums font-semibold text-sm ${p.low ? "text-red-600 dark:text-red-400" : ""}`}>
                                {fmtNum(p.stock)}
                              </span>
                              <span className="text-xs text-muted-foreground">{p.unit}</span>
                            </div>
                            <Progress
                              value={Math.min((p.stock / Math.max(p.minStock * 3, 1)) * 100, 100)}
                              className="h-1"
                            />
                          </div>
                        </td>
                        <td className="py-3 tabular-nums">{fmtEGP(p.stockValue)}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="تعديل">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(p.id)} className="text-destructive hover:text-destructive" aria-label="حذف">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {filtered.map((p) => (
                  <div key={p.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono" dir="ltr">{p.sku}</p>
                      </div>
                      {p.low ? (
                        <Badge variant="destructive">ناقص: {p.stock}</Badge>
                      ) : (
                        <Badge variant="secondary">{p.category || "غير مصنف"}</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">سعر البيع</p>
                        <p className="font-semibold tabular-nums">{fmtEGP(p.price)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">المخزون</p>
                        <p className="font-semibold tabular-nums">{p.stock} {p.unit}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">القيمة</p>
                        <p className="font-semibold tabular-nums">{fmtEGP(p.stockValue)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" /> تعديل
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 gap-1 text-destructive" onClick={() => setDeleteId(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" /> حذف
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
            <DialogDescription>بيانات المنتج والمخزون — الحقول بعلامة * مطلوبة</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pname">اسم المنتج *</Label>
                <Input id="pname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="شاشة سامسونج 27 بوصة" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">الرمز SKU *</Label>
                <Input id="sku" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="MON-002" dir="ltr" className="text-right" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="cat">التصنيف</Label>
                <Input id="cat" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="إلكترونيات" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">الوحدة</Label>
                <Input id="unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="قطعة" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">سعر البيع *</Label>
                <Input id="price" type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="8900" dir="ltr" className="text-right" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">التكلفة</Label>
                <Input id="cost" type="number" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="7200" dir="ltr" className="text-right" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">المخزون</Label>
                <Input id="stock" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="10" dir="ltr" className="text-right" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minstock">حد أدنى</Label>
                <Input id="minstock" type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} placeholder="5" dir="ltr" className="text-right" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim() || !form.sku.trim()}>
              {saveMutation.isPending ? "جارٍ الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة المنتج"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              تأكيد حذف المنتج
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيُحذف المنتج من المخزون نهائياً. بنود الفواتير المرتبطة ستبقى لكن دون ربط بالمخزون.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
