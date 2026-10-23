"use client";

import { useMemo, useRef, type ReactNode } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import type { EChartsOption } from "echarts";
import { BarChart3, Download, GitCommitHorizontal, Grid3x3, Radar } from "lucide-react";
import { Empty, GlassPanel, IconButton, Spinner } from "@/components/glass";
import { fetcher } from "@/lib/client/api";
import { usePrefs } from "@/lib/client/prefs";
import { chartPalette, heatRamp } from "@/lib/client/skins";
import { truncate } from "@/lib/shared/utils";
import type { ProjectDetail } from "@/lib/shared/types";
import { Chart, type ChartHandle } from "./Chart";

interface Insights {
  papers: { id: string; label: string; title: string; year: number | null }[];
  bars: { dimensionId: string; name: string; values: (number | null)[] }[];
  radar: { indicators: { dimensionId: string; name: string }[]; series: { label: string; values: (number | null)[] }[] } | null;
  timeline: { label: string; title: string; year: number | null; note: string | null }[];
  similarity: number[][];
}


function Card({ title, icon, children, chartRef, span }: { title: string; icon: ReactNode; children: ReactNode; chartRef?: React.RefObject<ChartHandle | null>; span?: boolean }) {
  const { d } = usePrefs();
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={span ? "lg:col-span-2" : ""}>
      <GlassPanel className="p-5">
        <div className="relative z-[2]">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-accent [&_svg]:size-4">{icon}</span>
            <span className="flex-1 text-[15px] font-semibold">{title}</span>
            {chartRef && (
              <IconButton
                title={d.insights.savePng}
                onClick={() => {
                  const url = chartRef.current?.toDataURL();
                  if (!url) return;
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${title}.png`;
                  a.click();
                }}
              >
                <Download className="size-4" />
              </IconButton>
            )}
          </div>
          {children}
        </div>
      </GlassPanel>
    </motion.div>
  );
}

export function InsightsView({ project }: { project: ProjectDetail }) {
  const { d, prefs, resolvedTheme } = usePrefs();
  const dark = resolvedTheme === "dark";
  const PALETTE = useMemo(() => chartPalette(prefs.skin, dark), [prefs.skin, dark]);
  const heat = useMemo(() => heatRamp(prefs.skin, dark), [prefs.skin, dark]);
  const stamp = project.cells.reduce((m, c) => Math.max(m, c.updatedAt), 0);
  const { data, isLoading } = useSWR<Insights>(`/api/projects/${project.id}/insights?v=${stamp}-${project.dimensions.length}-${project.papers.length}`, fetcher);
  const barRef = useRef<ChartHandle>(null);
  const radarRef = useRef<ChartHandle>(null);
  const simRef = useRef<ChartHandle>(null);
  const tlRef = useRef<ChartHandle>(null);

  const tooltip = { backgroundColor: "rgba(255,255,255,0.85)", borderColor: "rgba(0,0,0,0.06)", textStyle: { color: "#111" }, extraCssText: "backdrop-filter: blur(12px); border-radius: 12px;" };

  const barOptions = useMemo<EChartsOption[]>(
    () =>
      (data?.bars ?? []).map((b) => ({
        color: PALETTE,
        tooltip: { trigger: "axis", ...tooltip },
        grid: { left: 50, right: 16, top: 30, bottom: 30 },
        xAxis: { type: "category", data: data!.papers.map((p) => p.label), axisTick: { show: false } },
        yAxis: { type: "value", splitLine: { lineStyle: { type: "dashed", opacity: 0.4 } } },
        title: { text: b.name, textStyle: { fontSize: 13, fontWeight: 600 }, left: 0, top: 0 },
        series: [
          {
            type: "bar",
            barMaxWidth: 42,
            data: b.values.map((v, i) => ({ value: v, itemStyle: { color: PALETTE[i % PALETTE.length], borderRadius: [8, 8, 2, 2] } })),
            label: { show: true, position: "top", fontSize: 11 },
          },
        ],
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );

  const radarOption = useMemo<EChartsOption | null>(() => {
    if (!data?.radar) return null;
    return {
      color: PALETTE,
      tooltip: { ...tooltip },
      legend: { bottom: 0, icon: "circle" },
      radar: {
        indicator: data.radar.indicators.map((i) => ({ name: truncate(i.name, 12), max: 5, min: 0 })),
        radius: "62%",
        splitArea: { show: false },
        axisName: { fontSize: 11 },
      },
      series: [
        {
          type: "radar",
          symbolSize: 5,
          areaStyle: { opacity: 0.12 },
          data: data.radar.series.map((s) => ({ name: s.label, value: s.values.map((v) => v ?? 0) })),
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, PALETTE, heat]);

  const simOption = useMemo<EChartsOption | null>(() => {
    if (!data || data.papers.length < 2) return null;
    const labels = data.papers.map((p) => p.label);
    const values: [number, number, number][] = [];
    data.similarity.forEach((row, i) => row.forEach((v, j) => values.push([j, i, v])));
    return {
      tooltip: {
        ...tooltip,
        formatter: (p: unknown) => {
          const v = (p as { value: [number, number, number] }).value;
          return `${labels[v[1]]} ↔ ${labels[v[0]]}: ${v[2]}`;
        },
      },
      grid: { left: 40, right: 20, top: 10, bottom: 60 },
      xAxis: { type: "category", data: labels, splitArea: { show: true } },
      yAxis: { type: "category", data: labels, splitArea: { show: true } },
      visualMap: { min: 0, max: 1, calculable: true, orient: "horizontal", left: "center", bottom: 0, inRange: { color: heat } },
      series: [{ type: "heatmap", data: values, label: { show: true, fontSize: 11 }, itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: "transparent" } }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, PALETTE, heat]);

  const tlOption = useMemo<EChartsOption | null>(() => {
    const items = (data?.timeline ?? []).filter((t) => t.year);
    if (items.length < 1) return null;
    return {
      tooltip: {
        ...tooltip,
        formatter: (p: unknown) => {
          const it = items[(p as { dataIndex: number }).dataIndex];
          return `<b>${it.label} · ${it.year}</b><br/>${truncate(it.title, 60)}${it.note ? `<br/><span style="opacity:.7">${truncate(it.note, 80)}</span>` : ""}`;
        },
      },
      grid: { left: 30, right: 30, top: 40, bottom: 30 },
      xAxis: { type: "value", min: (v: { min: number }) => v.min - 1, max: (v: { max: number }) => v.max + 1, minInterval: 1, splitLine: { show: false } },
      yAxis: { type: "value", show: false, min: -1, max: items.length },
      series: [
        {
          type: "scatter",
          symbolSize: 18,
          data: items.map((it, i) => ({ value: [it.year!, i], itemStyle: { color: PALETTE[i % PALETTE.length] } })),
          label: { show: true, position: "right", formatter: (p: unknown) => `${items[(p as { dataIndex: number }).dataIndex].label}  ${truncate(items[(p as { dataIndex: number }).dataIndex].title, 40)}`, fontSize: 11 },
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, PALETTE, heat]);

  if (isLoading && !data) return <div className="flex justify-center py-20"><Spinner className="size-6" /></div>;
  if (!data) return null;

  const nothing = !barOptions.length && !radarOption && !simOption && !tlOption;
  if (nothing) return <GlassPanel><Empty icon={<BarChart3 />} title={d.insights.empty} sub={d.insights.emptySub} /></GlassPanel>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {data.papers.map((p, i) => (
          <span key={p.id} className="glass-thin inline-flex max-w-xs items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-xs">
            <span className="rounded-full px-2 py-0.5 font-bold text-white" style={{ background: PALETTE[i % PALETTE.length] }}>
              {p.label}
            </span>
            <span className="truncate">{p.title}</span>
          </span>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {barOptions.length > 0 && (
          <Card title={d.insights.bars} icon={<BarChart3 />} chartRef={barRef} span={barOptions.length > 1}>
            <div className={barOptions.length > 1 ? "grid gap-4 md:grid-cols-2" : ""}>
              {barOptions.map((o, i) => (
                <Chart key={i} ref={i === 0 ? barRef : undefined} option={o} height={280} />
              ))}
            </div>
          </Card>
        )}
        <Card title={d.insights.radar} icon={<Radar />} chartRef={radarOption ? radarRef : undefined}>
          {radarOption ? <Chart ref={radarRef} option={radarOption} height={340} /> : <p className="py-16 text-center text-[13px] text-muted">{d.insights.needRadar}</p>}
        </Card>
        {simOption && (
          <Card title={d.insights.similarity} icon={<Grid3x3 />} chartRef={simRef}>
            <Chart ref={simRef} option={simOption} height={340} />
          </Card>
        )}
        {tlOption && (
          <Card title={d.insights.timeline} icon={<GitCommitHorizontal />} chartRef={tlRef} span>
            <Chart ref={tlRef} option={tlOption} height={Math.max(200, data.timeline.length * 44 + 80)} />
          </Card>
        )}
      </div>
    </div>
  );
}
