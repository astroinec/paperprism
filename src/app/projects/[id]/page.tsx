"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { BarChart3, ChevronLeft, FileText, MessageSquare, Table2 } from "lucide-react";
import { Segmented, Spinner } from "@/components/glass";
import { useToast } from "@/components/glass/toast";
import { PdfViewer } from "@/components/common/PdfViewer";
import { MatrixView } from "@/components/project/MatrixView";
import { ReportView } from "@/components/project/ReportView";
import { ChatView } from "@/components/project/ChatView";
import { InsightsView } from "@/components/project/InsightsView";
import { useProject } from "@/lib/client/hooks";
import { api } from "@/lib/client/api";
import { fmt, usePrefs } from "@/lib/client/prefs";

type Tab = "matrix" | "report" | "chat" | "insights";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { d } = usePrefs();
  const toast = useToast();
  const { data: project, mutate, error } = useProject(id);
  const [tab, setTab] = useState<Tab>("matrix");
  const [pdf, setPdf] = useState<{ paperId: string; page: number | null } | null>(null);
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");

  useEffect(() => {
    if (project) {
      setName(project.name);
      setQuestion(project.question);
    }
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = window.location.hash.replace("#", "") as Tab;
    if (["matrix", "report", "chat", "insights"].includes(h)) setTab(h);
  }, []);

  const changeTab = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  const onCite = useCallback(
    (paperIndex: number, page: number | null) => {
      const p = project?.papers[paperIndex - 1];
      if (!p) return toast(`P${paperIndex} ?`, "error");
      if (!p.hasFile) return toast(`P${paperIndex}: ${p.title}${page ? ` · p.${page}` : ""}`, "info");
      setPdf({ paperId: p.id, page });
    },
    [project, toast],
  );

  const saveMeta = async (patch: { name?: string; question?: string }) => {
    if (!project) return;
    if ((patch.name ?? project.name) === project.name && (patch.question ?? project.question) === project.question) return;
    await api(`/api/projects/${id}`, "PATCH", patch);
    mutate();
  };

  if (error) return <div className="py-20 text-center text-muted">{error.message}</div>;
  if (!project) return <div className="flex justify-center py-32"><Spinner className="size-6" /></div>;

  const pdfPaper = pdf ? project.papers.find((p) => p.id === pdf.paperId) : null;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href="/projects" className="mb-1 inline-flex items-center gap-0.5 text-[13px] text-muted hover:text-[rgb(var(--fg))]">
            <ChevronLeft className="size-4" /> {d.nav.projects}
          </Link>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && saveMeta({ name: name.trim() })}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="block w-full rounded-lg bg-transparent text-[26px] font-bold tracking-tight outline-none focus:bg-[var(--hover)]"
          />
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onBlur={() => saveMeta({ question: question.trim() })}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            placeholder={d.projects.question}
            className="mt-0.5 block w-full rounded-lg bg-transparent text-sm text-muted outline-none placeholder:text-muted/60 focus:bg-[var(--hover)]"
          />
          <div className="mt-1 text-xs text-muted">
            {fmt(d.projects.papers, { n: project.papers.length })} · {project.dimensions.length} {d.ws.dims}
          </div>
        </div>
        <Segmented
          value={tab}
          onChange={changeTab}
          options={[
            { value: "matrix", label: d.ws.matrix, icon: <Table2 className="size-3.5" /> },
            { value: "report", label: d.ws.report, icon: <FileText className="size-3.5" /> },
            { value: "chat", label: d.ws.chat, icon: <MessageSquare className="size-3.5" /> },
            { value: "insights", label: d.ws.insights, icon: <BarChart3 className="size-3.5" /> },
          ]}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
          {tab === "matrix" && <MatrixView project={project} mutate={mutate} onOpenPdf={(paperId, page) => setPdf({ paperId, page })} />}
          {tab === "report" && <ReportView project={project} onCite={onCite} />}
          {tab === "chat" && <ChatView project={project} onCite={onCite} />}
          {tab === "insights" && <InsightsView project={project} />}
        </motion.div>
      </AnimatePresence>

      <PdfViewer paperId={pdf?.paperId ?? null} title={pdfPaper?.title} page={pdf?.page} onClose={() => setPdf(null)} />
    </div>
  );
}
