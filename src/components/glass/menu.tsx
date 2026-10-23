"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/shared/utils";

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  hint?: ReactNode;
}

export function Menu({
  trigger,
  items,
  align = "right",
  width = "w-56",
  children,
}: {
  trigger: (open: boolean) => ReactNode;
  items?: MenuItem[];
  align?: "left" | "right";
  width?: string;
  children?: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", h);
    window.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("keydown", k);
    };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <div ref={ref} className="relative inline-block">
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            style={{ transformOrigin: align === "right" ? "top right" : "top left" }}
            className={cn("glass-thick absolute top-[calc(100%+6px)] z-40 rounded-2xl p-1.5", align === "right" ? "right-0" : "left-0", width)}
          >
            <div className="relative z-[2]">
              {children
                ? children(close)
                : items?.map((it, i) =>
                    it.divider ? (
                      <div key={i} className="mx-2 my-1 h-px bg-[var(--line)]" />
                    ) : (
                      <button
                        key={i}
                        disabled={it.disabled}
                        onClick={() => {
                          it.onClick?.();
                          close();
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[var(--hover)] disabled:opacity-40",
                          it.danger && "text-[#ff3b30]",
                        )}
                      >
                        {it.icon && <span className="text-muted [&_svg]:size-4">{it.icon}</span>}
                        <span className="flex-1">{it.label}</span>
                        {it.hint && <span className="text-xs text-muted">{it.hint}</span>}
                      </button>
                    ),
                  )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
