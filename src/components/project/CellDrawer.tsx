"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, CircleAlert, Pencil, RefreshCw, ShieldQuestion } from "lucide-react";
import { Badge, Button, Textarea } from "@/components/glass";
import { Drawer } from "@/components/glass/overlay";
import { fmt, usePrefs } from "@/lib/client/prefs";
import type { Cell, Dimension, Paper } from "@/lib/shared/types";

export function CellDrawer({
  open,
  paper,
  paperIndex,
  dim,
  cell,
  running,
  onClose,
  onSave,
  onRegenerate,
  onOpenPdf,
}: {
  open: boolean;
  paper: Paper | null;
  paperIndex: number;
  dim: Dimension | null;
  cell: Cell | null;
  running: boolean;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
  onRegenerate: () => void;
  onOpenPdf: (page: number | null) => void;
}) {
  const { d } = usePrefs();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(cell?.value ?? "");
    setEditing(false);
  }, [cell, open]);

  if (!paper || !dim) return <Drawer open={false} onClose={onClose}>{null}</Drawer>;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="w-[480px]"
      title={
        <div>
          <div className="text-xs font-medium text-muted">
            P{paperIndex + 1} · {paper.title}
          </div>
          <div className="mt-1 text-[17px] font-semibold tracking-tight">{dim.name}</div>
          {dim.description && <div className="mt-0.5 text-xs font-normal text-muted">{dim.description}</div>}
        </div>
      }
    >
      <div className="space-y-5">
        {cell?.status === "error" && (
          <div className="flex gap-2 rounded-2xl bg-[#ff3b30]/10 p-3 text-[13px] text-[#d42a20] dark:text-[#ff7a72]">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{cell.error || d.ws.cell.error}</span>
          </div>
        )}

        {cell?.status === "done" && (
          <div className="flex flex-wrap gap-1.5">
            {cell.source && <Badge color={cell.source === "stated" ? "green" : cell.source === "inferred" ? "purple" : "gray"}>{d.ws.cell[cell.source]}</Badge>}
            {cell.confidence && (
              <Badge color={cell.confidence === "high" ? "green" : cell.confidence === "medium" ? "orange" : "red"}>
                {d.ws.cell.confidence} · {d.ws.cell[cell.confidence]}
              </Badge>
            )}
            {cell.quote &&
              (cell.verified ? (
                <Badge color="blue">
                  <CheckCircle2 className="size-3" /> {d.ws.cell.verified}
                </Badge>
              ) : (
                <Badge>
                  <ShieldQuestion className="size-3" /> {d.ws.cell.unverified}
                </Badge>
              ))}
            {cell.edited && <Badge color="orange">{d.ws.cell.edited}</Badge>}
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">{d.ws.cell.value}</span>
            {!editing && cell && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-accent hover:underline">
                <Pencil className="size-3" /> {d.common.edit}
              </button>
            )}
          </div>
          {editing ? (
            <div className="space-y-2">
              <Textarea rows={5} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
              <div className="flex justify-end gap-2">
                <Button size="sm" onClick={() => setEditing(false)}>
                  {d.common.cancel}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  loading={saving}
                  onClick={async () => {
                    setSaving(true);
                    await onSave(value);
                    setSaving(false);
                    setEditing(false);
                  }}
                >
                  {d.common.save}
                </Button>
              </div>
            </div>
          ) : (
            <div className="glass-thin rounded-2xl p-4 text-[15px] leading-relaxed">
              {running ? <div className="shimmer h-12 rounded-xl" /> : cell?.value || <span className="text-muted">—</span>}
              {cell?.numeric != null && (dim.type === "number" || dim.type === "rating") && (
                <div className="mt-2 text-2xl font-semibold tracking-tight text-accent tabular">
                  {cell.numeric.toLocaleString()}
                  {dim.type === "rating" && <span className="text-sm text-muted"> / 5</span>}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{d.ws.cell.quote}</div>
          {cell?.quote ? (
            <blockquote className="relative rounded-2xl border-l-[3px] border-accent/60 bg-accent/[0.06] py-3 pr-4 pl-4 text-[13.5px] leading-relaxed italic">
              “{cell.quote}”
              {cell.page && <div className="mt-2 text-xs font-medium not-italic text-accent">— {fmt(d.ws.cell.page, { n: cell.page })}</div>}
            </blockquote>
          ) : (
            <div className="text-[13px] text-muted">{d.ws.cell.noQuote}</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {paper.hasFile && (
            <Button icon={<BookOpen className="size-4" />} onClick={() => onOpenPdf(cell?.page ?? null)}>
              {d.ws.cell.openPdf}
            </Button>
          )}
          <Button variant="tinted" icon={<RefreshCw className="size-4" />} loading={running} onClick={onRegenerate}>
            {d.ws.cell.regenerate}
          </Button>
        </div>
        {cell?.model && (
          <div className="text-xs text-muted">
            {d.ws.cell.model}: {cell.model}
          </div>
        )}
      </div>
    </Drawer>
  );
}
