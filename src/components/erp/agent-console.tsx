"use client";

/**
 * Garfix ERP — محرك الوكلاء الأذكياء (Agent Engine)
 * واجهة الدردشة مع الوكلاء المتخصصين + سجل التشغيل
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Bot,
  Send,
  Sparkles,
  Landmark,
  Package,
  Users,
  Truck,
  History,
  Trash2,
  User,
  Loader2,
} from "lucide-react";
import { fmtDate } from "./format";

interface AgentInfo {
  key: string;
  name: string;
  description: string;
}

interface RunRow {
  id: string;
  agent: string;
  agentName: string;
  query: string;
  response: string | null;
  status: string;
  duration: number | null;
  createdAt: string;
}

const agentIcons: Record<string, React.ElementType> = {
  finance: Landmark,
  inventory: Package,
  crm: Users,
  purchasing: Truck,
  general: Bot,
};

const suggestions: Record<string, string[]> = {
  finance: [
    "حلّل أداء الشركة المالي في آخر 3 أشهر واذكر أهم 3 ملاحظات",
    "ما نسبة المصروفات إلى الإيرادات؟ وهل هناك خطر على التدفق النقدي؟",
    "اقترح خطة لتحسين الربحية بناءً على بياناتي",
  ],
  inventory: [
    "ما المنتجات الناقصة التي تحتاج إعادة طلب فورية؟",
    "اقترح كميات طلب للمخزون الناقص",
    "هل هناك منتجات حركة بطيئة يجب التوقف عن تخزينها؟",
  ],
  crm: [
    "من أكثر العملاء تأخراً في السداد؟ اعرض الترتيب",
    "اكتب لي رسالة تحصيل مهذبة للعميل الأكثر تأخراً",
    "اقترح خطة متابعة لتحصيل الذمم المتأخرة",
  ],
  purchasing: [
    "حلّل أداء الموردين واعرض أهم 3 ملاحظات على المستحقات",
    "اقترح أمر شراء للمنتجات الناقصة مع الكميات والتكلفة التقديرية",
    "ما مستحقات الموردين المتأخرة وتأثيرها على التدفق النقدي؟",
  ],
  general: [
    "لخص لي حالة الشركة الآن في نقاط",
    "من هم أهم 5 عملاء لدي؟",
    "كم عدد الفواتير المسودة التي لم تُرسل بعد؟",
  ],
};

export function AgentSection() {
  const queryClient = useQueryClient();
  const [activeAgent, setActiveAgent] = useState("finance");
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: "user" | "agent"; text: string; duration?: number }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<{ agents: AgentInfo[]; runs: RunRow[] }>({
    queryKey: ["agent"],
    queryFn: async () => {
      const res = await fetch("/api/agent");
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const runMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent: activeAgent, query: text }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      return j as { response: string; duration: number };
    },
    onSuccess: (j) => {
      setChat((c) => [...c, { role: "agent", text: j.response, duration: j.duration }]);
      queryClient.invalidateQueries({ queryKey: ["agent"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => {
      setChat((c) => [...c, { role: "agent", text: `⚠️ تعذر تشغيل الوكيل: ${e.message}` }]);
      toast({ title: "خطأ في محرك الوكلاء", description: e.message, variant: "destructive" });
    },
  });

  const send = (text?: string) => {
    const q = (text ?? query).trim();
    if (!q || runMutation.isPending) return;
    setChat((c) => [...c, { role: "user", text: q }]);
    setQuery("");
    runMutation.mutate(q);
  };

  const agents = data?.agents || [];
  const runs = data?.runs || [];
  const activeAgentInfo = agents.find((a) => a.key === activeAgent);
  const ActiveIcon = agentIcons[activeAgent] || Bot;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ===== اختيار الوكيل ===== */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              فريق الوكلاء الأذكياء
            </CardTitle>
            <CardDescription>وكلاء متخصصون يقرؤون بيانات شركتك الحقيقية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {isLoading && agents.length === 0 && (
              <>
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </>
            )}
            {agents.map((a) => {
              const Icon = agentIcons[a.key] || Bot;
              const isActive = activeAgent === a.key;
              return (
                <button
                  key={a.key}
                  onClick={() => setActiveAgent(a.key)}
                  className={`w-full text-right rounded-xl border p-3.5 transition-all hover:shadow-sm ${
                    isActive ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border"
                  }`}
                  aria-pressed={isActive}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{a.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* سجل التشغيل */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              سجل التشغيل
              <Badge variant="secondary" className="ms-auto tabular-nums">{runs.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-72">
              {runs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">لا يوجد تشغيل سابق — ابدأ الدردشة</p>
              ) : (
                <div className="space-y-1.5">
                  {runs.slice(0, 15).map((r) => {
                    const Icon = agentIcons[r.agent] || Bot;
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          setChat([
                            { role: "user", text: r.query },
                            { role: "agent", text: r.response || "—", duration: r.duration || undefined },
                          ]);
                        }}
                        className="w-full text-right rounded-lg border p-2.5 hover:bg-muted/50 transition-colors"
                        title="عرض المحادثة"
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate font-medium">{r.agentName}</span>
                          <span className="text-muted-foreground ms-auto shrink-0" dir="ltr">
                            {r.duration ? `${(r.duration / 1000).toFixed(1)}s` : r.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">{r.query}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{fmtDate(r.createdAt)}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* ===== منطقة الدردشة ===== */}
      <Card className="lg:col-span-2 flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2.5 text-primary-foreground">
              <ActiveIcon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">{activeAgentInfo?.name || "الوكيل"}</CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${runMutation.isPending ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                {runMutation.isPending ? "يعمل الآن على سؤالك..." : "جاهز — متصل ببيانات الشركة"}
              </CardDescription>
            </div>
            {chat.length > 0 && (
              <Button variant="ghost" size="icon" onClick={() => setChat([])} aria-label="مسح المحادثة">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-[420px]">
          <ScrollArea className="flex-1">
            <div className="space-y-4 py-4">
              {chat.length === 0 && (
                <div className="space-y-4 py-6">
                  <div className="text-center space-y-2">
                    <div className="mx-auto rounded-2xl bg-muted w-14 h-14 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <p className="font-semibold">اسأل وكيلك المتخصص</p>
                    <p className="text-sm text-muted-foreground">الوكيل يقرأ بياناتك الحقيقية: الفواتير، المخزون، العملاء، والمصروفات</p>
                  </div>
                  <div className="grid gap-2">
                    <p className="text-xs font-medium text-muted-foreground">أسئلة مقترحة:</p>
                    {(suggestions[activeAgent] || []).map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-right rounded-lg border border-dashed p-3 text-sm hover:border-primary hover:bg-primary/5 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chat.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`shrink-0 rounded-lg p-2 h-8 w-8 flex items-center justify-center ${
                      m.role === "user" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {m.role === "user" ? <User className="h-4 w-4" /> : <ActiveIcon className="h-4 w-4" />}
                  </div>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-muted rounded-ts-sm"
                        : "bg-primary/10 border border-primary/20 rounded-te-sm"
                    }`}
                  >
                    {m.text}
                    {m.duration && (
                      <p className="text-[10px] text-muted-foreground mt-2" dir="ltr">
                        ⚡ {(m.duration / 1000).toFixed(1)}s
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {runMutation.isPending && (
                <div className="flex gap-3">
                  <div className="shrink-0 rounded-lg p-2 bg-primary text-primary-foreground h-8 w-8 flex items-center justify-center">
                    <ActiveIcon className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl px-4 py-3 bg-primary/10 border border-primary/20 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    يحلل بيانات الشركة ويجهز الرد...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          <Separator className="my-3" />

          <div className="flex gap-2">
            <Input
              placeholder="اكتب سؤالك هنا..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={runMutation.isPending}
              aria-label="سؤال للوكيل"
            />
            <Button onClick={() => send()} disabled={runMutation.isPending || !query.trim()} className="gap-1.5" aria-label="إرسال">
              <Send className="h-4 w-4" />
              إرسال
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
