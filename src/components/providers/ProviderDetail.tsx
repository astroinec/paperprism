"use client";

import { useEffect, useState } from "react";
import { Check, CloudDownload, Plug, Plus, Trash2, X } from "lucide-react";
import { Badge, Button, Field, GlassPanel, IconButton, Input, Spinner, Switch } from "@/components/glass";
import { useToast } from "@/components/glass/toast";
import { useConfirm } from "@/components/glass/confirm";
import { api } from "@/lib/client/api";
import { fmt, usePrefs } from "@/lib/client/prefs";
import { cn } from "@/lib/shared/utils";
import type { ModelInfo, ModelRef, Provider, ServerSettings } from "@/lib/shared/types";

interface TestResult {
  ok: boolean;
  modelId: string;
  latencyMs?: number;
  reply?: string;
  error?: string;
}

export function ProviderDetail({
  provider,
  settings,
  onChanged,
  onSettings,
  onDeleted,
}: {
  provider: Provider;
  settings: ServerSettings | undefined;
  onChanged: () => void;
  onSettings: (s: ServerSettings) => void;
  onDeleted: () => void;
}) {
  const { d } = usePrefs();
  const toast = useToast();
  const confirm = useConfirm();
  const isMock = provider.type === "mock";

  const [name, setName] = useState(provider.name);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [remote, setRemote] = useState<string[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [manual, setManual] = useState("");

  useEffect(() => {
    setName(provider.name);
    setBaseUrl(provider.baseUrl);
    setApiKey("");
    setTest(null);
    setRemote(null);
  }, [provider.id, provider.name, provider.baseUrl]);

  const dirty = name !== provider.name || baseUrl !== provider.baseUrl || apiKey !== "";

  const save = async () => {
    setSaving(true);
    try {
      const patch: Record<string, string> = { name };
      if (!isMock) patch.baseUrl = baseUrl;
      if (apiKey) patch.apiKey = apiKey;
      await api(`/api/providers/${provider.id}`, "PATCH", patch);
      setApiKey("");
      onChanged();
      toast(d.common.saved, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (enabled: boolean) => {
    await api(`/api/providers/${provider.id}`, "PATCH", { enabled });
    onChanged();
  };

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      setTest(await api<TestResult>(`/api/providers/${provider.id}/test`, "POST", {}));
    } catch (e) {
      setTest({ ok: false, modelId: "", error: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const fetchRemote = async () => {
    setFetching(true);
    try {
      const r = await api<{ models: string[] }>(`/api/providers/${provider.id}/remote-models`);
      const have = new Set(provider.models.map((m) => m.modelId));
      const fresh = r.models.filter((m) => !have.has(m));
      setRemote(fresh);
      if (!fresh.length) toast(d.providers.remoteEmpty, "info");
    } catch (e) {
      toast(`${d.providers.testFail}: ${(e as Error).message}`, "error");
    } finally {
      setFetching(false);
    }
  };

  const addModels = async (ids: string[]) => {
    if (!ids.length) return;
    await api(`/api/providers/${provider.id}/models`, "POST", { modelIds: ids });
    setRemote((r) => r?.filter((m) => !ids.includes(m)) ?? null);
    onChanged();
  };

  const addManual = async () => {
    const ids = manual.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean);
    await addModels(ids);
    setManual("");
  };

  const patchModel = async (m: ModelInfo, patch: Partial<Pick<ModelInfo, "enabled" | "label" | "priceIn" | "priceOut">>) => {
    await api(`/api/models/${m.id}`, "PATCH", patch);
    onChanged();
  };

  const removeModel = async (m: ModelInfo) => {
    await api(`/api/models/${m.id}`, "DELETE");
    onChanged();
  };

  const setActive = async (ref: ModelRef) => {
    onSettings(await api<ServerSettings>("/api/settings", "PATCH", { activeModel: ref }));
    toast(`${d.model.current}: ${ref.modelId}`, "success");
  };

  const remove = async () => {
    if (!(await confirm(d.providers.deleteConfirm, { danger: true }))) return;
    await api(`/api/providers/${provider.id}`, "DELETE");
    onDeleted();
    toast(d.common.deleted, "success");
  };

  return (
    <div className="space-y-4">
      <GlassPanel className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{provider.name}</h2>
          <Badge color={isMock ? "orange" : "blue"}>{d.providers.types[provider.type]}</Badge>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[13px] text-muted">{d.providers.enabled}</span>
            <Switch checked={provider.enabled} onChange={toggleEnabled} />
            {!isMock && (
              <IconButton onClick={remove} title={d.common.delete} className="hover:text-[#ff3b30]">
                <Trash2 className="size-4" />
              </IconButton>
            )}
          </div>
        </div>

        {isMock ? (
          <p className="rounded-2xl bg-[#ff9f0a]/10 px-4 py-3 text-[13px] text-[#b86e00] dark:text-[#ffc15a]">{d.providers.demoNote}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={d.common.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label={d.providers.baseUrl}>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="font-mono text-[13px]" />
            </Field>
            <Field
              className="md:col-span-2"
              label={d.providers.apiKey}
              hint={provider.hasKey ? `${provider.apiKeyMasked} · ${d.providers.keyStored} · ${d.providers.apiKeyKeep}` : provider.type === "ollama" ? d.providers.noKeyNeeded : undefined}
            >
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={provider.hasKey ? provider.apiKeyMasked : "sk-…"}
                className="font-mono text-[13px]"
              />
            </Field>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!isMock && (
            <Button variant="primary" size="sm" disabled={!dirty} loading={saving} onClick={save} icon={<Check className="size-4" />}>
              {d.common.save}
            </Button>
          )}
          <Button size="sm" loading={testing} onClick={runTest} icon={<Plug className="size-4" />}>
            {testing ? d.providers.testing : d.providers.test}
          </Button>
          {test && (
            <span
              className={cn(
                "inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-3 py-1 text-[12px] font-medium",
                test.ok ? "bg-[#34c759]/15 text-[#1f8f3c] dark:text-[#5ee07f]" : "bg-[#ff3b30]/12 text-[#d42a20] dark:text-[#ff7a72]",
              )}
              title={test.ok ? test.reply : test.error}
            >
              {test.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
              {test.ok ? `${fmt(d.providers.testOk, { ms: test.latencyMs ?? 0 })} · ${test.modelId}` : `${d.providers.testFail}: ${test.error}`}
            </span>
          )}
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold">{d.providers.models}</h3>
          <Badge>{provider.models.length}</Badge>
          <div className="ml-auto">
            <Button size="sm" variant="tinted" loading={fetching} onClick={fetchRemote} icon={<CloudDownload className="size-4" />}>
              {fetching ? d.providers.fetching : d.providers.fetchModels}
            </Button>
          </div>
        </div>

        {remote && remote.length > 0 && (
          <div className="mb-4 rounded-2xl bg-[var(--hover)] p-3">
            <div className="mb-2 flex items-center justify-between text-[12px] text-muted">
              <span>{d.providers.remoteTitle}</span>
              <button className="font-medium text-accent hover:underline" onClick={() => addModels(remote)}>
                {d.providers.addAll} ({remote.length})
              </button>
            </div>
            <div className="scroll-thin flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {remote.map((m) => (
                <button
                  key={m}
                  onClick={() => addModels([m])}
                  className="glass-thin inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11.5px] transition hover:text-accent"
                >
                  <Plus className="size-3" />
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="divide-y divide-[var(--line)]">
          {provider.models.map((m) => {
            const on = settings?.activeModel?.providerId === provider.id && settings.activeModel.modelId === m.modelId;
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                <Switch checked={m.enabled} onChange={(v) => patchModel(m, { enabled: v })} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[13px]">{m.modelId}</div>
                  <input
                    defaultValue={m.label ?? ""}
                    placeholder={d.providers.label}
                    onBlur={(e) => e.target.value !== (m.label ?? "") && patchModel(m, { label: e.target.value })}
                    className="w-full bg-transparent text-[12px] text-muted outline-none placeholder:text-muted/50"
                  />
                </div>
                {!isMock && (
                  <div className="flex items-center gap-1.5">
                    <PriceInput title={d.providers.priceIn} value={m.priceIn} onCommit={(v) => patchModel(m, { priceIn: v })} />
                    <PriceInput title={d.providers.priceOut} value={m.priceOut} onCommit={(v) => patchModel(m, { priceOut: v })} />
                  </div>
                )}
                {on ? (
                  <Badge color="green">
                    <Check className="size-3" />
                    {d.providers.active}
                  </Badge>
                ) : (
                  <Button size="sm" variant="ghost" disabled={!m.enabled || !provider.enabled} onClick={() => setActive({ providerId: provider.id, modelId: m.modelId })}>
                    {d.providers.setActive}
                  </Button>
                )}
                {!isMock && (
                  <IconButton onClick={() => removeModel(m)} title={d.common.delete}>
                    <X className="size-4" />
                  </IconButton>
                )}
              </div>
            );
          })}
        </div>

        {!isMock && (
          <div className="mt-3 flex gap-2">
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && manual.trim() && addManual()}
              placeholder={d.providers.addModelPh}
              className="font-mono text-[13px]"
            />
            <Button disabled={!manual.trim()} onClick={addManual} icon={<Plus className="size-4" />}>
              {d.common.add}
            </Button>
          </div>
        )}
        {fetching && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-muted">
            <Spinner className="size-3.5" />
            {d.providers.fetching}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}

function PriceInput({ title, value, onCommit }: { title: string; value: number | null; onCommit: (v: number | null) => void }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  useEffect(() => setV(value == null ? "" : String(value)), [value]);
  return (
    <input
      title={title}
      placeholder={title}
      inputMode="decimal"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = v.trim() === "" ? null : Number(v);
        if (n !== null && !Number.isFinite(n)) return setV(value == null ? "" : String(value));
        if (n !== value) onCommit(n);
      }}
      className="input-glass h-8 w-24 px-2 text-[12px]"
    />
  );
}
