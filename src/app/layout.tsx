import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { BootScript } from "@/components/layout/BootScript";

export const metadata: Metadata = {
  title: "PaperPrism · 论文文献对比 Agent",
  description: "Local-first paper comparison agent with traceable matrices, reports and Q&A.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <BootScript />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
