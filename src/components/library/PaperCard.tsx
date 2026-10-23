"use client";

import { motion } from "motion/react";
import { AlertTriangle, Check, CheckCircle2, FileText, XCircle } from "lucide-react";
import { Badge, GlassPanel } from "@/components/glass";
import { fmt, usePrefs } from "@/lib/client/prefs";
import { cn, formatAuthors } from "@/lib/shared/utils";
import type { Paper, PaperStatus } from "@/lib/shared/types";

export function StatusBadge({ status }: { status: PaperStatus }) {
  const { d } = usePrefs();
  if (status === "ready")
    return (
      <Badge color="green">
        <CheckCircle2 className="size-3" />
        {d.library.status.ready}
      </Badge>
    );
  if (status === "no_text")
    return (
      <Badge color="orange">
        <AlertTriangle className="size-3" />
        {d.library.status.no_text}
      </Badge>
    );
  return (
    <Badge color="red">
      <XCircle className="size-3" />
      {d.library.status[status]}
    </Badge>
  );
}

const GRADS = [
  "from-[#5ac8fa] to-accent",
  "from-[#bf5af2] to-accent-2",
  "from-[#ff6482] to-[#ff2d55]",
  "from-[#30d158] to-[#00c7be]",
  "from-[#ffd60a] to-[#ff9f0a]",
  "from-[#64d2ff] to-accent-2",
];

export function paperGradient(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADS[h % GRADS.length];
}

export function PaperCard({
  paper,
  selected,
  onSelect,
  onOpen,
  index,
}: {
  paper: Paper;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  index: number;
}) {
  const { d } = usePrefs();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index, 12) * 0.02, type: "spring", stiffness: 300, damping: 28 }}
    >
      <GlassPanel
        spotlight
        onClick={onOpen}
        className={cn(
          "group h-full cursor-pointer p-4 transition-all duration-300 hover:-translate-y-0.5",
          selected && "ring-2 ring-accent/70 ring-offset-0",
        )}
      >
        <div className="relative z-[2] flex h-full flex-col">
          <div className="mb-3 flex items-start gap-3">
            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br text-white shadow-md", paperGradient(paper.id))}>
              <FileText className="size-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-[14px] leading-snug font-semibold">{paper.title}</div>
              <div className="mt-0.5 line-clamp-1 text-xs text-muted">
                {formatAuthors(paper.authors, 2) || "—"}
                {paper.year ? ` · ${paper.year}` : ""}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                selected ? "border-accent bg-accent text-white" : "border-[rgb(var(--fg-muted))]/40 opacity-60 group-hover:opacity-100",
              )}
            >
              {selected && <Check className="size-3.5" strokeWidth={3} />}
            </button>
          </div>
          <p className="mb-3 line-clamp-3 flex-1 text-xs leading-relaxed text-muted">{paper.abstract || d.library.noAbstract}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={paper.status} />
            <Badge>{d.library.source[paper.source]}</Badge>
            {paper.numPages > 0 && <Badge>{fmt(d.library.pages, { n: paper.numPages })}</Badge>}
            {paper.tags.slice(0, 2).map((t) => (
              <Badge key={t} color="blue">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
