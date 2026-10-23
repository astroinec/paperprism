export type SkinId = "aurora" | "frost" | "sunset" | "forest" | "paper" | "obsidian";

export const SKIN_IDS: SkinId[] = ["aurora", "frost", "sunset", "forest", "paper", "obsidian"];
export const DEFAULT_SKIN: SkinId = "aurora";

/** Mirrors the accent tokens in globals.css (canvas charts cannot read CSS variables). */
const ACCENT: Record<SkinId, { light: [string, string]; dark: [string, string] }> = {
  aurora: { light: ["#0a84ff", "#5e5ce6"], dark: ["#0a84ff", "#7d7aff"] },
  frost: { light: ["#4f6bed", "#8b6bea"], dark: ["#7c93ff", "#a98bff"] },
  sunset: { light: ["#f2543d", "#c74bd6"], dark: ["#ff6a50", "#d96bff"] },
  forest: { light: ["#0e9f6e", "#1aa7b8"], dark: ["#19c08a", "#2ec4d6"] },
  paper: { light: ["#c4573a", "#b8860b"], dark: ["#e0714f", "#d9a21b"] },
  obsidian: { light: ["#6a4cff", "#00a8c8"], dark: ["#7c5cff", "#00d0ff"] },
};

const EXTRA = ["#30d158", "#ff9f0a", "#64d2ff", "#bf5af2", "#ff375f", "#ffd60a", "#ac8e68", "#00c7be"];

export function isSkin(v: unknown): v is SkinId {
  return typeof v === "string" && (SKIN_IDS as string[]).includes(v);
}

export function chartPalette(skin: SkinId, dark: boolean): string[] {
  const [a, b] = ACCENT[skin][dark ? "dark" : "light"];
  return [a, b, ...EXTRA];
}

export function heatRamp(skin: SkinId, dark: boolean): string[] {
  const [a, b] = ACCENT[skin][dark ? "dark" : "light"];
  return [dark ? "#1b1e2a" : "#f4f6fb", a + "80", a, b];
}

export function exportBackground(dark: boolean) {
  return dark ? "#16181f" : "#ffffff";
}
