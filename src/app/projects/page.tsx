"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { FolderKanban, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button, Empty, GlassPanel, IconButton, SectionTitle } from "@/components/glass";
import { Menu } from "@/components/glass/menu";
import { useConfirm } from "@/components/glass/confirm";
import { NewProjectModal } from "@/components/project/NewProjectModal";
import { useProjects } from "@/lib/client/hooks";
import { api, timeAgo } from "@/lib/client/api";
import { fmt, usePrefs } from "@/lib/client/prefs";

function ProjectsInner() {
  const { d, lang } = usePrefs();
  const sp = useSearchParams();
  const router = useRouter();
  const confirm = useConfirm();
  const { data: projects, mutate } = useProjects();
  const [open, setOpen] = useState(false);
  const initial = sp.get("papers")?.split(",").filter(Boolean) ?? [];

  useEffect(() => {
    if (sp.get("new") === "1") setOpen(true);
  }, [sp]);

  const close = () => {
    setOpen(false);
    if (sp.get("new")) router.replace("/projects");
  };

  return (
    <div>
      <SectionTitle
        title={d.projects.title}
        sub={d.projects.sub}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
            {d.projects.new}
          </Button>
        }
      />
      {projects?.length === 0 && (
        <GlassPanel>
          <Empty
            icon={<FolderKanban />}
            title={d.projects.empty}
            sub={d.projects.emptySub}
            action={
              <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
                {d.projects.new}
              </Button>
            }
          />
        </GlassPanel>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects?.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <GlassPanel spotlight className="group h-full p-5 transition-transform duration-300 hover:-translate-y-1">
              <div className="relative z-[2]">
                <div className="flex items-start justify-between">
                  <Link href={`/projects/${p.id}`} className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-2 to-[#bf5af2] text-white shadow-lg">
                    <FolderKanban className="size-5" />
                  </Link>
                  <Menu
                    trigger={() => (
                      <IconButton>
                        <MoreHorizontal className="size-4" />
                      </IconButton>
                    )}
                    items={[
                      {
                        label: d.common.delete,
                        icon: <Trash2 />,
                        danger: true,
                        onClick: async () => {
                          if (!(await confirm(d.projects.deleteConfirm, { danger: true }))) return;
                          await api(`/api/projects/${p.id}`, "DELETE");
                          mutate();
                        },
                      },
                    ]}
                  />
                </div>
                <Link href={`/projects/${p.id}`} className="mt-4 block">
                  <div className="line-clamp-2 text-[16px] font-semibold tracking-tight">{p.name}</div>
                  {p.question && <p className="mt-1 line-clamp-2 text-[13px] text-muted">{p.question}</p>}
                  <div className="mt-3 text-xs text-muted">
                    {fmt(d.projects.papers, { n: p.paperCount ?? 0 })} · {fmt(d.projects.updated, { t: timeAgo(p.updatedAt, lang) })}
                  </div>
                </Link>
              </div>
            </GlassPanel>
          </motion.div>
        ))}
      </div>
      <NewProjectModal open={open} onClose={close} initialPapers={initial} />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsInner />
    </Suspense>
  );
}
