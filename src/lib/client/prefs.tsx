"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { zh, type Dict } from "./dict/zh";
import { en } from "./dict/en";
import { PREFS_BOOT_SCRIPT, PREFS_KEY } from "./boot";
import { DEFAULT_SKIN, isSkin, type SkinId } from "./skins";

export type Lang = "zh" | "en";
export type Theme = "light" | "dark" | "system";

export interface Prefs {
  lang: Lang;
  theme: Theme;
  glass: number;
  skin: SkinId;
  reduceTransparency: boolean;
  reduceMotion: boolean;
  outputLang: Lang;
}

export const DEFAULT_PREFS: Prefs = {
  lang: "zh",
  theme: "system",
  glass: 0.6,
  skin: DEFAULT_SKIN,
  reduceTransparency: false,
  reduceMotion: false,
  outputLang: "zh",
};

const KEY = PREFS_KEY;
export { PREFS_BOOT_SCRIPT };

interface Ctx {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  d: Dict;
  lang: Lang;
  resolvedTheme: "light" | "dark";
}

const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<Prefs>(DEFAULT_PREFS);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      setState({ ...DEFAULT_PREFS, ...saved, skin: isSkin(saved.skin) ? saved.skin : DEFAULT_SKIN });
    } catch {
      /* ignore */
    }
    const mq = matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const resolvedTheme = prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;

  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("dark", resolvedTheme === "dark");
    el.style.setProperty("--glass-strength", String(prefs.glass));
    el.dataset.skin = prefs.skin;
    el.dataset.reduceTransparency = String(prefs.reduceTransparency);
    el.dataset.reduceMotion = String(prefs.reduceMotion);
    el.lang = prefs.lang === "en" ? "en" : "zh-CN";
  }, [prefs, resolvedTheme]);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setState((prev) => {
      const next = { ...prev, ...p };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ prefs, setPrefs, d: prefs.lang === "en" ? en : zh, lang: prefs.lang, resolvedTheme }),
    [prefs, setPrefs, resolvedTheme],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const c = useContext(PrefsContext);
  if (!c) throw new Error("PrefsProvider missing");
  return c;
}

export function fmt(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
