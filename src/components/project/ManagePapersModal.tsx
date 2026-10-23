"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button, Input } from "@/components/glass";
import { Modal } from "@/components/glass/overlay";
import { useToast } from "@/components/glass/toast";
import { usePapers } from "@/lib/client/hooks";
import { api } from "@/lib/client/api";
import { usePrefs } from "@/lib/client/prefs";
import { cn, formatAuthors } from "@/lib/shared/utils";
import type { ProjectDetail } from "@/lib/shared/types";

export function ManagePapersModal({ open, onClose, project, onSaved }: { open: boolean; onClose: () => void; project: ProjectDetail; onSaved: () => void }) {
  const { d } = usePrefs();
  const toast = useToast();
  const { data: papers } = usePapers();
  const [selected, setSelected] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setSelected(project.papers.map((p) => p.id));
  }, [open, project.papers]);

  const list = useMemo(() => {
    const s = q.toLowerCase();
    return (papers ?? []).filter((p) => !s || p.title.toLowerCase().includes(s));
  }, [papers, q]);

  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/projects/${project.id}/papers`, "PUT", { paperIds: selected });
      onSaved();
      onClose();
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
      title={`${d.ws.addPapers} (${selected.length})`}
      footer={
        <>
          <Button onClick={onClose}>{d.common.cancel}</Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {d.common.save}
          </Button>
        </>
      }
    >
      <div className="relative mb-2">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={d.library.filter} className="pl-9" />
      </div>
      <div className="space-y-1">
        {list.map((p) => {
          const on = selected.includes(p.id);
          const idx = selected.indexOf(p.id);
          return (
            <button
              key={p.id}
              onClick={() => setSelected((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
              className={cn("flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition-colors", on ? "bg-accent/10" : "hover:bg-[var(--hover)]")}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-md border-2 text-[10px] font-bold",
                  on ? "border-accent bg-accent text-white" : "border-[rgb(var(--fg-muted))]/40",
                )}
              >
                {on ? idx + 1 : <Check className="size-3 opacity-0" />}
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-[13px] font-medium">{p.title}</span>
                <span className="text-[11px] text-muted">
                  {formatAuthors(p.authors, 2)}
                  {p.year ? ` · ${p.year}` : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
