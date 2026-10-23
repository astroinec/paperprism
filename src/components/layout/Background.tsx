"use client";

import type { CSSProperties } from "react";

const blob = (c: string, pos: CSSProperties, size: string, anim: string): { style: CSSProperties } => ({
  style: { background: c, width: size, height: size, animation: anim, ...pos },
});

/** Skin-aware wallpaper: soft blobs for colour, crisp ribbons + ring so glass has edges to frost. */
export function Wallpaper() {
  const b1 = blob("var(--wp-1)", { top: "-14%", left: "-10%" }, "54vw", "drift-a 34s ease-in-out infinite");
  const b2 = blob("var(--wp-2)", { top: "28%", right: "-14%" }, "48vw", "drift-b 40s ease-in-out infinite");
  const b3 = blob("var(--wp-3)", { bottom: "-22%", left: "16%" }, "46vw", "drift-c 46s ease-in-out infinite");
  const b4 = blob("var(--wp-4)", { top: "6%", left: "40%" }, "26vw", "drift-b 30s ease-in-out infinite reverse");
  return (
    <div className="wp">
      <div className="wp-layer">
        <div className="wp-blob" {...b1} />
        <div className="wp-blob" {...b2} />
        <div className="wp-blob" {...b3} />
        <div className="wp-blob" {...b4} />
        <div
          className="wp-ribbon"
          style={{
            top: "18%",
            left: "-8%",
            width: "70vw",
            height: "9vw",
            ["--r" as string]: "-18deg",
            background: "linear-gradient(90deg, transparent, var(--wp-1), var(--wp-2), transparent)",
            animation: "sway 28s ease-in-out infinite",
          }}
        />
        <div
          className="wp-ribbon"
          style={{
            bottom: "12%",
            right: "-10%",
            width: "64vw",
            height: "7vw",
            ["--r" as string]: "14deg",
            background: "linear-gradient(90deg, transparent, var(--wp-3), var(--wp-5), transparent)",
            animation: "sway 34s ease-in-out infinite reverse",
          }}
        />
        <div className="wp-ring" style={{ top: "52%", left: "6%", width: "30vw", height: "30vw", animation: "drift-c 52s ease-in-out infinite" }} />
        <div className="wp-ring" style={{ top: "-8%", right: "8%", width: "22vw", height: "22vw", animation: "drift-a 44s ease-in-out infinite reverse" }} />
      </div>
      <div className="wp-grain" />
    </div>
  );
}

export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Wallpaper />
    </div>
  );
}
