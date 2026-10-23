"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { KeyRound, Plus } from "lucide-react";
import { Badge, Button, Empty, GlassPanel, SectionTitle, Spinner } from "@/components/glass";
import { AddProviderModal } from "@/components/providers/AddProviderModal";
import { ProviderDetail } from "@/components/providers/ProviderDetail";
import { TaskModels } from "@/components/providers/TaskModels";
import { useProviders, useServerSettings } from "@/lib/client/hooks";
import { usePrefs } from "@/lib/client/prefs";
import { cn } from "@/lib/shared/utils";
import type { Provider, ServerSettings } from "@/lib/shared/types";

const TYPE_COLOR: Record<Provider["type"], string> = {
  openai: "from-[#34c759] to-[#30b0c7]",
  anthropic: "from-[#ff9f0a] to-[#ff6b3d]",
  ollama: "from-[#8e8e93] to-[#48484a]",
  mock: "from-[#5ac8fa] to-accent-2",
};

export default function ProvidersPage() {
  const { d } = usePrefs();
  const { data: providers, mutate } = useProviders();
  const { data: settings, mutate: mutateSettings } = useServerSettings();
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (selected || !providers?.length) return;
    setSelected((providers.find((p) => p.id === settings?.activeModel?.providerId) ?? providers[0]).id);
  }, [providers, selected, settings]);

  const current = providers?.find((p) => p.id === selected);
  const onSettings = (s: ServerSettings) => mutateSettings(s, false);

  return (
    <div>
      <SectionTitle
        title={d.providers.title}
        sub={d.providers.sub}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>
            {d.providers.add}
          </Button>
        }
      />
      {!providers ? (
        <div className="flex justify-center py-20">
          <Spinner className="size-6" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <GlassPanel className="p-2">
              {providers.length === 0 && <Empty icon={<KeyRound />} title={d.providers.noProviders} />}
              {providers.map((p) => {
                const isActive = settings?.activeModel?.providerId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      "relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                      selected !== p.id && "hover:bg-[var(--hover)]",
                      !p.enabled && "opacity-55",
                    )}
                  >
                    {selected === p.id && (
                      <motion.span
                        layoutId="provider-pill"
                        className="absolute inset-0 rounded-2xl bg-white/80 shadow-[0_1px_3px_rgb(0_0_0/0.08),inset_0_1px_0_rgb(255_255_255/0.9)] dark:bg-white/12"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span
                      className={cn(
                        "relative flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br text-[14px] font-bold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]",
                        TYPE_COLOR[p.type],
                      )}
                    >
                      {p.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{p.name}</span>
                      <span className="block truncate text-[11.5px] text-muted">
                        {d.providers.types[p.type]} · {p.models.length} {d.providers.models}
                      </span>
                    </span>
                    {isActive && (
                      <Badge color="green" className="relative">
                        {d.providers.active}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </GlassPanel>
            {settings && <TaskModels providers={providers} settings={settings} onSettings={onSettings} />}
          </div>
          <div className="min-w-0">
            {current ? (
              <ProviderDetail
                key={current.id}
                provider={current}
                settings={settings}
                onChanged={() => mutate()}
                onSettings={onSettings}
                onDeleted={() => {
                  setSelected(null);
                  mutate();
                  mutateSettings();
                }}
              />
            ) : (
              <GlassPanel>
                <Empty icon={<KeyRound />} title={d.providers.pickOne} />
              </GlassPanel>
            )}
          </div>
        </div>
      )}
      <AddProviderModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(p) => {
          mutate((cur) => [...(cur ?? []).filter((x) => x.id !== p.id), p], { revalidate: true });
          setSelected(p.id);
        }}
      />
    </div>
  );
}
