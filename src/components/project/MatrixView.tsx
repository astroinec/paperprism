"use client";

import { useCallback, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Download,
  FileSpreadsheet,
  Lightbulb,
  ListPlus,
  Play,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Square,
} from "lucide-react";
import type { KeyedMutator } from "swr";
import { Badge, Button, Empty, GlassPanel, IconButton } from "@/components/glass";
import { Menu } from "@/components/glass/menu";
import { useToast } from "@/components/glass/toast";
import { api, downloadUrl } from "@/lib/client/api";
import { useServerSettings } from "@/lib/client/hooks";
import { fmt, usePrefs } from "@/lib/client/prefs";
import { cn } from "@/lib/shared/utils";
import type { Cell, Dimension, Paper, ProjectDetail } from "@/lib/shared/types";
import { paperGradient } from "@/components/library/PaperCard";
import { CellDrawer } from "./CellDrawer";
import { DimensionEditor } from "./DimensionEditor";
import { ManagePapersModal } from "./ManagePapersModal";
import { useExtraction } from "./useExtraction";

const STICKY = "bg-[rgb(var(--glass-tint)/0.82)] backdrop-blur-xl";

function RatingDots({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={cn("size-2 rounded-full", i <= n ? "bg-accent" : "bg-[rgb(var(--fg-muted))]/20")} />
      ))}
    </span>
  );
}

function MatrixCell({ cell, dim, running, onClick }: { cell?: Cell; dim: Dimension; running: boolean; onClick: () => void }) {
  const { d } = usePrefs();
  return (
    <button onClick={onClick} className="group/cell relative block h-full w-full rounded-xl p-2.5 text-left transition-colors hover:bg-[var(--hover)]">
      {running ? (
        <div className="space-y-1.5">
          <div className="shimmer h-3 w-11/12 rounded-md" />
          <div className="shimmer h-3 w-8/12 rounded-md" />
          <div className="shimmer h-3 w-5/12 rounded-md" />
        </div>
      ) : !cell ? (
        <span className="text-[13px] text-muted/60">—</span>
      ) : cell.status === "error" ? (
        <span className="flex items-center gap-1.5 text-xs text-[#ff3b30]">
          <CircleAlert className="size-3.5" />
          <span className="line-clamp-2">{d.ws.cell.error}</span>
        </span>
      ) : (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {dim.type === "rating" && cell.numeric != null && (
            <div className="mb-1">
              <RatingDots n={cell.numeric} />
            </div>
          )}
          {dim.type === "number" && cell.numeric != null && cell.source !== "not_found" && (
            <div className="mb-0.5 text-lg leading-tight font-semibold tracking-tight text-accent tabular">{cell.numeric.toLocaleString()}</div>
          )}
          <div className={cn("line-clamp-4 text-[13px] leading-relaxed", cell.source === "not_found" && "text-muted italic")}>{cell.value}</div>
          <div className="mt-1.5 flex items-center gap-1.5 opacity-80 transition-opacity group-hover/cell:opacity-100">
            {cell.page && <span className="rounded-md bg-[var(--hover)] px-1.5 py-px text-[10px] font-medium text-muted tabular">p.{cell.page}</span>}
            {cell.verified && <CheckCircle2 className="size-3 text-[#34c759]" />}
            {cell.source === "inferred" && <span className="size-1.5 rounded-full bg-[#bf5af2]" title={d.ws.cell.inferred} />}
            {cell.confidence === "low" && <span className="size-1.5 rounded-full bg-[#ff9f0a]" title={d.ws.cell.low} />}
            {cell.edited && <span className="text-[10px] text-[#ff9f0a]">✎</span>}
          </div>
        </motion.div>
      )}
    </button>
  );
}

function PaperHead({ paper, index, onOpen }: { paper: Paper; index: number; onOpen: () => void }) {
  return (
    <div className="flex items-start gap-2.5 p-2.5">
      <span className={cn("mt-0.5 flex h-6 min-w-8 items-center justify-center rounded-lg bg-gradient-to-br px-1.5 text-[11px] font-bold text-white shadow-sm", paperGradient(paper.id))}>
        P{index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-3 text-[13px] leading-snug font-semibold">{paper.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
          {paper.year ?? ""}
          {paper.hasFile && (
            <button onClick={onOpen} className="inline-flex items-center gap-0.5 text-accent hover:underline">
              <BookOpen className="size-3" /> PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DimHead({ dim }: { dim: Dimension }) {
  const { d } = usePrefs();
  return (
    <div className="p-2.5">
      <div className="text-[13px] font-semibold">{dim.name}</div>
      <div className="mt-0.5 flex items-center gap-1">
        <span className="text-[10px] font-medium tracking-wide text-muted uppercase">{d.dims.types[dim.type]}</span>
      </div>
    </div>
  );
}

export function MatrixView({
  project,
  mutate,
  onOpenPdf,
}: {
  project: ProjectDetail;
  mutate: KeyedMutator<ProjectDetail>;
  onOpenPdf: (paperId: string, page: number | null) => void;
}) {
  const { d, prefs } = usePrefs();
  const toast = useToast();
  const { data: settings } = useServerSettings();
  const onError = useCallback((m: string) => toast(m, "error"), [toast]);
  const ex = useExtraction(project, mutate, settings?.concurrency ?? 3, prefs.outputLang, onError);
  const [transposed, setTransposed] = useState(false);
  const [dimOpen, setDimOpen] = useState(false);
  const [papersOpen, setPapersOpen] = useState(false);
  const [sel, setSel] = useState<{ paperId: string; dimId: string } | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const { papers, dimensions: dims, cells } = project;
  const cellOf = (pid: string, did: string) => cells.find((c) => c.paperId === pid && c.dimensionId === did);
  const doneCount = cells.filter((c) => c.status === "done").length;
  const total = papers.length * dims.length;
  const failed = cells.filter((c) => c.status === "error").length;
  const hasMissing = doneCount < total;

  const summarize = async () => {
    setSummarizing(true);
    try {
      await api(`/api/projects/${project.id}/summaries`, "POST", { lang: prefs.outputLang });
      await mutate();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSummarizing(false);
    }
  };

  const selPaper = sel ? papers.find((p) => p.id === sel.paperId) ?? null : null;
  const selDim = sel ? dims.find((x) => x.id === sel.dimId) ?? null : null;
  const selCell = sel ? cellOf(sel.paperId, sel.dimId) ?? null : null;

  const rowsA = transposed ? dims : papers;
  const colsB = transposed ? papers : dims;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {ex.running ? (
          <Button variant="danger" icon={<Square className="size-3.5" />} onClick={ex.stop}>
            {d.ws.stop}
          </Button>
        ) : (
          <div className="flex">
            <Button
              variant="primary"
              className="rounded-r-none"
              icon={<Play className="size-4" />}
              disabled={!papers.length || !dims.length}
              onClick={() => ex.run(hasMissing ? "missing" : "all")}
            >
              {hasMissing && doneCount > 0 ? d.ws.runMissing : d.ws.run}
            </Button>
            <Menu
              align="left"
              trigger={() => (
                <Button variant="primary" className="rounded-l-none border-l border-white/25 px-2" disabled={!papers.length || !dims.length}>
                  <ChevronDown className="size-4" />
                </Button>
              )}
              items={[
                { label: d.ws.runMissing, icon: <Play />, onClick: () => ex.run("missing") },
                { label: d.ws.rerunAll, icon: <RefreshCw />, onClick: () => ex.run("all") },
                { label: d.ws.retryFailed, icon: <RotateCcw />, onClick: () => ex.run("failed"), disabled: !failed },
              ]}
            />
          </div>
        )}
        {ex.progress && (
          <div className="glass-thin flex h-9 items-center gap-2.5 rounded-xl px-3">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[rgb(var(--fg-muted))]/15">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent to-[#bf5af2]"
                animate={{ width: `${(ex.progress.done / ex.progress.total) * 100}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <span className="text-xs font-medium text-muted tabular">{fmt(d.ws.progress, ex.progress)}</span>
          </div>
        )}
        <Button icon={<SlidersHorizontal className="size-4" />} onClick={() => setDimOpen(true)}>
          {d.ws.editDims}
        </Button>
        <Button icon={<ListPlus className="size-4" />} onClick={() => setPapersOpen(true)}>
          {d.ws.addPapers}
        </Button>
        <Button icon={<Lightbulb className="size-4" />} loading={summarizing} disabled={doneCount === 0 || ex.running} onClick={summarize}>
          {summarizing ? d.ws.summarizing : d.ws.summarize}
        </Button>
        <div className="flex-1" />
        <Badge color={failed ? "red" : "gray"} className="h-7 px-3 text-xs tabular">
          {doneCount}/{total}
          {failed ? ` · ${failed} ✕` : ""}
        </Badge>
        <IconButton title={d.ws.transpose} onClick={() => setTransposed((t) => !t)} active={transposed}>
          <ArrowLeftRight className="size-4" />
        </IconButton>
        <Menu
          trigger={() => (
            <Button icon={<Download className="size-4" />}>
              {d.common.export}
            </Button>
          )}
          items={[
            { label: d.ws.exportXlsx, icon: <FileSpreadsheet />, onClick: () => downloadUrl(`/api/projects/${project.id}/export?format=xlsx`) },
            { label: d.ws.exportCsv, icon: <FileSpreadsheet />, onClick: () => downloadUrl(`/api/projects/${project.id}/export?format=csv`) },
            { label: d.ws.exportMd, icon: <Download />, onClick: () => downloadUrl(`/api/projects/${project.id}/export?format=md`) },
            { divider: true, label: "" },
            { label: d.ws.exportBib, icon: <Download />, onClick: () => downloadUrl(`/api/export/bibtex?projectId=${project.id}`) },
          ]}
        />
      </div>

      {/* Table */}
      {!papers.length || !dims.length ? (
        <GlassPanel>
          <Empty
            icon={<SlidersHorizontal />}
            title={!papers.length ? d.ws.emptyPapers : d.ws.emptyDims}
            sub={!papers.length ? d.projects.pickHint : d.ws.emptyDimsSub}
            action={
              !papers.length ? (
                <Button variant="primary" icon={<ListPlus className="size-4" />} onClick={() => setPapersOpen(true)}>
                  {d.ws.addPapers}
                </Button>
              ) : (
                <Button variant="primary" icon={<SlidersHorizontal className="size-4" />} onClick={() => setDimOpen(true)}>
                  {d.ws.editDims}
                </Button>
              )
            }
          />
        </GlassPanel>
      ) : (
        <GlassPanel running={ex.running} className="overflow-hidden p-0">
          <div className="scroll-thin relative z-[2] max-h-[calc(100vh-250px)] overflow-auto">
            <table className="w-max min-w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={cn("sticky top-0 left-0 z-20 w-[240px] min-w-[240px] border-r border-b border-line text-left", STICKY)}>
                    <div className="p-2.5 text-[11px] font-semibold tracking-wide text-muted uppercase">{transposed ? d.ws.dims : d.ws.papers}</div>
                  </th>
                  {colsB.map((c, i) => (
                    <th key={c.id} className={cn("sticky top-0 z-10 w-[260px] min-w-[220px] border-b border-line text-left align-top font-normal", STICKY)}>
                      {transposed ? <PaperHead paper={c as Paper} index={i} onOpen={() => onOpenPdf(c.id, null)} /> : <DimHead dim={c as Dimension} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsA.map((r, ri) => (
                  <tr key={r.id} className="group/row">
                    <th className={cn("sticky left-0 z-10 border-r border-b border-line text-left align-top font-normal", STICKY)}>
                      {transposed ? (
                        <div>
                          <DimHead dim={r as Dimension} />
                          {(r as Dimension).summary && (
                            <div className="mx-2.5 mb-2.5 rounded-xl bg-[#ffd60a]/12 p-2 text-[11px] leading-relaxed text-[rgb(var(--fg))]/80">💡 {(r as Dimension).summary}</div>
                          )}
                        </div>
                      ) : (
                        <PaperHead paper={r as Paper} index={ri} onOpen={() => onOpenPdf(r.id, null)} />
                      )}
                    </th>
                    {colsB.map((c) => {
                      const paperId = transposed ? c.id : r.id;
                      const dimId = transposed ? r.id : c.id;
                      const dim = (transposed ? r : c) as Dimension;
                      return (
                        <td key={c.id} className="border-b border-line align-top transition-colors group-hover/row:bg-[var(--hover)]/40">
                          <MatrixCell
                            cell={cellOf(paperId, dimId)}
                            dim={dim}
                            running={ex.runningCells.has(`${paperId}:${dimId}`)}
                            onClick={() => setSel({ paperId, dimId })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!transposed && dims.some((x) => x.summary) && (
                  <tr>
                    <th className={cn("sticky left-0 z-10 border-r border-line text-left align-top font-normal", STICKY)}>
                      <div className="flex items-center gap-1.5 p-2.5 text-[12px] font-semibold text-[#b88600] dark:text-[#ffd60a]">
                        <Lightbulb className="size-3.5" /> {d.ws.insight}
                      </div>
                    </th>
                    {dims.map((x) => (
                      <td key={x.id} className="align-top">
                        {x.summary && <div className="m-2 rounded-xl bg-[#ffd60a]/12 p-2.5 text-[12px] leading-relaxed">{x.summary}</div>}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassPanel>
      )}

      <CellDrawer
        open={!!sel}
        paper={selPaper}
        paperIndex={selPaper ? papers.indexOf(selPaper) : 0}
        dim={selDim}
        cell={selCell}
        running={!!sel && ex.runningCells.has(`${sel.paperId}:${sel.dimId}`)}
        onClose={() => setSel(null)}
        onSave={async (value) => {
          if (!sel) return;
          const c = await api<Cell>(`/api/projects/${project.id}/cells`, "PATCH", { paperId: sel.paperId, dimensionId: sel.dimId, value });
          await mutate((p) => (p ? { ...p, cells: [...p.cells.filter((x) => !(x.paperId === c.paperId && x.dimensionId === c.dimensionId)), c] } : p), false);
          toast(d.common.saved, "success");
        }}
        onRegenerate={() => sel && ex.runOne(sel.paperId, [sel.dimId])}
        onOpenPdf={(page) => sel && onOpenPdf(sel.paperId, page)}
      />
      <DimensionEditor open={dimOpen} onClose={() => setDimOpen(false)} projectId={project.id} dimensions={dims} onSaved={() => mutate()} />
      <ManagePapersModal open={papersOpen} onClose={() => setPapersOpen(false)} project={project} onSaved={() => mutate()} />
    </div>
  );
}
