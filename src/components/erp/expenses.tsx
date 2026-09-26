"use client";

/**
 * Garfix ERP — إدارة المصروفات
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
import { toast } from "@/hooks/use-toast";
import { Receipt, Plus, Search } from "lucide-react";
import { fmtEGP, fmtDate, fmtDateInput, EXPENSE_CATEGORIES } from "./format";

interface ExpenseRow {
  id: string;
  category: string;
  categoryLabel: string;
  description: string | null;
  amount: number;
  date: string;
  vendor: string | null;
}

const emptyForm = {
  category: "other",
  description: "",
  amount: "",
  vendor: "",
  date: fmtDateInput(new Date()),
};

export function ExpensesSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: expenses, isLoading } = useQuery<ExpenseRow[]>({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await fetch("/api/expenses");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          description: form.description,
          amount: Number(form.amount),
          vendor: form.vendor,
          date: form.date,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({ title: "تم تسجيل المصروف", description: `${fmtEGP(Number(form.amount))} — ${form.category}` });
      setDialogOpen(false);
      setForm({ ...emptyForm });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filtered = (expenses || []).filter(
    (e) =>
      (catFilter === "all" || e.category === catFilter) &&
      (!search || (e.description || "").includes(search) || (e.vendor || "").includes(search))
  );

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-1 gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث في المصروفات..." value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل التصنيفات</SelectItem>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          تسجيل مصروف
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">سجل المصروفات</CardTitle>
          <CardDescription>{filtered.length} مصروف — الإجمالي: {fmtEGP(total)}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">لا توجد مصروفات مطابقة</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{e.description || e.categoryLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(e.date)} {e.vendor ? `• ${e.vendor}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{e.categoryLabel}</Badge>
                    <span className="tabular-nums font-semibold text-amber-600 dark:text-amber-400">{fmtEGP(e.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل مصروف جديد</DialogTitle>
            <DialogDescription>أدخل تفاصيل المصروف التشغيلي</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>التصنيف *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="eamount">المبلغ *</Label>
                <Input id="eamount" type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="5000" dir="ltr" className="text-right" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edesc">الوصف</Label>
              <Textarea id="edesc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="تفاصيل المصروف..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="evendor">الجهة / المورد</Label>
                <Input id="evendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="اسم المورد" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edate">التاريخ</Label>
                <Input id="edate" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} dir="ltr" className="text-right" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !Number(form.amount)}>
              {createMutation.isPending ? "جارٍ التسجيل..." : "تسجيل المصروف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
