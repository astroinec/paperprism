"use client";

import Link from "next/link";
import useSWR from "swr";
import { motion } from "motion/react";
import { ArrowRight, FileText, FolderKanban, KeyRound, Layers, Plus, Sparkles, Upload, Zap } from "lucide-react";
import { Badge, Button, Empty, GlassPanel } from "@/components/glass";
import { fetcher, timeAgo } from "@/lib/client/api";
import { useProjects, useServerSettings } from "@/lib/client/hooks";
import { fmt, usePrefs } from "@/lib/client/prefs";

interface UsageRes {
  stats: { papers: number; projects: number; cells: number; tokens: number };
}

const fadeUp = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.05 * i, type: "spring" as const, stiffness: 260, damping: 26 },
});

export default function Home() {
  const { d, lang } = usePrefs();
  const { data: usage } = useSWR<UsageRes>("/api/usage", fetcher);
  const { data: projects } = useProjects();
  const { data: settings } = useServerSettings();
  const isDemo = settings?.activeModel?.providerId === "mock";

  const steps = [
    { href: "/settings/providers", icon: KeyRound, title: d.home.step1, desc: d.home.step1d, color: "from-[#5ac8fa] to-accent" },
    { href: "/library", icon: Upload, title: d.home.step2, desc: d.home.step2d, color: "from-[#bf5af2] to-accent-2" },
    { href: "/projects?new=1", icon: Layers, title: d.home.step3, desc: d.home.step3d, color: "from-[#ff6482] to-[#ff2d55]" },
  ];
  const stats = [
    { label: d.home.statPapers, value: usage?.stats.papers, icon: FileText },
    { label: d.home.statProjects, value: usage?.stats.projects, icon: FolderKanban },
    { label: d.home.statCells, value: usage?.stats.cells, icon: Layers },
    { label: d.home.statTokens, value: usage?.stats.tokens, icon: Zap },
  ];

  return (
    <div className="space-y-5">
      <motion.div {...fadeUp(0)}>
        <GlassPanel variant="thick" spotlight className="overflow-hidden p-8 md:p-10">
          <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-gradient-to-br from-[#5ac8fa]/40 via-accent-2/30 to-[#ff2d92]/30 blur-3xl" />
          <div className="relative z-[2] max-w-2xl">
            <Badge color="blue" className="mb-4">
              <Sparkles className="size-3" /> {d.app.tagline}
            </Badge>
            <h1 className="bg-gradient-to-br from-[rgb(var(--fg))] to-[rgb(var(--fg))]/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
              {d.home.hello}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{d.home.sub}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/projects?new=1">
                <Button variant="primary" size="lg" icon={<Plus className="size-4" />}>
                  {d.home.newProject}
                </Button>
              </Link>
              <Link href="/library">
                <Button size="lg" icon={<Upload className="size-4" />}>
                  {d.home.step2}
                </Button>
              </Link>
            </div>
            {isDemo && <p className="mt-5 rounded-2xl bg-[#ff9f0a]/12 px-4 py-2.5 text-[13px] text-[#b86e00] dark:text-[#ffc15a]">{d.home.demoTip}</p>}
          </div>
        </GlassPanel>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div key={s.href} {...fadeUp(i + 1)}>
            <Link href={s.href}>
              <GlassPanel spotlight className="group h-full p-5 transition-transform duration-300 hover:-translate-y-1">
                <div className="relative z-[2]">
                  <div className={`mb-4 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br ${s.color} text-white shadow-lg`}>
                    <s.icon className="size-5" />
                  </div>
                  <div className="flex items-center gap-1 text-[15px] font-semibold">
                    <span className="mr-1 text-muted tabular">0{i + 1}</span>
                    {s.title}
                    <ArrowRight className="size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">{s.desc}</p>
                </div>
              </GlassPanel>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <motion.div {...fadeUp(4)}>
          <GlassPanel className="grid h-full grid-cols-2 gap-px overflow-hidden p-0">
            {stats.map((s) => (
              <div key={s.label} className="relative z-[2] p-5">
                <s.icon className="mb-3 size-4 text-accent" />
                <div className="text-3xl font-semibold tracking-tight tabular">{s.value == null ? "—" : s.value.toLocaleString()}</div>
                <div className="mt-0.5 text-xs text-muted">{s.label}</div>
              </div>
            ))}
          </GlassPanel>
        </motion.div>
        <motion.div {...fadeUp(5)}>
          <GlassPanel className="h-full p-5">
            <div className="relative z-[2]">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[15px] font-semibold">{d.home.recent}</div>
                <Link href="/projects" className="text-[13px] text-accent hover:underline">
                  {d.nav.projects} →
                </Link>
              </div>
              {projects && projects.length === 0 && <Empty className="py-8" icon={<FolderKanban />} title={d.home.noProjects} />}
              <div className="space-y-1">
                {projects?.slice(0, 5).map((p) => (
                  <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-[var(--hover)]">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent/15 to-[#bf5af2]/15 text-accent">
                      <FolderKanban className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted">
                        {fmt(d.projects.papers, { n: p.paperCount ?? 0 })} · {fmt(d.projects.updated, { t: timeAgo(p.updatedAt, lang) })}
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted" />
                  </Link>
                ))}
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      </div>
    </div>
  );
}
