"use client";

/**
 * Garfix ERP — إدارة المستخدمين (المرحلة 5 — للمدير فقط)
 * إنشاء/تعديل/إيقاف/حذف الحسابات + إعادة تعيين كلمات المرور
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
import { toast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  UserPlus,
  Users,
  KeyRound,
  Trash2,
  Mail,
  Pencil,
  ShieldAlert,
} from "lucide-react";
import { ROLE_LABELS, type Role, type SessionUser } from "@/lib/roles";
import { fmtDate } from "./format";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const roleBadge: Record<Role, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  accountant: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  sales: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
};

const emptyForm = { name: "", email: "", password: "", role: "sales" as Role };

export function UsersSection({ currentUser }: { currentUser: SessionUser }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("sales");
  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);

  const { data, isLoading } = useQuery<{ users: UserRow[] }>({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setForm(emptyForm);
      toast({ title: "تم إنشاء المستخدم", description: "يمكنه الدخول الآن ببياناته" });
    },
    onError: (e: Error) => toast({ title: "تعذر الإنشاء", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown> & { id: string }) => {
      const { id, ...body } = payload;
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "تم تحديث المستخدم" });
    },
    onError: (e: Error) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: () => {
      invalidate();
      setDeleteUser(null);
      toast({ title: "تم حذف المستخدم", description: "أُنهيت كل جلساته فوراً" });
    },
    onError: (e: Error) => toast({ title: "تعذر الحذف", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const users = data?.users ?? [];

  return (
    <div className="space-y-4">
      {/* ===== بطاقة موجز ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                المستخدمون والصلاحيات
              </CardTitle>
              <CardDescription className="mt-1.5">
                {users.length} حساب · {users.filter((u) => u.role === "admin").length} مدير ·{" "}
                {users.filter((u) => u.role === "accountant").length} محاسب ·{" "}
                {users.filter((u) => u.role === "sales").length} مبيعات
              </CardDescription>
            </div>
            <Button className="gap-2" onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4" />
              مستخدم جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-3">
            {(["admin", "accountant", "sales"] as Role[]).map((r) => (
              <div key={r} className="rounded-xl border bg-muted/30 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="outline" className={roleBadge[r]}>{ROLE_LABELS[r]}</Badge>
                  <span className="text-xs text-muted-foreground">{users.filter((u) => u.role === r).length} حساب</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {r === "admin" && "كل الصلاحيات: المستخدمون والإعدادات والحذف والنسخ الاحتياطي"}
                  {r === "accountant" && "المالية: الفواتير والمدفوعات والمصروفات والتقارير"}
                  {r === "sales" && "البيع: العملاء وإنشاء الفواتير — بلا بيانات مالية حساسة"}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ===== جدول المستخدمين ===== */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            الحسابات
          </CardTitle>
          <CardDescription>إدارة الحسابات والأدوار وكلمات المرور</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className={`flex flex-wrap items-center gap-3 rounded-xl border p-3.5 ${
                  !u.isActive ? "opacity-60 bg-muted/30" : ""
                }`}
              >
                <div className="rounded-full bg-primary/10 text-primary border border-primary/25 w-10 h-10 flex items-center justify-center text-sm font-bold shrink-0">
                  {u.name.trim().slice(0, 2)}
                </div>
                <div className="flex-1 min-w-[160px]">
                  <p className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                    {u.name}
                    {u.id === currentUser.id && (
                      <Badge variant="outline" className="text-[9px]">أنت</Badge>
                    )}
                    {!u.isActive && (
                      <Badge variant="outline" className="text-[9px] text-destructive border-destructive/40">موقوف</Badge>
                    )}
                  </p>
                  <p dir="ltr" className="text-xs text-muted-foreground flex items-center gap-1 justify-end sm:justify-start text-start sm:text-start">
                    <Mail className="h-3 w-3" />
                    {u.email}
                  </p>
                </div>
                <Badge variant="outline" className={roleBadge[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                <div className="text-xs text-muted-foreground hidden md:block min-w-[110px]">
                  آخر دخول: {u.lastLoginAt ? fmtDate(u.lastLoginAt) : "لم يدخل بعد"}
                </div>
                <div className="flex items-center gap-1.5 ms-auto">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="تعديل"
                    onClick={() => {
                      setEditing(u);
                      setEditName(u.name);
                      setEditRole(u.role);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="إعادة تعيين كلمة المرور"
                    onClick={() => {
                      setPwUser(u);
                      setNewPassword("");
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex items-center gap-1.5 px-1" title={u.isActive ? "إيقاف الحساب" : "تنشيط الحساب"}>
                    <Switch
                      checked={u.isActive}
                      disabled={u.id === currentUser.id || updateMutation.isPending}
                      onCheckedChange={(v) => updateMutation.mutate({ id: u.id, isActive: v })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    title="حذف"
                    disabled={u.id === currentUser.id}
                    onClick={() => setDeleteUser(u)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ===== حوار الإنشاء ===== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>مستخدم جديد</DialogTitle>
            <DialogDescription>أضف حساباً ببياناته ودوره وصلاحياته</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="u-name">الاسم</Label>
              <Input id="u-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="مثال: منى حسن" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-email">البريد الإلكتروني</Label>
              <Input id="u-email" dir="ltr" className="text-right" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="user@garfix.app" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-pass">كلمة المرور</Label>
              <Input id="u-pass" dir="ltr" className="text-right" type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="8 أحرف على الأقل" />
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as Role }))}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.name.trim() || !form.email.trim() || form.password.length < 8}
            >
              {createMutation.isPending ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== حوار التعديل ===== */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تعديل المستخدم</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>إلغاء</Button>
            <Button
              onClick={() => {
                if (editing) {
                  updateMutation.mutate({ id: editing.id, name: editName, role: editRole });
                  setEditing(null);
                }
              }}
              disabled={updateMutation.isPending || !editName.trim()}
            >
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== حوار كلمة المرور ===== */}
      <Dialog open={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
            <DialogDescription>{pwUser?.name} — {pwUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-pass">كلمة المرور الجديدة</Label>
            <Input id="new-pass" dir="ltr" className="text-right" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="8 أحرف على الأقل" />
            <p className="text-xs text-muted-foreground">سيُطلب من المستخدم الدخول بها في المرة القادمة.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPwUser(null)}>إلغاء</Button>
            <Button
              onClick={() => {
                if (pwUser && newPassword.length >= 8) {
                  updateMutation.mutate({ id: pwUser.id, password: newPassword });
                  setPwUser(null);
                }
              }}
              disabled={newPassword.length < 8 || updateMutation.isPending}
            >
              تعيين
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== حوار الحذف ===== */}
      <Dialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              حذف المستخدم
            </DialogTitle>
            <DialogDescription>
              سيُحذف حساب «{deleteUser?.name}» وتُنهى كل جلساته نهائياً. لا يمكن التراجع.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteUser && deleteMutation.mutate(deleteUser.id)} disabled={deleteMutation.isPending}>
              حذف نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
