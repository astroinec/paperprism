"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";
import { Button, Field, Input, Textarea } from "@/components/glass";
import { Modal } from "@/components/glass/overlay";
import { useToast } from "@/components/glass/toast";
import { usePapers } from "@/lib/client/hooks";
import { api } from "@/lib/client/api";
import { usePrefs } from "@/lib/client/prefs";
import { TEMPLATES } from "@/lib/shared/templates";
import { cn, formatAuthors } from "@/lib/shared/utils";
import type { Project } from "@/lib/shared/types";

export function NewProjectModal({ open, onClose, initialPapers = [] }: { open: boolean; onClose: () => void; initialPapers?: string[] }) {
  const { d, lang } = usePrefs();
  const toast = useToast();
  const router = useRouter();
  const { data: papers } = usePapers();
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [template, setTemplate] = useState("general");
  const [selected, setSelected] = useState<string[]>(initialPapers);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setSelected(initialPapers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPapers.join(",")]);

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return (papers ?? []).filter((p) => !s || p.title.toLowerCase().includes(s) || p.authors.join(" ").toLowerCase().includes(s));
  }, [papers, q]);

  const create = async () => {
    if (!name.trim()) return toast(d.projects.name, "error");
    setBusy(true);
    try {
      const p = await api<Project>("/api/projects", "POST", { name, question, template, paperIds: selected, lang });
      onClose();
      router.push(`/projects/${p.id}`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={d.projects.new}
      width="max-w-3xl"
      footer={
        <>
          <Button onClick={onClose}>{d.common.cancel}</Button>
          <Button variant="primary" loading={busy} onClick={create}>
            {d.common.create}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 pb-2 md:grid-cols-2">
        <div className="space-y-4">
          <Field label={d.projects.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={d.projects.namePh} autoFocus />
          </Field>
          <Field label={d.projects.question}>
            <Textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={d.projects.questionPh} />
          </Field>
          <Field label={d.projects.template}>
            <div className="grid grid-cols-1 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTemplate(t.key)}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border p-3 text-left transition-all",
                    template === t.key ? "border-accent bg-accent/8" : "border-line hover:bg-[var(--hover)]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                      template === t.key ? "border-accent bg-accent" : "border-[rgb(var(--fg-muted))]/40",
                    )}
                  >
                    {template === t.key && <span className="size-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold">{t.name[lang]}</span>
                    <span className="block text-xs text-muted">
                      {t.description[lang]}
                      {t.dimensions.length > 0 && ` · ${t.dimensions.map((x) => x.name[lang]).slice(0, 4).join(" / ")}…`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Field>
        </div>
        <Field label={`${d.projects.pickPapers} (${selected.length})`} hint={d.projects.pickHint}>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={d.library.filter} className="pl-9" />
          </div>
          <div className="scroll-thin mt-2 max-h-[380px] space-y-1 overflow-y-auto rounded-2xl border border-line p-1.5">
            {papers?.length === 0 && <div className="p-6 text-center text-[13px] text-muted">{d.projects.noPapers}</div>}
            {list.map((p) => {
              const on = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                  className={cn("flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition-colors", on ? "bg-accent/10" : "hover:bg-[var(--hover)]")}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                      on ? "border-accent bg-accent text-white" : "border-[rgb(var(--fg-muted))]/40",
                    )}
                  >
                    {on && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[13px] leading-snug font-medium">{p.title}</span>
                    <span className="line-clamp-1 text-[11px] text-muted">
                      {formatAuthors(p.authors, 2)}
                      {p.year ? ` · ${p.year}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
