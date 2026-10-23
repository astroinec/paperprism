"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/shared/utils";
import { IconButton } from "./index";

const noopSubscribe = () => () => {};
/** false during SSR and hydration, true afterwards — safe gate for portals. */
export function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEsc(open, onClose);
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[6px] dark:bg-black/45" onClick={onClose} />
          <motion.div
            role="dialog"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={cn("glass-thick relative flex max-h-[88vh] w-full flex-col rounded-[28px]", width)}
          >
            {title && (
              <div className="flex items-center justify-between px-6 pt-5 pb-2">
                <div className="text-[17px] font-semibold tracking-tight">{title}</div>
                <IconButton onClick={onClose} aria-label="close">
                  <X className="size-4" />
                </IconButton>
              </div>
            )}
            <div className="scroll-thin relative z-[2] min-h-0 flex-1 overflow-y-auto px-6 py-3">{children}</div>
            {footer && <div className="relative z-[2] flex items-center justify-end gap-2 px-6 pt-2 pb-5">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, width = "w-[460px]" }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; width?: string }) {
  useEsc(open, onClose);
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            initial={{ x: "105%", opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "105%", opacity: 0.6 }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className={cn("glass-thick fixed top-3 right-3 bottom-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-col rounded-[28px]", width)}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
              <div className="min-w-0 flex-1 text-[15px] font-semibold">{title}</div>
              <IconButton onClick={onClose} aria-label="close">
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="scroll-thin relative z-[2] min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
