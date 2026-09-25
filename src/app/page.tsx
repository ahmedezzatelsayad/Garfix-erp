"use client";

/**
 * Garfix ERP — الواجهة الرئيسية
 * المرحلة 4: التحليلات والتقارير والإعدادات فوق نواة ERP + Agent Engine
 */
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  Receipt,
  Bot,
  BarChart3,
  Settings,
  Menu,
  Sun,
  Moon,
  Wrench,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import { DashboardSection } from "@/components/erp/dashboard";
import { InvoicesSection } from "@/components/erp/invoices";
import { ClientsSection } from "@/components/erp/clients";
import { InventorySection } from "@/components/erp/inventory";
import { ExpensesSection } from "@/components/erp/expenses";
import { AgentSection } from "@/components/erp/agent-console";
import { ReportsSection } from "@/components/erp/reports";
import { SettingsSection } from "@/components/erp/settings";

type TabKey =
  | "dashboard"
  | "invoices"
  | "clients"
  | "inventory"
  | "expenses"
  | "agent"
  | "reports"
  | "settings";

const NAV: {
  key: TabKey;
  label: string;
  icon: React.ElementType;
  desc: string;
  badge?: string;
}[] = [
  { key: "dashboard", label: "لوحة المعلومات", icon: LayoutDashboard, desc: "نظرة شاملة على أداء شركتك" },
  { key: "invoices", label: "الفواتير", icon: FileText, desc: "إنشاء ومتابعة الفواتير والمدفوعات" },
  { key: "clients", label: "العملاء", icon: Users, desc: "قاعدة بيانات العملاء وأرصدتهم" },
  { key: "inventory", label: "المخزون", icon: Package, desc: "إدارة المنتجات ومستويات المخزون" },
  { key: "expenses", label: "المصروفات", icon: Receipt, desc: "تسجيل وتصنيف المصروفات التشغيلية" },
  { key: "agent", label: "الوكلاء الأذكياء", icon: Bot, desc: "محرك الوكلاء — اسأل عن بياناتك", badge: "AI" },
  { key: "reports", label: "التقارير", icon: BarChart3, desc: "قائمة الدخل وتقادم الذمم والتقييم", badge: "جديد" },
  { key: "settings", label: "الإعدادات", icon: Settings, desc: "بيانات الشركة وإعدادات الفوترة" },
];

const PHASES = [
  { n: 1, label: "الأساس والنواة", done: true },
  { n: 2, label: "وحدات التشغيل", done: true },
  { n: 3, label: "محرك الوكلاء", done: true },
  { n: 4, label: "التحليلات والتقارير", done: false, current: true },
];

function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => {
        const isDark = document.documentElement.classList.contains("dark");
        setTheme(isDark ? "light" : "dark");
      }}
      aria-label="تبديل الوضع النهاري/الليلي"
    >
      <Sun className="h-4.5 w-4.5 hidden dark:block" />
      <Moon className="h-4.5 w-4.5 dark:hidden" />
    </Button>
  );
}

function BrandLogo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="rounded-xl bg-primary p-2 text-primary-foreground shadow-sm">
        <Wrench className="h-5 w-5" />
      </div>
      <div>
        <p className="font-bold text-lg leading-none text-sidebar-foreground">Garfix</p>
        <p className="text-[10px] text-sidebar-foreground/60 tracking-wide">ERP SYSTEM</p>
      </div>
    </div>
  );
}

function PhaseRoadmap() {
  return (
    <div className="mx-2 mb-2 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 p-3">
      <p className="text-[11px] font-semibold text-sidebar-foreground/70 mb-2">خطة المراحل</p>
      <div className="space-y-1.5">
        {PHASES.map((p) => (
          <div key={p.n} className="flex items-center gap-2 text-xs">
            {p.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <CircleDot className="h-3.5 w-3.5 text-amber-400 animate-pulse shrink-0" />
            )}
            <span
              className={`truncate ${
                p.current
                  ? "text-sidebar-foreground font-bold"
                  : p.done
                    ? "text-sidebar-foreground/60"
                    : "text-sidebar-foreground/80"
              }`}
            >
              {p.n}. {p.label}
            </span>
            {p.current && (
              <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0 h-4 ms-auto shrink-0">
                حالياً
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SidebarNav({ active, onSelect }: { active: TabKey; onSelect: (k: TabKey) => void }) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="التنقل الرئيسي">
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onSelect(item.key)}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.badge && (
              <Badge
                className={`ms-auto shrink-0 text-[9px] px-1.5 py-0 h-4.5 ${
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/15 text-primary"
                }`}
              >
                {item.badge}
              </Badge>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export default function Home() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
          },
        },
      })
  );
  const isMobile = useIsMobile();

  const active = NAV.find((n) => n.key === tab)!;

  const navigate = (k: string) => {
    setTab(k as TabKey);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const content = (
    <main className="flex-1 px-4 sm:px-6 py-6 w-full max-w-[1600px] mx-auto">
      {tab === "dashboard" && <DashboardSection onNavigate={navigate} />}
      {tab === "invoices" && <InvoicesSection />}
      {tab === "clients" && <ClientsSection />}
      {tab === "inventory" && <InventorySection />}
      {tab === "expenses" && <ExpensesSection />}
      {tab === "agent" && <AgentSection />}
      {tab === "reports" && <ReportsSection />}
      {tab === "settings" && <SettingsSection />}
    </main>
  );

  return (
    <QueryClientProvider client={queryClient}>
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex">
        {/* ===== الشريط الجانبي — سطح المكتب ===== */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar border-s border-sidebar-border sticky top-0 h-screen">
          <div className="p-4 pb-3">
            <BrandLogo />
          </div>
          <SidebarNav active={tab} onSelect={(k) => navigate(k)} />
          <PhaseRoadmap />
          <div className="px-4 py-3 text-[10px] text-sidebar-foreground/40 border-t border-sidebar-border/60">
            Garfix ERP v4.0 © 2026
          </div>
        </aside>

        {/* ===== المحتوى الرئيسي ===== */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 no-print">
            <div className="px-4 sm:px-6 py-3 flex items-center gap-3 max-w-[1600px] mx-auto w-full">
              {/* زر القائمة للموبايل */}
              {isMobile && (
                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label="فتح القائمة">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-72 p-0 bg-sidebar border-sidebar-border">
                    <SheetTitle className="sr-only">قائمة التنقل</SheetTitle>
                    <div className="p-4 pb-3">
                      <BrandLogo />
                    </div>
                    <SidebarNav active={tab} onSelect={(k) => navigate(k)} />
                    <PhaseRoadmap />
                  </SheetContent>
                </Sheet>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-bold text-lg truncate">{active.label}</h1>
                  {active.key === "reports" && (
                    <Badge className="bg-primary/10 text-primary border border-primary/30">
                      المرحلة 4
                    </Badge>
                  )}
                  {active.key === "agent" && (
                    <Badge className="bg-primary/10 text-primary border border-primary/30">
                      Agent Engine
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate hidden sm:block">{active.desc}</p>
              </div>

              <ThemeToggle />
            </div>
          </header>

          {content}

          <footer className="mt-auto border-t bg-muted/30 no-print">
            <div className="px-4 sm:px-6 py-4 max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-primary" />
                Garfix ERP — نظام إدارة الموارد الذكي
              </p>
              <p>
                المرحلة 4 من 4 — التحليلات والتقارير والوكلاء الأذكياء
              </p>
            </div>
          </footer>
        </div>
      </div>
      <Toaster richColors position="top-center" />
    </div>
    </QueryClientProvider>
  );
}
