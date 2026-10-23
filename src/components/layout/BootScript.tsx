"use client";

import { PREFS_BOOT_SCRIPT } from "@/lib/client/boot";

/**
 * Runs during SSR HTML parsing (before first paint) to apply theme/glass prefs.
 * On the client it renders as text/plain so React 19 doesn't warn about inline scripts.
 */
export function BootScript() {
  return (
    <script
      suppressHydrationWarning
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }}
    />
  );
}
