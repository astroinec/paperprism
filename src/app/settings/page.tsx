"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Button, Empty, Field, GlassPanel, Input, SectionTitle, Segmented, Slider, Switch } from "@/components/glass";
import { useToast } from "@/components/glass/toast";
import { api, fetcher } from "@/lib/client/api";
import { useServerSettings } from "@/lib/client/hooks";
import { usePrefs, type Lang, type Theme } from "@/lib/client/prefs";
import { SKIN_IDS, type SkinId } from "@/lib/client/skins";
import type { ServerSettings, UsageSummary } from "@/lib/shared/types";

type Agent = Pick<ServerSettings, "temperature" | "maxTokens" | "concurrency" | "contextChars">;

export default function SettingsPage() {
  const { d, prefs, setPrefs } = usePrefs();

  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle title={d.settings.title} />
      <div className="space-y-4">
        <GlassPanel className="p-5">
          <h2 className="mb-4 text-[15px] font-semibold">{d.settings.appearance}</h2>
          <Row label={d.settings.language}>
            <Segmented<Lang>
              size="sm"
              value={prefs.lang}
              onChange={(lang) => setPrefs({ lang })}
              options={[
                { value: "zh", label: "中文" },
                { value: "en", label: "English" },
              ]}
            />
          </Row>
          <Row label={d.settings.theme}>
            <Segmented<Theme>
              size="sm"
              value={prefs.theme}
              onChange={(theme) => setPrefs({ theme })}
              options={[
                { value: "light", label: d.settings.themes.light, icon: <Sun className="size-3.5" /> },
                { value: "dark", label: d.settings.themes.dark, icon: <Moon className="size-3.5" /> },
                { value: "system", label: d.settings.themes.system, icon: <Monitor className="size-3.5" /> },
              ]}
            />
          </Row>
          <div className="border-b border-[var(--line)] py-3">
            <div className="mb-3 text-[14px]">{d.settings.skin}</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SKIN_IDS.map((id) => (
                <SkinCard key={id} id={id} label={d.settings.skins[id]} active={prefs.skin === id} onPick={() => setPrefs({ skin: id })} />
              ))}
            </div>
          </div>
          <Row label={d.settings.glass}>
            <div className="flex w-64 items-center gap-3 text-[12px] text-muted">
              <span>{d.settings.glassClear}</span>
              <Slider value={prefs.glass} onChange={(glass) => setPrefs({ glass })} min={0} max={1} step={0.05} />
              <span>{d.settings.glassTinted}</span>
            </div>
          </Row>
          <Row label={d.settings.reduceTransparency}>
            <Switch checked={prefs.reduceTransparency} onChange={(reduceTransparency) => setPrefs({ reduceTransparency })} />
          </Row>
          <Row label={d.settings.reduceMotion} last>
            <Switch checked={prefs.reduceMotion} onChange={(reduceMotion) => setPrefs({ reduceMotion })} />
          </Row>
        </GlassPanel>

        <AgentPanel />
        <UsagePanel />

        <GlassPanel className="p-5">
          <h2 className="mb-2 text-[15px] font-semibold">{d.settings.data}</h2>
          <p className="text-[13px] text-muted">{d.settings.dataHint}</p>
        </GlassPanel>
      </div>
    </div>
  );
}

function SkinCard({ id, label, active, onPick }: { id: SkinId; label: string; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      data-skin={id}
      onClick={onPick}
      aria-pressed={active}
      className={`group relative h-28 overflow-hidden rounded-2xl text-left transition-all duration-200 hover:-translate-y-0.5 ${
        active ? "ring-2 ring-accent ring-offset-2 ring-offset-transparent" : "ring-1 ring-[var(--line)]"
      }`}
    >
      <div className="wp">
        <div className="wp-layer">
          <div className="wp-blob" style={{ background: "var(--wp-1)", width: "70%", height: "90%", top: "-30%", left: "-15%", filter: "blur(28px)" }} />
          <div className="wp-blob" style={{ background: "var(--wp-2)", width: "60%", height: "80%", bottom: "-30%", right: "-10%", filter: "blur(28px)" }} />
          <div className="wp-blob" style={{ background: "var(--wp-3)", width: "40%", height: "60%", top: "10%", right: "20%", filter: "blur(24px)" }} />
          <div className="wp-ribbon" style={{ top: "30%", left: "-10%", width: "90%", height: "22%", background: "linear-gradient(90deg, transparent, var(--wp-1), var(--wp-2), transparent)", ["--r" as string]: "-14deg", animation: "none", transform: "rotate(-14deg)" }} />
        </div>
        <div className="wp-grain" />
      </div>
      <div className="absolute inset-x-2.5 bottom-2.5">
        <div className="glass-thin flex items-center gap-2 rounded-xl px-2.5 py-2">
          <span className="size-3.5 shrink-0 rounded-full bg-gradient-to-b from-accent-hi to-accent shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]" />
          <span className="flex-1 truncate text-[12.5px] font-medium text-[rgb(var(--fg))]">{label}</span>
          {active && <Check className="size-3.5 text-accent" />}
        </div>
      </div>
    </button>
  );
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 py-3 ${last ? "" : "border-b border-[var(--line)]"}`}>
      <span className="text-[14px]">{label}</span>
      {children}
    </div>
  );
}

function AgentPanel() {
  const { d, prefs, setPrefs } = usePrefs();
  const toast = useToast();
  const { data: settings, mutate } = useServerSettings();
  const [form, setForm] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings && !form) {
      const { temperature, maxTokens, concurrency, contextChars } = settings;
      setForm({ temperature, maxTokens, concurrency, contextChars });
    }
  }, [settings, form]);

  if (!form || !settings) return null;
  const dirty = (Object.keys(form) as (keyof Agent)[]).some((k) => form[k] !== settings[k]);
  const set = (p: Partial<Agent>) => setForm({ ...form, ...p });

  const save = async () => {
    setSaving(true);
    try {
      const next = await api<ServerSettings>("/api/settings", "PATCH", form);
      mutate(next, false);
      const { temperature, maxTokens, concurrency, contextChars } = next;
      setForm({ temperature, maxTokens, concurrency, contextChars });
      toast(d.common.saved, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassPanel className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">{d.settings.agent}</h2>
        <Button size="sm" variant="primary" disabled={!dirty} loading={saving} onClick={save} icon={<Check className="size-4" />}>
          {d.common.save}
        </Button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={d.settings.outputLang}>
          <Segmented<Lang>
            size="sm"
            value={prefs.outputLang}
            onChange={(outputLang) => setPrefs({ outputLang })}
            options={[
              { value: "zh", label: "中文" },
              { value: "en", label: "English" },
            ]}
          />
        </Field>
        <Field label={`${d.settings.temperature} · ${form.temperature.toFixed(2)}`}>
          <div className="flex h-9 items-center">
            <Slider value={form.temperature} onChange={(temperature) => set({ temperature })} min={0} max={1.5} step={0.05} />
          </div>
        </Field>
        <Field label={d.settings.maxTokens}>
          <Input type="number" min={256} max={64000} step={256} value={form.maxTokens} onChange={(e) => set({ maxTokens: Number(e.target.value) || 0 })} />
        </Field>
        <Field label={`${d.settings.concurrency} · ${form.concurrency}`}>
          <div className="flex h-9 items-center">
            <Slider value={form.concurrency} onChange={(concurrency) => set({ concurrency })} min={1} max={10} step={1} />
          </div>
        </Field>
        <Field label={d.settings.contextChars} className="sm:col-span-2">
          <Input type="number" min={8000} max={400000} step={1000} value={form.contextChars} onChange={(e) => set({ contextChars: Number(e.target.value) || 0 })} />
        </Field>
      </div>
    </GlassPanel>
  );
}

function UsagePanel() {
  const { d, lang } = usePrefs();
  const [days, setDays] = useState<"7" | "30" | "0">("30");
  const { data } = useSWR<{ summary: UsageSummary[] }>(`/api/usage?days=${days}`, fetcher);
  const nf = new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en");
  const total = data?.summary.reduce(
    (a, r) => ({ calls: a.calls + r.calls, inp: a.inp + r.inputTokens, out: a.out + r.outputTokens, cost: a.cost + (r.cost ?? 0) }),
    { calls: 0, inp: 0, out: 0, cost: 0 },
  );

  return (
    <GlassPanel className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{d.settings.usage}</h2>
        <Segmented
          size="sm"
          value={days}
          onChange={setDays}
          options={[
            { value: "7", label: lang === "zh" ? "7 天" : "7d" },
            { value: "30", label: lang === "zh" ? "30 天" : "30d" },
            { value: "0", label: d.common.all },
          ]}
        />
      </div>
      {!data?.summary.length ? (
        <Empty className="py-8" title={d.settings.usageEmpty} />
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-muted">
                <th className="py-2 pr-3 font-medium">{d.settings.model}</th>
                <th className="py-2 pr-3 text-right font-medium">{d.settings.calls}</th>
                <th className="py-2 pr-3 text-right font-medium">{d.settings.inTok}</th>
                <th className="py-2 pr-3 text-right font-medium">{d.settings.outTok}</th>
                <th className="py-2 text-right font-medium">{d.settings.cost}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {data.summary.map((r) => (
                <tr key={`${r.providerId}/${r.model}`}>
                  <td className="py-2 pr-3 font-mono text-[12.5px]">{r.model}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.calls)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.inputTokens)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{nf.format(r.outputTokens)}</td>
                  <td className="py-2 text-right tabular-nums">{r.cost == null ? "—" : `$${r.cost.toFixed(4)}`}</td>
                </tr>
              ))}
              {total && data.summary.length > 1 && (
                <tr className="font-semibold">
                  <td className="py-2 pr-3">Σ</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{nf.format(total.calls)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{nf.format(total.inp)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{nf.format(total.out)}</td>
                  <td className="py-2 text-right tabular-nums">{data.summary.some((r) => r.cost != null) ? `$${total.cost.toFixed(4)}` : "—"}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </GlassPanel>
  );
}
