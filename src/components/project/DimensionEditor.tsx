"use client";

import { useEffect, useState } from "react";
import { Reorder, useDragControls } from "motion/react";
import { GripVertical, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Button, IconButton, Input, Select } from "@/components/glass";
import { Modal } from "@/components/glass/overlay";
import { Menu } from "@/components/glass/menu";
import { useToast } from "@/components/glass/toast";
import { api } from "@/lib/client/api";
import { usePrefs } from "@/lib/client/prefs";
import { TEMPLATES } from "@/lib/shared/templates";
import type { Dimension, DimensionType } from "@/lib/shared/types";

interface Row {
  key: string;
  id?: string;
  name: string;
  description: string;
  type: DimensionType;
}

let seq = 0;
const k = () => `r${++seq}`;

function RowItem({ row, onChange, onRemove }: { row: Row; onChange: (r: Row) => void; onRemove: () => void }) {
  const { d } = usePrefs();
  const controls = useDragControls();
  return (
    <Reorder.Item value={row} dragListener={false} dragControls={controls} className="glass-thin flex items-start gap-2 rounded-2xl p-2.5" whileDrag={{ scale: 1.02, zIndex: 10 }}>
      <button onPointerDown={(e) => controls.start(e)} className="mt-2 cursor-grab touch-none text-muted active:cursor-grabbing">
        <GripVertical className="size-4" />
      </button>
      <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_130px]">
        <Input value={row.name} onChange={(e) => onChange({ ...row, name: e.target.value })} placeholder={d.dims.namePh} className="font-medium" />
        <Select value={row.type} onChange={(e) => onChange({ ...row, type: e.target.value as DimensionType })}>
          {(["text", "number", "rating", "tags"] as const).map((t) => (
            <option key={t} value={t}>
              {d.dims.types[t]}
            </option>
          ))}
        </Select>
        <Input value={row.description} onChange={(e) => onChange({ ...row, description: e.target.value })} placeholder={d.dims.descPh} className="text-[13px] sm:col-span-2" />
      </div>
      <IconButton onClick={onRemove} className="mt-1 hover:text-[#ff3b30]">
        <Trash2 className="size-4" />
      </IconButton>
    </Reorder.Item>
  );
}

export function DimensionEditor({
  open,
  onClose,
  projectId,
  dimensions,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  dimensions: Dimension[];
  onSaved: () => void;
}) {
  const { d, lang, prefs } = usePrefs();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    if (open) setRows(dimensions.map((x) => ({ key: k(), id: x.id, name: x.name, description: x.description, type: x.type })));
  }, [open, dimensions]);

  const suggest = async () => {
    setSuggesting(true);
    try {
      const res = await api<{ dimensions: Omit<Row, "key">[] }>(`/api/projects/${projectId}/suggest-dimensions`, "POST", { lang: prefs.outputLang });
      const existing = new Set(rows.map((r) => r.name.trim().toLowerCase()));
      setRows((r) => [...r, ...res.dimensions.filter((x) => !existing.has(x.name.trim().toLowerCase())).map((x) => ({ ...x, key: k() }))]);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSuggesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api(`/api/projects/${projectId}/dimensions`, "PUT", { dimensions: rows.map(({ key: _k, ...r }) => r) });
      toast(d.dims.saved, "success");
      onSaved();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={d.dims.title}
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>{d.common.cancel}</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {d.common.save}
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <Button variant="tinted" size="sm" icon={<Sparkles className="size-3.5" />} loading={suggesting} onClick={suggest}>
          {suggesting ? d.dims.suggesting : d.dims.suggest}
        </Button>
        <Menu
          align="left"
          width="w-64"
          trigger={() => (
            <Button size="sm" icon={<Wand2 className="size-3.5" />}>
              {d.dims.applyTemplate}
            </Button>
          )}
          items={TEMPLATES.filter((t) => t.dimensions.length).map((t) => ({
            label: t.name[lang],
            hint: t.dimensions.length,
            onClick: () => setRows(t.dimensions.map((x) => ({ key: k(), name: x.name[lang], description: x.description[lang], type: x.type }))),
          }))}
        />
        <span className="self-center text-xs text-muted">{d.dims.replaceHint}</span>
      </div>
      <Reorder.Group axis="y" values={rows} onReorder={setRows} className="space-y-2">
        {rows.map((r) => (
          <RowItem
            key={r.key}
            row={r}
            onChange={(nr) => setRows((xs) => xs.map((x) => (x.key === r.key ? nr : x)))}
            onRemove={() => setRows((xs) => xs.filter((x) => x.key !== r.key))}
          />
        ))}
      </Reorder.Group>
      <Button
        variant="ghost"
        className="mt-2 w-full border border-dashed border-line"
        icon={<Plus className="size-4" />}
        onClick={() => setRows((xs) => [...xs, { key: k(), name: "", description: "", type: "text" }])}
      >
        {d.dims.add}
      </Button>
    </Modal>
  );
}
