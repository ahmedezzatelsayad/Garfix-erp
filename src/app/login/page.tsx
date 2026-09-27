"use client";

/**
 * Garfix ERP — صفحة تسجيل الدخول (المرحلة 5: المستخدمون والأمان)
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Wrench, LogIn, Mail, Lock, ShieldCheck, Users, Calculator, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

const DEMO_ACCOUNTS = [
  { email: "admin@garfix.app", password: "Admin@123", label: "مدير النظام", icon: ShieldCheck, desc: "كل الصلاحيات" },
  { email: "accountant@garfix.app", password: "Acc@12345", label: "محاسب", icon: Calculator, desc: "المالية والتقارير" },
  { email: "sales@garfix.app", password: "Sales@12345", label: "مبيعات", icon: Users, desc: "العملاء والفواتير" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ضمان وجود الحسابات التجريبية (بذر مرة واحدة — idempotent)
  useEffect(() => {
    fetch("/api/auth/login", { method: "PUT" }).catch(() => {});
  }, []);

  const doLogin = async (em: string, pw: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, password: pw }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "تعذر تسجيل الدخول");
      toast({ title: `أهلاً ${j.user.name} 👋`, description: "تم تسجيل الدخول بنجاح" });
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-emerald-50/60 to-background dark:via-emerald-950/30 p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center"
      >
        {/* ===== الجانب التعريفي ===== */}
        <div className="hidden lg:flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary p-3 text-primary-foreground shadow-lg shadow-primary/25">
              <Wrench className="h-7 w-7" />
            </div>
            <div>
              <p className="font-bold text-3xl leading-none">Garfix</p>
              <p className="text-sm text-muted-foreground tracking-widest">ERP SYSTEM</p>
            </div>
          </div>

          <h1 className="text-4xl font-bold leading-tight">
            نظام إدارة الموارد
            <span className="text-primary"> الذكي </span>
            لشركتك
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            فواتير ض.ق.م، عملاء، مخزون، مصروفات، تحليلات وتقارير مالية — ومعهم
            وكلاء أذكياء يجيبون عن أسئلتك ببياناتك الحقيقية.
          </p>

          <div className="grid grid-cols-2 gap-3 max-w-md">
            {[
              { icon: Calculator, t: "محاسبة كاملة", d: "قائمة دخل وتقادم ذمم" },
              { icon: Bot, t: "وكلاء AI", d: "تحليل ببياناتك مباشرة" },
              { icon: ShieldCheck, t: "أدوار وصلاحيات", d: "مدير / محاسب / مبيعات" },
              { icon: Users, t: "بيانات تجريبية", d: "سوق مصري واقعي" },
            ].map((f) => (
              <div key={f.t} className="rounded-xl border bg-card p-3.5">
                <f.icon className="h-5 w-5 text-primary mb-1.5" />
                <p className="font-semibold text-sm">{f.t}</p>
                <p className="text-xs text-muted-foreground">{f.d}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ===== نموذج الدخول ===== */}
        <Card className="shadow-xl border-border/60">
          <CardHeader className="text-center">
            <div className="lg:hidden mx-auto mb-3 w-fit rounded-xl bg-primary p-2 text-primary-foreground">
              <Wrench className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">تسجيل الدخول</CardTitle>
            <CardDescription>ادخل بياناتك للوصول إلى لوحة إدارة شركتك</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                doLogin(email, password);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    dir="ltr"
                    className="ps-10 text-right"
                    placeholder="admin@garfix.app"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    dir="ltr"
                    className="ps-10 text-right"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border-destructive/50 bg-destructive/10 text-destructive text-sm p-3 text-center">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full gap-2 h-11" disabled={loading}>
                <LogIn className="h-4 w-4" />
                {loading ? "جارٍ التحقق..." : "دخول"}
              </Button>
            </form>

            {/* ===== الحسابات التجريبية ===== */}
            <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                حسابات تجريبية — اضغط للدخول السريع
              </p>
              <div className="grid gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(a.password);
                      doLogin(a.email, a.password);
                    }}
                    disabled={loading}
                    className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-start transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60"
                  >
                    <a.icon className="h-4.5 w-4.5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {a.label}
                        <span className="font-normal text-muted-foreground text-xs"> — {a.desc}</span>
                      </p>
                      <p dir="ltr" className="text-[11px] text-muted-foreground truncate">{a.email} · {a.password}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{a.email === "admin@garfix.app" ? "admin" : a.email.startsWith("accountant") ? "accountant" : "sales"}</Badge>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
