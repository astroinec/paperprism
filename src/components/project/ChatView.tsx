"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, ChevronDown, MessageSquare, Plus, Quote, Sparkles, Square, Trash2 } from "lucide-react";
import { Button, Empty, GlassPanel, IconButton, Select } from "@/components/glass";
import { useToast } from "@/components/glass/toast";
import { Markdown } from "@/components/common/Markdown";
import { api, fetcher, streamNdjson } from "@/lib/client/api";
import { usePrefs } from "@/lib/client/prefs";
import { cn } from "@/lib/shared/utils";
import type { Chat, ChatEvent, Message, ProjectDetail, Source } from "@/lib/shared/types";

function Sources({ sources, onOpen }: { sources: Source[]; onOpen: (s: Source) => void }) {
  const { d } = usePrefs();
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;
  return (
    <div className="mt-2">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-xs font-medium text-muted hover:text-[rgb(var(--fg))]">
        <Quote className="size-3" /> {d.chat.sources} ({sources.length})
        <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {sources.map((s, i) => (
                <button key={i} onClick={() => onOpen(s)} className="glass-thin rounded-xl p-2.5 text-left transition-transform hover:-translate-y-0.5">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-accent">
                    P{s.paperIndex} · p.{s.page}
                    <span className="truncate font-normal text-muted">{s.title}</span>
                  </div>
                  <div className="line-clamp-3 text-[11.5px] leading-relaxed text-muted">{s.text}</div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChatView({ project, onCite }: { project: ProjectDetail; onCite: (paperIndex: number, page: number | null) => void }) {
  const { d, prefs } = usePrefs();
  const toast = useToast();
  const { data: chats, mutate: mutateChats } = useSWR<Chat[]>(`/api/projects/${project.id}/chats`, fetcher);
  const [chatId, setChatId] = useState<string | null | undefined>(undefined);
  const { data: chat, mutate: mutateChat } = useSWR<Chat & { messages: Message[] }>(chatId ? `/api/chats/${chatId}` : null, fetcher);
  const [input, setInput] = useState("");
  const [scope, setScope] = useState("all");
  const [pending, setPending] = useState<{ question: string; answer: string; sources: Source[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatId === undefined && chats) setChatId(chats[0]?.id ?? null);
  }, [chats, chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat?.messages.length, pending?.answer]);

  const send = async (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || pending) return;
    let id = chatId;
    if (!id) {
      const c = await api<Chat>(`/api/projects/${project.id}/chats`, "POST", { title: question.slice(0, 40) });
      id = c.id;
      setChatId(id);
      mutateChats();
    }
    setInput("");
    setPending({ question, answer: "", sources: [] });
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamNdjson<ChatEvent>(
        `/api/chats/${id}/messages`,
        { question, lang: prefs.outputLang, paperIds: scope === "all" ? undefined : [scope] },
        (ev) => {
          if (ev.type === "sources") setPending((p) => (p ? { ...p, sources: ev.sources } : p));
          else if (ev.type === "delta") setPending((p) => (p ? { ...p, answer: p.answer + ev.text } : p));
          else if (ev.type === "error") toast(ev.message, "error");
        },
        ac.signal,
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast((e as Error).message, "error");
    } finally {
      await mutateChat();
      mutateChats();
      setPending(null);
    }
  };

  const openSource = (s: Source) => onCite(s.paperIndex, s.page);
  const messages = chatId ? (chat?.messages ?? []) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <GlassPanel className="h-fit p-3">
        <div className="relative z-[2]">
          <Button
            variant="tinted"
            className="mb-2 w-full"
            icon={<Plus className="size-4" />}
            onClick={() => {
              setChatId(null);
            }}
          >
            {d.chat.newChat}
          </Button>
          <div className="space-y-0.5">
            {chats?.map((c) => (
              <div
                key={c.id}
                onClick={() => setChatId(c.id)}
                className={cn(
                  "group flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] transition-colors",
                  chatId === c.id ? "bg-[var(--hover)] font-medium" : "hover:bg-[var(--hover)]",
                )}
              >
                <MessageSquare className="size-3.5 shrink-0 text-muted" />
                <span className="flex-1 truncate">{c.title}</span>
                <button
                  className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-[#ff3b30]"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await api(`/api/chats/${c.id}`, "DELETE");
                    if (chatId === c.id) setChatId(null);
                    mutateChats();
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </GlassPanel>

      <GlassPanel variant="thick" className="flex h-[calc(100vh-200px)] min-h-[520px] flex-col p-0">
        <div className="scroll-thin relative z-[2] flex-1 overflow-y-auto px-5 py-5 md:px-8">
          {!messages.length && !pending ? (
            <div className="flex h-full flex-col items-center justify-center">
              <Empty icon={<Sparkles />} title={d.chat.empty} sub={d.chat.emptySub} className="py-6" />
              <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {d.chat.suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="glass-thin rounded-2xl px-4 py-3 text-left text-[13px] transition-all hover:-translate-y-0.5">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((m) => (
                <MessageBubble key={m.id} role={m.role} content={m.content} sources={m.sources} onCite={onCite} onOpen={openSource} />
              ))}
              {pending && (
                <>
                  <MessageBubble role="user" content={pending.question} sources={[]} onCite={onCite} onOpen={openSource} />
                  <MessageBubble role="assistant" content={pending.answer} sources={pending.sources} onCite={onCite} onOpen={openSource} streaming />
                </>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
        <div className="relative z-[2] border-t border-line p-3 md:px-6">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Select value={scope} onChange={(e) => setScope(e.target.value)} className="h-[42px] w-28 shrink-0 text-xs">
              <option value="all">{d.chat.allPapers}</option>
              {project.papers.map((p, i) => (
                <option key={p.id} value={p.id}>
                  P{i + 1}
                </option>
              ))}
            </Select>
            <div className="glass-thin flex flex-1 items-end rounded-2xl pr-1.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={d.chat.placeholder}
                className="scroll-thin max-h-40 min-h-[42px] flex-1 resize-none bg-transparent px-4 py-2.5 text-sm outline-none"
                style={{ fieldSizing: "content" } as React.CSSProperties}
              />
              {pending ? (
                <IconButton onClick={() => abortRef.current?.abort()} className="mb-1.5 rounded-full bg-[#ff3b30] text-white hover:bg-[#ff3b30] hover:text-white">
                  <Square className="size-3.5" />
                </IconButton>
              ) : (
                <IconButton
                  onClick={() => send()}
                  disabled={!input.trim()}
                  className="mb-1.5 rounded-full bg-accent text-white hover:bg-accent hover:text-white disabled:bg-[rgb(var(--fg-muted))]/30"
                >
                  <ArrowUp className="size-4" />
                </IconButton>
              )}
            </div>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  sources,
  onCite,
  onOpen,
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  sources: Source[];
  onCite: (i: number, p: number | null) => void;
  onOpen: (s: Source) => void;
  streaming?: boolean;
}) {
  if (role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
        <div className="max-w-[80%] rounded-[20px] rounded-br-md bg-gradient-to-b from-accent-hi to-accent px-4 py-2.5 text-sm whitespace-pre-wrap text-white shadow-[0_6px_16px_-8px_color-mix(in_srgb,var(--accent)_80%,transparent)]">
          {content}
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5ac8fa] via-accent-2 to-[#ff2d92] text-white shadow-md">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {streaming && !content ? (
          <div className="flex gap-1 pt-2">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="size-2 rounded-full bg-accent/60" animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.12 }} />
            ))}
          </div>
        ) : (
          <Markdown text={content} onCite={onCite} streaming={streaming} />
        )}
        <Sources sources={sources} onOpen={onOpen} />
      </div>
    </motion.div>
  );
}
