"use client";

import { useEffect, useState } from "react";
import { Button, Field, Input, Segmented } from "@/components/glass";
import { Modal } from "@/components/glass/overlay";
import { useToast } from "@/components/glass/toast";
import { api } from "@/lib/client/api";
import { usePrefs } from "@/lib/client/prefs";
import { PROVIDER_PRESETS } from "@/lib/shared/presets";
import { cn } from "@/lib/shared/utils";
import type { Provider, ProviderType } from "@/lib/shared/types";

type EditableType = Exclude<ProviderType, "mock">;

export function AddProviderModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (p: Provider) => void }) {
  const { d } = usePrefs();
  const toast = useToast();
  const [preset, setPreset] = useState("openai");
  const [name, setName] = useState("");
  const [type, setType] = useState<EditableType>("openai");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);

  const applyPreset = (key: string) => {
    const p = PROVIDER_PRESETS.find((x) => x.key === key);
    if (!p) return;
    setPreset(key);
    setName(key === "custom" ? "" : p.name);
    setType(p.type as EditableType);
    setBaseUrl(p.baseUrl);
  };

  useEffect(() => {
    if (open) {
      applyPreset("openai");
      setApiKey("");
    }
  }, [open]);

  const current = PROVIDER_PRESETS.find((x) => x.key === preset);

  const submit = async () => {
    setBusy(true);
    try {
      const p = await api<Provider>("/api/providers", "POST", { name, type, baseUrl, apiKey, models: current?.models ?? [] });
      toast(d.common.saved, "success");
      onCreated(p);
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
      title={d.providers.add}
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose}>{d.common.cancel}</Button>
          <Button variant="primary" loading={busy} disabled={!name.trim() || !baseUrl.trim()} onClick={submit}>
            {d.common.create}
          </Button>
        </>
      }
    >
      <div className="space-y-5 pt-2">
        <div>
          <div className="mb-2 text-[13px] font-medium">{d.providers.preset}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PROVIDER_PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={cn(
                  "glass-thin rounded-2xl px-3 py-2.5 text-left text-[13px] transition-all hover:brightness-105",
                  preset === p.key && "ring-2 ring-accent/60",
                )}
              >
                <div className="truncate font-medium">{p.name}</div>
                <div className="truncate text-[11px] text-muted">{d.providers.types[p.type]}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={d.common.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Provider" />
          </Field>
          <Field label={d.providers.type}>
            <Segmented<EditableType>
              size="sm"
              value={type}
              onChange={setType}
              options={(["openai", "anthropic", "ollama"] as const).map((t) => ({ value: t, label: d.providers.types[t] }))}
            />
          </Field>
        </div>
        <Field label={d.providers.baseUrl}>
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" className="font-mono text-[13px]" />
        </Field>
        <Field label={d.providers.apiKey} hint={type === "ollama" ? d.providers.noKeyNeeded : d.providers.keyStored}>
          <Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" className="font-mono text-[13px]" />
        </Field>
      </div>
    </Modal>
  );
}
