"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Download, Layers, Library as LibraryIcon, Search, X } from "lucide-react";
import { Button, Empty, Input, SectionTitle, Spinner } from "@/components/glass";
import { ImportPanel } from "@/components/library/ImportPanel";
import { PaperCard } from "@/components/library/PaperCard";
import { PaperDrawer } from "@/components/library/PaperDrawer";
import { PdfViewer } from "@/components/common/PdfViewer";
import { usePapers } from "@/lib/client/hooks";
import { downloadUrl } from "@/lib/client/api";
import { fmt, usePrefs } from "@/lib/client/prefs";
import type { Paper } from "@/lib/shared/types";

export default function LibraryPage() {
  const { d } = usePrefs();
  const router = useRouter();
  const { data: papers, mutate, isLoading } = usePapers();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pdf, setPdf] = useState<Paper | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return papers ?? [];
    return (papers ?? []).filter((p) =>
      [p.title, p.authors.join(" "), p.venue ?? "", p.tags.join(" "), p.arxivId ?? ""].join(" ").toLowerCase().includes(s),
    );
  }, [papers, q]);

  const open = papers?.find((p) => p.id === openId) ?? null;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div>
      <SectionTitle
        title={d.library.title}
        sub={d.library.sub}
        actions={
          <Button icon={<Download className="size-4" />} onClick={() => downloadUrl(`/api/export/bibtex${selected.length ? `?ids=${selected.join(",")}` : ""}`)}>
            {d.library.exportBib}
          </Button>
        }
      />
      <ImportPanel onImported={() => mutate()} />

      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[15px] font-semibold">
          {fmt(d.library.count, { n: papers?.length ?? 0 })}
          {isLoading && <Spinner className="ml-2 inline" />}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={d.library.filter} className="rounded-full pl-9" />
        </div>
      </div>

      {papers && papers.length === 0 ? (
        <Empty icon={<LibraryIcon />} title={d.library.empty} sub={d.library.emptySub} />
      ) : (
        <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <AnimatePresence>
            {filtered.map((p, i) => (
              <PaperCard key={p.id} paper={p} index={i} selected={selected.includes(p.id)} onSelect={() => toggle(p.id)} onOpen={() => setOpenId(p.id)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="glass-thick fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full py-2 pr-2 pl-5"
          >
            <span className="relative z-[2] text-[13px] font-medium">{fmt(d.library.selected, { n: selected.length })}</span>
            <Button size="sm" variant="ghost" className="relative z-[2] rounded-full" onClick={() => setSelected([])} icon={<X className="size-3.5" />} />
            <Button
              size="sm"
              variant="primary"
              className="relative z-[2] rounded-full"
              icon={<Layers className="size-3.5" />}
              onClick={() => router.push(`/projects?new=1&papers=${selected.join(",")}`)}
            >
              {d.library.compareSelected}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <PaperDrawer paper={open} onClose={() => setOpenId(null)} onChanged={() => mutate()} onViewPdf={(p) => setPdf(p)} />
      <PdfViewer paperId={pdf?.id ?? null} title={pdf?.title} onClose={() => setPdf(null)} />
    </div>
  );
}
