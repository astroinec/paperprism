"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { ECharts, EChartsOption } from "echarts";
import { usePrefs } from "@/lib/client/prefs";
import { exportBackground } from "@/lib/client/skins";

export interface ChartHandle {
  toDataURL: () => string | null;
}

export const Chart = forwardRef<ChartHandle, { option: EChartsOption; height?: number }>(function Chart({ option, height = 320 }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const inst = useRef<ECharts | null>(null);
  const { resolvedTheme } = usePrefs();

  useImperativeHandle(ref, () => ({
    toDataURL: () => inst.current?.getDataURL({ pixelRatio: 2, backgroundColor: exportBackground(resolvedTheme === "dark") }) ?? null,
  }));

  useEffect(() => {
    let disposed = false;
    let ro: ResizeObserver | null = null;
    import("echarts").then((echarts) => {
      if (disposed || !el.current) return;
      inst.current = echarts.init(el.current, resolvedTheme === "dark" ? "dark" : undefined, { renderer: "canvas" });
      inst.current.setOption({ backgroundColor: "transparent", ...option });
      ro = new ResizeObserver(() => inst.current?.resize());
      ro.observe(el.current);
    });
    return () => {
      disposed = true;
      ro?.disconnect();
      inst.current?.dispose();
      inst.current = null;
    };
  }, [resolvedTheme]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    inst.current?.setOption({ backgroundColor: "transparent", ...option }, true);
  }, [option]);

  return <div ref={el} style={{ height }} className="w-full" />;
});
