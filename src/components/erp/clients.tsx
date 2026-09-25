"use client";

/**
 * Garfix ERP — إدارة العملاء
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
import { UserPlus, Pencil, Trash2, Search, Phone, Mail, MapPin, AlertTriangle } from "lucide-react";
import { fmtEGP, CLIENT_STATUS } from "./format";

interface ClientRow {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  status: string;
  notes: string | null;
  invoiceCount: number;
  totalBilled: number;
  totalPaid: number;
  balance: number;
  overdueCount: number;
}

const emptyForm = {
  name: "",
  company: "",
  phone: "",
  email: "",
  city: "",
  status: "active",
  notes: "",
};

export function ClientsSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: clients, isLoading } = useQuery<ClientRow[]>({
    queryKey: ["clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(editingId ? `/api/clients/${editingId}` : "/api/clients", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: editingId ? "تم تحديث العميل" : "تمت إضافة العميل", description: form.name });
      setDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "تم حذف العميل" });
      setDeleteId(null);
    },
    onError: (e: Error) => toast({ title: "تعذر الحذف", description: e.message, variant: "destructive" }),
  });

  const openEdit = (c: ClientRow) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      company: c.company || "",
      phone: c.phone || "",
      email: c.email || "",
      city: c.city || "",
      status: c.status,
      notes: c.notes || "",
    });
    setDialogOpen(true);
  };

  const filtered = (clients || []).filter(
    (c) =>
      !search ||
      c.name.includes(search) ||
      (c.company || "").includes(search) ||
      (c.phone || "").includes(search) ||
      (c.city || "").includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو الهاتف أو المدينة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Button
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
            setDialogOpen(true);
          }}
          className="gap-2"
        >
          <UserPlus className="h-4 w-4" />
          عميل جديد
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">قائمة العملاء</CardTitle>
          <CardDescription>{filtered.length} عميل — الإجمالي المستحق: {fmtEGP(filtered.reduce((s, c) => s + c.balance, 0))}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">لا يوجد عملاء مطابقون للبحث</p>
          ) : (
            <>
              {/* جدول للشاشات الكبيرة */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2.5 text-right font-medium">العميل</th>
                      <th className="py-2.5 text-right font-medium">التواصل</th>
                      <th className="py-2.5 text-right font-medium">الحالة</th>
                      <th className="py-2.5 text-right font-medium tabular-nums">فواتير</th>
                      <th className="py-2.5 text-right font-medium tabular-nums">إجمالي</th>
                      <th className="py-2.5 text-right font-medium tabular-nums">الرصيد</th>
                      <th className="py-2.5 text-left font-medium">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const st = CLIENT_STATUS[c.status];
                      return (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="py-3">
                            <p className="font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.company}</p>
                          </td>
                          <td className="py-3 space-y-0.5">
                            {c.phone && (
                              <p className="text-xs flex items-center gap-1 text-muted-foreground" dir="ltr">
                                <Phone className="h-3 w-3" /> {c.phone}
                              </p>
                            )}
                            {c.email && (
                              <p className="text-xs flex items-center gap-1 text-muted-foreground" dir="ltr">
                                <Mail className="h-3 w-3" /> {c.email}
                              </p>
                            )}
                          </td>
                          <td className="py-3">
                            <Badge variant={st?.variant || "outline"}>{st?.label || c.status}</Badge>
                          </td>
                          <td className="py-3 tabular-nums">{c.invoiceCount}</td>
                          <td className="py-3 tabular-nums">{fmtEGP(c.totalBilled)}</td>
                          <td className="py-3 tabular-nums">
                            <span className={c.balance > 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-emerald-600 dark:text-emerald-400"}>
                              {fmtEGP(c.balance)}
                            </span>
                            {c.overdueCount > 0 && (
                              <Badge variant="destructive" className="ms-2">{c.overdueCount} متأخرة</Badge>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="تعديل">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)} aria-label="حذف" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* بطاقات للموبايل */}
              <div className="md:hidden space-y-3">
                {filtered.map((c) => {
                  const st = CLIENT_STATUS[c.status];
                  return (
                    <div key={c.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.company}</p>
                        </div>
                        <Badge variant={st?.variant || "outline"}>{st?.label || c.status}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">فواتير</p>
                          <p className="font-semibold tabular-nums">{c.invoiceCount}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">إجمالي</p>
                          <p className="font-semibold tabular-nums">{fmtEGP(c.totalBilled)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">الرصيد</p>
                          <p className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{fmtEGP(c.balance)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" /> تعديل
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 gap-1 text-destructive" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" /> حذف
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* نافذة الإضافة/التعديل */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</DialogTitle>
            <DialogDescription>أدخل بيانات العميل — الحقول المميزة بعلامة * مطلوبة</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">الاسم *</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="أحمد محمود" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">الشركة</Label>
                <Input id="company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="شركة الأمل" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">الهاتف</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01012345678" dir="ltr" className="text-right" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" dir="ltr" className="text-right" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">المدينة</Label>
                <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="القاهرة" />
              </div>
              <div className="space-y-2">
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                    <SelectItem value="lead">عميل محتمل</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="أي ملاحظات عن العميل..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim()}>
              {saveMutation.isPending ? "جارٍ الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة العميل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأكيد الحذف */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              تأكيد حذف العميل
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف العميل نهائياً. لا يمكن الحذف إذا كان لديه فواتير مسجلة — يمكنك تعطيله بدلاً من الحذف.
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
