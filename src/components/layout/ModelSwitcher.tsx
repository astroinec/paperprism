"use client";

import Link from "next/link";
import { Check, ChevronDown, Cpu, KeyRound } from "lucide-react";
import { Menu } from "@/components/glass/menu";
import { useProviders, useServerSettings } from "@/lib/client/hooks";
import { api } from "@/lib/client/api";
import { usePrefs } from "@/lib/client/prefs";
import { useToast } from "@/components/glass/toast";
import { cn } from "@/lib/shared/utils";
import type { ModelRef, ServerSettings } from "@/lib/shared/types";

export function ModelSwitcher() {
  const { d } = usePrefs();
  const toast = useToast();
  const { data: providers } = useProviders();
  const { data: settings, mutate } = useServerSettings();
  const active = settings?.activeModel;
  const activeProvider = providers?.find((p) => p.id === active?.providerId);
  const activeModel = activeProvider?.models.find((m) => m.modelId === active?.modelId);
  const groups = (providers ?? []).filter((p) => p.enabled && p.models.some((m) => m.enabled));

  const choose = async (ref: ModelRef) => {
    const next = await api<ServerSettings>("/api/settings", "PATCH", { activeModel: ref });
    mutate(next, false);
    toast(`${d.model.current}: ${ref.modelId}`, "success");
  };

  return (
    <Menu
      width="w-72"
      trigger={(open) => (
        <button
          className={cn(
            "glass-thin flex h-9 max-w-[280px] items-center gap-2 rounded-full pr-3 pl-1.5 text-[13px] font-medium transition-all hover:brightness-105",
            open && "ring-2 ring-accent/30",
          )}
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full",
              activeProvider?.type === "mock" ? "bg-[#ff9f0a]/20 text-[#ff9f0a]" : "bg-[#34c759]/18 text-[#34c759]",
            )}
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-50" />
              <span className="relative inline-flex size-2 rounded-full bg-current" />
            </span>
          </span>
          <span className="truncate">{activeModel ? activeModel.label || activeModel.modelId : d.model.none}</span>
          {activeProvider && <span className="hidden truncate text-xs text-muted sm:inline">· {activeProvider.name}</span>}
          <ChevronDown className="size-3.5 shrink-0 text-muted" />
        </button>
      )}
    >
      {(close) => (
        <div className="scroll-thin max-h-[60vh] overflow-y-auto">
          {groups.length === 0 && <div className="px-3 py-4 text-center text-[13px] text-muted">{d.model.noModels}</div>}
          {groups.map((p) => (
            <div key={p.id} className="mb-1">
              <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                <Cpu className="size-3" />
                {p.name}
              </div>
              {p.models
                .filter((m) => m.enabled)
                .map((m) => {
                  const on = active?.providerId === p.id && active.modelId === m.modelId;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        choose({ providerId: p.id, modelId: m.modelId });
                        close();
                      }}
                      className={cn("flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] hover:bg-[var(--hover)]", on && "font-semibold")}
                    >
                      <span className="flex-1 truncate">{m.label || m.modelId}</span>
                      {on && <Check className="size-4 text-accent" />}
                    </button>
                  );
                })}
            </div>
          ))}
          <div className="mx-2 my-1 h-px bg-[var(--line)]" />
          <Link
            href="/settings/providers"
            onClick={close}
            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-accent hover:bg-[var(--hover)]"
          >
            <KeyRound className="size-4" />
            {d.model.manage}
          </Link>
        </div>
      )}
    </Menu>
  );
}
