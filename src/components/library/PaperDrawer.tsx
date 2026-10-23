"use client";

import { useEffect, useState } from "react";
import { BookOpen, Trash2, X } from "lucide-react";
import { Badge, Button, Field, Input, Textarea } from "@/components/glass";
import { Drawer } from "@/components/glass/overlay";
import { useToast } from "@/components/glass/toast";
import { useConfirm } from "@/components/glass/confirm";
import { api } from "@/lib/client/api";
import { fmt, usePrefs } from "@/lib/client/prefs";
import type { Paper } from "@/lib/shared/types";
import { StatusBadge } from "./PaperCard";

export function PaperDrawer({
  paper,
  onClose,
  onChanged,
  onViewPdf,
}: {
  paper: Paper | null;
  onClose: () => void;
  onChanged: () => void;
  onViewPdf: (p: Paper) => void;
}) {
  const { d } = usePrefs();
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState({ title: "", authors: "", year: "", venue: "", doi: "", abstract: "" });
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!paper) return;
    setForm({
      title: paper.title,
      authors: paper.authors.join(", "),
      year: paper.year ? String(paper.year) : "",
      venue: paper.venue ?? "",
      doi: paper.doi ?? "",
      abstract: paper.abstract ?? "",
    });
    setTags(paper.tags);
  }, [paper]);

  if (!paper) return <Drawer open={false} onClose={onClose}>{null}</Drawer>;

  const save = async (patchTags?: string[]) => {
    setSaving(true);
    try {
      await api(`/api/papers/${paper.id}`, "PATCH", {
        title: form.title.trim(),
        authors: form.authors.split(/\s*[,;]\s*/).filter(Boolean),
        year: form.year ? Number(form.year) : null,
        venue: form.venue || null,
        doi: form.doi || null,
        abstract: form.abstract || null,
        tags: patchTags ?? tags,
      });
      toast(d.common.saved, "success");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirm(d.library.deleteConfirm, { danger: true }))) return;
    await api(`/api/papers/${paper.id}`, "DELETE");
    toast(d.common.deleted, "success");
    onChanged();
    onClose();
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return;
    const next = [...tags, t];
    setTags(next);
    setTagInput("");
    save(next);
  };

  return (
    <Drawer
      open={!!paper}
      onClose={onClose}
      width="w-[520px]"
      title={
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={paper.status} />
          <Badge>{d.library.source[paper.source]}</Badge>
          {paper.numPages > 0 && <Badge>{fmt(d.library.pages, { n: paper.numPages })}</Badge>}
          {paper.arxivId && <Badge color="purple">arXiv {paper.arxivId}</Badge>}
        </div>
      }
    >
      <div className="space-y-4">
        {paper.error && <div className="rounded-2xl bg-[#ff9f0a]/12 px-3.5 py-2.5 text-[13px] text-[#b86e00] dark:text-[#ffc15a]">{paper.error}</div>}
        <Field label={d.library.textTitle}>
          <Textarea rows={2} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="font-semibold" />
        </Field>
        <Field label={d.library.authors}>
          <Input value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} />
        </Field>
        <div className="grid grid-cols-[100px_1fr] gap-3">
          <Field label={d.common.year}>
            <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
          </Field>
          <Field label={d.library.venue}>
            <Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          </Field>
        </div>
        <Field label="DOI">
          <Input value={form.doi} onChange={(e) => setForm({ ...form, doi: e.target.value })} />
        </Field>
        <Field label={d.library.abstract}>
          <Textarea rows={8} value={form.abstract} onChange={(e) => setForm({ ...form, abstract: e.target.value })} className="text-[13px] leading-relaxed" />
        </Field>
        <Field label={d.library.tags}>
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <Badge key={t} color="blue" className="pr-1">
                {t}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    const next = tags.filter((x) => x !== t);
                    setTags(next);
                    save(next);
                  }}
                  className="rounded-full p-0.5 hover:bg-black/10"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder={d.library.addTag}
              className="min-w-[100px] flex-1 bg-transparent text-[13px] outline-none"
            />
          </div>
        </Field>
        <div className="flex items-center gap-2 pt-2">
          <Button variant="primary" loading={saving} onClick={() => save()}>
            {d.common.save}
          </Button>
          {paper.hasFile && (
            <Button icon={<BookOpen className="size-4" />} onClick={() => onViewPdf(paper)}>
              {d.library.viewPdf}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" className="text-[#ff3b30]" icon={<Trash2 className="size-4" />} onClick={remove}>
            {d.common.delete}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
