"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { FolderKanban, Home, KeyRound, Library, Settings, Sparkles } from "lucide-react";
import { usePrefs } from "@/lib/client/prefs";
import { cn } from "@/lib/shared/utils";

export function Sidebar() {
  const { d } = usePrefs();
  const path = usePathname();
  const items = [
    { href: "/", label: d.nav.home, icon: Home, match: (p: string) => p === "/" },
    { href: "/library", label: d.nav.library, icon: Library, match: (p: string) => p.startsWith("/library") },
    { href: "/projects", label: d.nav.projects, icon: FolderKanban, match: (p: string) => p.startsWith("/projects") },
  ];
  const bottom = [
    { href: "/settings/providers", label: d.nav.providers, icon: KeyRound, match: (p: string) => p.startsWith("/settings/providers") },
    { href: "/settings", label: d.nav.settings, icon: Settings, match: (p: string) => p === "/settings" },
  ];

  const renderItem = (it: (typeof items)[number]) => {
    const active = it.match(path);
    const Icon = it.icon;
    return (
      <Link
        key={it.href}
        href={it.href}
        className={cn(
          "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
          active ? "text-[rgb(var(--fg))]" : "text-muted hover:text-[rgb(var(--fg))]",
        )}
      >
        {active && (
          <motion.span
            layoutId="nav-pill"
            className="absolute inset-0 -z-0 rounded-2xl bg-white/80 shadow-[0_1px_3px_rgb(0_0_0/0.08),inset_0_1px_0_rgb(255_255_255/0.9)] dark:bg-white/12 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          />
        )}
        <Icon className={cn("relative z-[1] size-[18px] shrink-0", active && "text-accent")} strokeWidth={2} />
        <span className="relative z-[1] hidden lg:inline">{it.label}</span>
      </Link>
    );
  };

  return (
    <aside className="glass fixed top-3 bottom-3 left-3 z-30 flex w-[64px] flex-col rounded-[28px] p-2.5 lg:w-[220px]">
      <Link href="/" className="relative z-[2] mb-5 flex items-center gap-2.5 px-1.5 pt-1.5">
        <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-gradient-to-br from-[#5ac8fa] via-accent-2 to-[#ff2d92] shadow-[0_6px_16px_-4px_rgb(94_92_230/0.6),inset_0_1px_0_rgb(255_255_255/0.5)]">
          <Sparkles className="size-[18px] text-white" strokeWidth={2.4} />
        </div>
        <div className="hidden lg:block">
          <div className="text-[15px] leading-tight font-bold tracking-tight">{d.app.name}</div>
          <div className="text-[11px] text-muted">{d.app.tagline}</div>
        </div>
      </Link>
      <nav className="relative z-[2] flex flex-1 flex-col gap-1">{items.map(renderItem)}</nav>
      <nav className="relative z-[2] flex flex-col gap-1">{bottom.map(renderItem)}</nav>
    </aside>
  );
}
