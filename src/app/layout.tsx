import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "جارفكس ERP — نظام إدارة الموارد الذكي",
  description:
    "نظام Garfix ERP لإدارة العملاء والفواتير والمخزون والمصروفات مع محرك وكلاء أذكياء — المرحلة الرابعة: التحليلات والتقارير المتقدمة.",
  keywords: ["Garfix", "ERP", "إدارة أعمال", "فواتير", "مخزون", "ذكاء اصطناعي"],
  authors: [{ name: "Garfix" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${cairo.variable} font-cairo antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
