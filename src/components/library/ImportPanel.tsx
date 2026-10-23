"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpen, Check, ClipboardPaste, FileUp, Link2, Loader2, Plus, Search, Telescope } from "lucide-react";
import { Badge, Button, GlassPanel, Input, Segmented, Textarea } from "@/components/glass";
import { useToast } from "@/components/glass/toast";
import { api } from "@/lib/client/api";
import { fmt, usePrefs } from "@/lib/client/prefs";
import { cn, formatAuthors } from "@/lib/shared/utils";
import type { Paper, SearchResult } from "@/lib/shared/types";

type Tab = "upload" | "arxiv" | "s2" | "url" | "text";

export function ImportPanel({ onImported }: { onImported: () => void }) {
  const { d } = usePrefs();
  const [tab, setTab] = useState<Tab>("upload");
  return (
    <GlassPanel variant="thick" className="p-5">
      <div className="relative z-[2]">
        <Segmented
          value={tab}
          onChange={setTab}
          className="mb-4 max-w-full overflow-x-auto"
          options={[
            { value: "upload", label: d.library.tabUpload, icon: <FileUp className="size-3.5" /> },
            { value: "arxiv", label: d.library.tabArxiv, icon: <Telescope className="size-3.5" /> },
            { value: "s2", label: d.library.tabS2, icon: <BookOpen className="size-3.5" /> },
            { value: "url", label: d.library.tabUrl, icon: <Link2 className="size-3.5" /> },
            { value: "text", label: d.library.tabText, icon: <ClipboardPaste className="size-3.5" /> },
          ]}
        />
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            {tab === "upload" && <UploadTab onImported={onImported} />}
            {(tab === "arxiv" || tab === "s2") && <SearchTab key={tab} source={tab} onImported={onImported} />}
            {tab === "url" && <UrlTab onImported={onImported} />}
            {tab === "text" && <TextTab onImported={onImported} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </GlassPanel>
  );
}

function UploadTab({ onImported }: { onImported: () => void }) {
  const { d } = usePrefs();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string[]>([]);

  const upload = async (files: File[]) => {
    const pdfs = files.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) return;
    setBusy(pdfs.map((f) => f.name));
    // upload sequentially in small groups so progress is visible
    for (const f of pdfs) {
      const fd = new FormData();
      fd.append("files", f);
      try {
        const res = await api<{ results: { name: string; paper?: Paper; error?: string }[] }>("/api/papers", "POST", fd);
        for (const r of res.results) {
          if (r.error) toast(`${r.name}: ${r.error}`, "error");
          else if (r.paper?.status === "no_text") toast(`${r.paper.title}: ${d.library.status.no_text}`, "info");
          else toast(`${d.library.imported}: ${r.paper?.title}`, "success");
        }
      } catch (e) {
        toast(`${f.name}: ${(e as Error).message}`, "error");
      }
      setBusy((b) => b.filter((n) => n !== f.name));
      onImported();
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        upload([...e.dataTransfer.files]);
      }}
      onClick={() => input.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition-all",
        over ? "scale-[1.01] border-accent bg-accent/8" : "border-[var(--line)] hover:border-accent/40 hover:bg-[var(--hover)]",
      )}
    >
      <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => upload([...(e.target.files ?? [])])} />
      <motion.div
        animate={over ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }}
        className="mb-3 flex size-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-accent-hi to-accent text-white shadow-[0_10px_24px_-8px_color-mix(in_srgb,var(--accent)_70%,transparent)]"
      >
        <FileUp className="size-6" />
      </motion.div>
      <div className="text-[15px] font-semibold">{d.library.drop}</div>
      <div className="mt-1 text-xs text-muted">{d.library.dropHint}</div>
      {busy.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          {busy.map((n) => (
            <Badge key={n} color="blue">
              <Loader2 className="size-3 animate-spin" /> {d.library.uploading} · {n}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchTab({ source, onImported }: { source: "arxiv" | "s2"; onImported: () => void }) {
  const { d } = usePrefs();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [state, setState] = useState<Record<string, "loading" | "done">>({});

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      setResults(await api<SearchResult[]>(`/api/search/${source}?q=${encodeURIComponent(q)}`));
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  };

  const add = async (r: SearchResult) => {
    setState((s) => ({ ...s, [r.externalId]: "loading" }));
    try {
      const res = await api<{ paper: Paper; warning?: string }>("/api/papers/import", "POST", { kind: "search", result: r });
      if (res.warning === "already_exists") toast(d.library.exists, "info");
      else if (res.warning) toast(`${res.paper.title}: ${d.library.abstractOnly}`, "info");
      else toast(`${d.library.imported}: ${res.paper.title}`, "success");
      setState((s) => ({ ...s, [r.externalId]: "done" }));
      onImported();
    } catch (e) {
      toast((e as Error).message, "error");
      setState((s) => {
        const n = { ...s };
        delete n[r.externalId];
        return n;
      });
    }
  };

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={source === "arxiv" ? d.library.searchArxiv : d.library.searchS2} className="pl-9" autoFocus />
        </div>
        <Button variant="primary" loading={loading} type="submit">
          {d.common.search}
        </Button>
      </form>
      {results && (
        <div className="scroll-thin mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {results.length === 0 && <div className="py-8 text-center text-sm text-muted">{d.common.empty}</div>}
          {results.map((r, i) => (
            <motion.div
              key={r.externalId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025 }}
              className="glass-thin flex gap-3 rounded-2xl p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm leading-snug font-semibold">{r.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span>{formatAuthors(r.authors)}</span>
                  {r.year && <span>· {r.year}</span>}
                  {r.venue && <span className="line-clamp-1">· {r.venue}</span>}
                  {r.citationCount != null && <Badge>{fmt(d.library.citations, { n: r.citationCount })}</Badge>}
                  {r.pdfUrl ? <Badge color="green">PDF</Badge> : <Badge color="orange">{d.library.abstract}</Badge>}
                </div>
                {r.abstract && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{r.abstract}</p>}
              </div>
              <Button
                size="sm"
                variant={state[r.externalId] === "done" ? "secondary" : "tinted"}
                loading={state[r.externalId] === "loading"}
                disabled={state[r.externalId] === "done"}
                icon={state[r.externalId] === "done" ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                onClick={() => add(r)}
                className="self-center"
              >
                {state[r.externalId] === "done" ? d.library.imported : d.library.importBtn}
              </Button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function UrlTab({ onImported }: { onImported: () => void }) {
  const { d } = usePrefs();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setBusy(true);
    const failed: string[] = [];
    for (const url of lines) {
      try {
        const res = await api<{ paper: Paper; warning?: string }>("/api/papers/import", "POST", { kind: "url", url });
        if (res.warning === "already_exists") toast(d.library.exists, "info");
        else toast(`${d.library.imported}: ${res.paper.title}`, res.warning ? "info" : "success");
        onImported();
      } catch (e) {
        failed.push(url);
        toast(`${url}: ${(e as Error).message}`, "error");
      }
    }
    setText(failed.join("\n"));
    setBusy(false);
  };
  return (
    <div className="space-y-3">
      <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={d.library.urlPlaceholder} className="font-mono text-[13px]" />
      <div className="flex justify-end">
        <Button variant="primary" loading={busy} onClick={run}>
          {busy ? d.library.importing : d.library.importBtn}
        </Button>
      </div>
    </div>
  );
}

function TextTab({ onImported }: { onImported: () => void }) {
  const { d } = usePrefs();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const res = await api<{ paper: Paper }>("/api/papers/import", "POST", { kind: "text", title, text });
      toast(`${d.library.imported}: ${res.paper.title}`, "success");
      setTitle("");
      setText("");
      onImported();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={d.library.textTitle} />
      <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={d.library.textBody} />
      <div className="flex justify-end">
        <Button variant="primary" loading={busy} onClick={run}>
          {d.library.importBtn}
        </Button>
      </div>
    </div>
  );
}
