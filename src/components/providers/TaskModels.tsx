"use client";

import { GlassPanel, Select } from "@/components/glass";
import { api } from "@/lib/client/api";
import { usePrefs } from "@/lib/client/prefs";
import type { Provider, ServerSettings, TaskKind } from "@/lib/shared/types";

const TASKS: TaskKind[] = ["extract", "report", "chat", "suggest"];

export function TaskModels({ providers, settings, onSettings }: { providers: Provider[]; settings: ServerSettings; onSettings: (s: ServerSettings) => void }) {
  const { d } = usePrefs();
  const usable = providers.filter((p) => p.enabled && p.models.some((m) => m.enabled));

  const change = async (task: TaskKind, raw: string) => {
    const ref = raw ? (JSON.parse(raw) as { providerId: string; modelId: string }) : null;
    onSettings(await api<ServerSettings>("/api/settings", "PATCH", { taskModels: { ...settings.taskModels, [task]: ref } }));
  };

  return (
    <GlassPanel className="p-4">
      <div className="mb-1 text-[14px] font-semibold">{d.providers.taskModels}</div>
      <p className="mb-3 text-[12px] text-muted">{d.providers.taskHint}</p>
      <div className="space-y-2.5">
        {TASKS.map((t) => {
          const cur = settings.taskModels[t];
          return (
            <label key={t} className="block">
              <span className="mb-1 block text-[12px] font-medium text-muted">{d.providers.tasks[t]}</span>
              <Select className="h-9 w-full text-[13px]" value={cur ? JSON.stringify({ providerId: cur.providerId, modelId: cur.modelId }) : ""} onChange={(e) => change(t, e.target.value)}>
                <option value="">{d.providers.followGlobal}</option>
                {usable.map((p) => (
                  <optgroup key={p.id} label={p.name}>
                    {p.models
                      .filter((m) => m.enabled)
                      .map((m) => (
                        <option key={m.id} value={JSON.stringify({ providerId: p.id, modelId: m.modelId })}>
                          {m.label || m.modelId}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            </label>
          );
        })}
      </div>
    </GlassPanel>
  );
}
