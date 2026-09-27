"use client";

/**
 * Garfix ERP — شريط الطباعة (زر + فتح حوار الطباعة تلقائياً مع ?auto=1)
 */
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowRight } from "lucide-react";

export function PrintToolbar({ auto }: { auto?: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [auto]);

  return (
    <div className="no-print flex items-center justify-between gap-3 px-4 py-3 border-b bg-background sticky top-0 z-10">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => history.length > 1 ? history.back() : window.close()}>
        <ArrowRight className="h-4 w-4" />
        رجوع
      </Button>
      <p className="text-xs text-muted-foreground hidden sm:block">
        من نافذة الطباعة اختر «حفظ كـ PDF» لتصدير الفاتورة ملفاً
      </p>
      <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
        <Printer className="h-4 w-4" />
        طباعة / حفظ PDF
      </Button>
    </div>
  );
}
