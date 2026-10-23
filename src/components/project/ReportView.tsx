"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Check, Clock, Download, FileText, Loader2, Pencil, Eye, Sparkles, Square, Trash2 } from "lucide-react";
import { Badge, Button, Empty, GlassPanel, IconButton, Segmented, Select, Textarea } from "@/components/glass";
import { Menu } from "@/components/glass/menu";
import { useToast } from "@/components/glass/toast";
import { useConfirm } from "@/components/glass/confirm";
import { Markdown } from "@/components/common/Markdown";
import { api, downloadUrl, fetcher, streamNdjson, timeAgo } from "@/lib/client/api";
import { fmt, usePrefs, type Lang } from "@/lib/client/prefs";
import { cn } from "@/lib/shared/utils";
import type { OutlineSection, ProjectDetail, Report, ReportEvent, ReportStyle } from "@/lib/shared/types";

export function ReportView({ project, onCite }: { project: ProjectDetail; onCite: (paperIndex: number, page: number | null) => void }) {
  const { d, prefs, lang } = usePrefs();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: reports, mutate } = useSWR<Report[]>(`/api/projects/${project.id}/reports`, fetcher);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [style, setStyle] = useState<ReportStyle>("academic");
  const [outLang, setOutLang] = useState<Lang>(prefs.outputLang);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<{ step: string; section?: number } | null>(null);
  const [outline, setOutline] = useState<OutlineSection[]>([]);
  const [live, setLive] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const current = running ? null : (reports?.find((r) => r.id === currentId) ?? reports?.[0] ?? null);
  const doneCells = project.cells.filter((c) => c.status === "done").length;

  useEffect(() => setOutLang(prefs.outputLang), [prefs.outputLang]);
  useEffect(() => {
    setEditing(false);
  }, [current?.id]);

  const generate = async () => {
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true);
    setLive("");
    setOutline([]);
    setWarnings([]);
    setStep({ step: "plan" });
    let newId: string | null = null;
    try {
      await streamNdjson<ReportEvent>(
        `/api/projects/${project.id}/reports`,
        { style, lang: outLang },
        (ev) => {
          if (ev.type === "step") setStep({ step: ev.step, section: ev.section });
          else if (ev.type === "outline") setOutline(ev.sections);
          else if (ev.type === "delta") setLive((s) => s + ev.text);
          else if (ev.type === "done") {
            newId = ev.reportId;
            setWarnings(ev.warnings);
          } else if (ev.type === "error") toast(ev.message, "error");
        },
        ac.signal,
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast((e as Error).message, "error");
    } finally {
      setRunning(false);
      setStep(null);
      await mutate();
      if (newId) setCurrentId(newId);
    }
  };

  const content = running ? live : (current?.content ?? "");
  const showOutline = running ? outline : (current?.outline ?? []);

  const stepLabel = (s: { step: string; section?: number }) =>
    s.step === "plan" ? d.report.steps.plan : s.step === "review" ? d.report.steps.review : fmt(d.report.steps.draft, { n: (s.section ?? 0) + 1 });

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <div className="space-y-4">
        <GlassPanel className="p-4">
          <div className="relative z-[2] space-y-3">
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted">{d.report.style}</div>
              <div className="space-y-1">
                {(["academic", "brief", "related_work"] as ReportStyle[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition-colors",
                      style === s ? "bg-accent/12 font-semibold text-accent" : "hover:bg-[var(--hover)]",
                    )}
                  >
                    {d.report.styles[s]}
                    {style === s && <Check className="size-3.5" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold text-muted">{d.report.lang}</div>
              <Select value={outLang} onChange={(e) => setOutLang(e.target.value as Lang)}>
                <option value="zh">中文</option>
                <option value="en">English</option>
              </Select>
            </div>
            {running ? (
              <Button variant="danger" className="w-full" icon={<Square className="size-3.5" />} onClick={() => abortRef.current?.abort()}>
                {d.common.stop}
              </Button>
            ) : (
              <Button variant="primary" className="w-full" icon={<Sparkles className="size-4" />} onClick={generate} disabled={!project.papers.length}>
                {reports?.length ? d.report.regenerate : d.report.generate}
              </Button>
            )}
            {doneCells === 0 && <p className="text-xs leading-relaxed text-[#b86e00] dark:text-[#ffc15a]">{d.report.needMatrix}</p>}
          </div>
        </GlassPanel>

        <AnimatePresence>
          {showOutline.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <GlassPanel className="p-4">
                <div className="relative z-[2]">
                  <div className="mb-2 text-xs font-semibold text-muted">{d.report.outline}</div>
                  <ol className="space-y-1">
                    {showOutline.map((s, i) => {
                      const active = running && step?.step === "draft" && step.section === i;
                      const done = running && step?.step === "draft" && (step.section ?? 0) > i;
                      return (
                        <li key={i} className={cn("flex items-start gap-2 rounded-lg px-2 py-1.5 text-[13px]", active && "bg-accent/10")}>
                          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                            {active ? (
                              <Loader2 className="size-3.5 animate-spin text-accent" />
                            ) : done || !running ? (
                              <span className="text-[11px] font-semibold text-muted tabular">{i + 1}</span>
                            ) : (
                              <span className="size-1.5 rounded-full bg-[rgb(var(--fg-muted))]/40" />
                            )}
                          </span>
                          <span className={cn(active && "font-semibold text-accent")}>{s.title}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </GlassPanel>
            </motion.div>
          )}
        </AnimatePresence>

        {!!reports?.length && (
          <GlassPanel className="p-4">
            <div className="relative z-[2]">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Clock className="size-3.5" /> {d.report.history}
              </div>
              <div className="space-y-1">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "group flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[12.5px] transition-colors",
                      current?.id === r.id ? "bg-[var(--hover)] font-medium" : "hover:bg-[var(--hover)]",
                    )}
                    onClick={() => setCurrentId(r.id)}
                  >
                    <FileText className="size-3.5 shrink-0 text-muted" />
                    <span className="flex-1 truncate">
                      {d.report.styles[r.style]} · {timeAgo(r.createdAt, lang)}
                    </span>
                    <button
                      className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-[#ff3b30]"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!(await confirm(d.common.confirmDelete, { danger: true }))) return;
                        await api(`/api/reports/${r.id}`, "DELETE");
                        if (currentId === r.id) setCurrentId(null);
                        mutate();
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </GlassPanel>
        )}
      </div>

      {/* Main */}
      <GlassPanel variant="thick" running={running} className="min-h-[60vh] p-0">
        <div className="relative z-[2]">
          {(running || current) && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-6 py-3">
              {running && step ? (
                <Badge color="blue" className="h-7 px-3">
                  <Loader2 className="size-3 animate-spin" /> {stepLabel(step)}
                </Badge>
              ) : current ? (
                <>
                  <Badge>{d.report.styles[current.style]}</Badge>
                  {current.model && <Badge>{current.model}</Badge>}
                  {warnings.length > 0 && (
                    <Badge color="orange" title={warnings.join(" ")}>
                      <AlertTriangle className="size-3" /> {fmt(d.report.warnings, { n: warnings.length })}
                    </Badge>
                  )}
                </>
              ) : null}
              <div className="flex-1" />
              {current && !running && (
                <>
                  <Segmented
                    size="sm"
                    value={editing ? "edit" : "preview"}
                    onChange={(v) => {
                      if (v === "edit") setDraft(current.content);
                      setEditing(v === "edit");
                    }}
                    options={[
                      { value: "preview", label: d.report.previewMode, icon: <Eye className="size-3" /> },
                      { value: "edit", label: d.report.editMode, icon: <Pencil className="size-3" /> },
                    ]}
                  />
                  <Menu
                    trigger={() => (
                      <IconButton>
                        <Download className="size-4" />
                      </IconButton>
                    )}
                    items={[
                      { label: d.report.exportMd, onClick: () => downloadUrl(`/api/reports/${current.id}/export?format=md`) },
                      { label: d.report.exportDocx, onClick: () => downloadUrl(`/api/reports/${current.id}/export?format=docx`) },
                    ]}
                  />
                </>
              )}
            </div>
          )}

          {!running && !current ? (
            <Empty icon={<FileText />} title={d.report.empty} sub={d.report.emptySub} className="py-28" />
          ) : editing && current ? (
            <div className="space-y-3 p-6">
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[60vh] font-mono text-[13px] leading-relaxed" />
              <div className="flex justify-end gap-2">
                <Button onClick={() => setEditing(false)}>{d.common.cancel}</Button>
                <Button
                  variant="primary"
                  onClick={async () => {
                    await api(`/api/reports/${current.id}`, "PATCH", { content: draft });
                    await mutate();
                    setEditing(false);
                    toast(d.common.saved, "success");
                  }}
                >
                  {d.common.save}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl px-6 py-6 md:px-10">
              {running && !content && (
                <div className="space-y-3 py-6">
                  {[90, 75, 82, 60].map((w, i) => (
                    <div key={i} className="shimmer h-4 rounded-md" style={{ width: `${w}%` }} />
                  ))}
                </div>
              )}
              <Markdown text={content} onCite={onCite} streaming={running} />
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}
