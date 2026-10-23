"use client";

import { useCallback, useRef, useState } from "react";
import type { KeyedMutator } from "swr";
import { api } from "@/lib/client/api";
import type { Cell, ProjectDetail } from "@/lib/shared/types";

export type RunMode = "missing" | "all" | "failed";

export function useExtraction(project: ProjectDetail | undefined, mutate: KeyedMutator<ProjectDetail>, concurrency: number, lang: "zh" | "en", onError: (m: string) => void) {
  const [runningCells, setRunningCells] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);

  const merge = useCallback(
    (cells: Cell[]) =>
      mutate((p) => {
        if (!p) return p;
        const key = (c: Cell) => `${c.paperId}:${c.dimensionId}`;
        const map = new Map(p.cells.map((c) => [key(c), c]));
        cells.forEach((c) => map.set(key(c), c));
        return { ...p, cells: [...map.values()] };
      }, false),
    [mutate],
  );

  const runJobs = useCallback(
    async (jobs: { paperId: string; dimensionIds: string[] }[]) => {
      if (!project || !jobs.length) return;
      stopRef.current = false;
      const allKeys = jobs.flatMap((j) => j.dimensionIds.map((d) => `${j.paperId}:${d}`));
      setRunningCells((s) => new Set([...s, ...allKeys]));
      setProgress({ done: 0, total: jobs.length });
      let idx = 0;
      let done = 0;
      let firstError: string | null = null;
      const worker = async () => {
        while (idx < jobs.length && !stopRef.current) {
          const job = jobs[idx++];
          try {
            const res = await api<{ cells: Cell[] }>(`/api/projects/${project.id}/extract`, "POST", { ...job, lang });
            await merge(res.cells);
            const err = res.cells.find((c) => c.status === "error");
            if (err && !firstError) firstError = err.error;
          } catch (e) {
            if (!firstError) firstError = (e as Error).message;
          } finally {
            done++;
            setProgress({ done, total: jobs.length });
            setRunningCells((s) => {
              const n = new Set(s);
              job.dimensionIds.forEach((d) => n.delete(`${job.paperId}:${d}`));
              return n;
            });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, jobs.length)) }, worker));
      setRunningCells((s) => {
        const n = new Set(s);
        allKeys.forEach((k) => n.delete(k));
        return n;
      });
      setProgress(null);
      if (firstError) onError(firstError);
      mutate();
    },
    [project, concurrency, lang, merge, mutate, onError],
  );

  const run = useCallback(
    (mode: RunMode) => {
      if (!project) return;
      const jobs = project.papers
        .map((p) => {
          const dimensionIds = project.dimensions
            .filter((d) => {
              const c = project.cells.find((x) => x.paperId === p.id && x.dimensionId === d.id);
              if (mode === "all") return !c?.edited;
              if (mode === "failed") return c?.status === "error";
              return !c || c.status === "error";
            })
            .map((d) => d.id);
          return { paperId: p.id, dimensionIds };
        })
        .filter((j) => j.dimensionIds.length);
      return runJobs(jobs);
    },
    [project, runJobs],
  );

  const runOne = useCallback((paperId: string, dimensionIds: string[]) => runJobs([{ paperId, dimensionIds }]), [runJobs]);

  const stop = useCallback(() => {
    stopRef.current = true;
  }, []);

  return { run, runOne, stop, runningCells, progress, running: runningCells.size > 0 };
}
