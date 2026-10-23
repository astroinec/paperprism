"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { PrefsProvider } from "@/lib/client/prefs";
import { ToastProvider } from "@/components/glass/toast";
import { ConfirmProvider } from "@/components/glass/confirm";
import { Background } from "./Background";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <PrefsProvider>
      <SWRConfig value={{ revalidateOnFocus: false, shouldRetryOnError: false }}>
        <ToastProvider>
          <ConfirmProvider>
            <Background />
            <Sidebar />
            <div className="min-h-screen pr-3 pl-[88px] lg:pl-[244px]">
              <TopBar />
              <main className="mx-auto max-w-[1440px] pt-3 pb-10">{children}</main>
            </div>
          </ConfirmProvider>
        </ToastProvider>
      </SWRConfig>
    </PrefsProvider>
  );
}
