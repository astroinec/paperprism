"use client";

import { Languages, Monitor, Moon, Sun } from "lucide-react";
import { IconButton } from "@/components/glass";
import { usePrefs, type Theme } from "@/lib/client/prefs";
import { ModelSwitcher } from "./ModelSwitcher";

export function TopBar() {
  const { prefs, setPrefs } = usePrefs();
  const nextTheme: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
  const ThemeIcon = prefs.theme === "light" ? Sun : prefs.theme === "dark" ? Moon : Monitor;
  return (
    <div className="pointer-events-none sticky top-3 z-20 flex justify-end px-1">
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-full p-1 pl-1">
        <div className="relative z-[2] flex items-center gap-1">
          <ModelSwitcher />
          <IconButton title="Language" onClick={() => setPrefs({ lang: prefs.lang === "zh" ? "en" : "zh" })} className="rounded-full">
            <Languages className="size-4" />
          </IconButton>
          <IconButton title={prefs.theme} onClick={() => setPrefs({ theme: nextTheme[prefs.theme] })} className="rounded-full">
            <ThemeIcon className="size-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
