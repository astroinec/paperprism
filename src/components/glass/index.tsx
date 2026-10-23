"use client";

import { forwardRef, useCallback, useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/shared/utils";

/* ---------------- Panel ---------------- */
type PanelProps = HTMLAttributes<HTMLDivElement> & { variant?: "thin" | "regular" | "thick"; spotlight?: boolean; running?: boolean };

export const GlassPanel = forwardRef<HTMLDivElement, PanelProps>(function GlassPanel(
  { variant = "regular", spotlight, running, className, onPointerMove, ...rest },
  ref,
) {
  const move = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (spotlight) {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }
      onPointerMove?.(e);
    },
    [spotlight, onPointerMove],
  );
  return (
    <div
      ref={ref}
      onPointerMove={move}
      className={cn(variant === "thin" ? "glass-thin" : variant === "thick" ? "glass-thick" : "glass", spotlight && "spotlight", running && "running-border", "rounded-3xl", className)}
      {...rest}
    />
  );
});

/* ---------------- Button ---------------- */
type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "tinted";
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode };

const BTN: Record<BtnVariant, string> = {
  primary: "btn-primary active:brightness-95",
  secondary: "glass-thin hover:bg-[var(--hover)] text-[rgb(var(--fg))]",
  ghost: "hover:bg-[var(--hover)] text-[rgb(var(--fg))]",
  danger: "btn-danger active:brightness-95",
  tinted: "bg-accent/12 text-accent hover:bg-accent/20 dark:bg-accent/20 dark:text-accent-soft",
};
const SIZE = { sm: "h-8 px-3 text-[13px] gap-1.5 rounded-xl", md: "h-9 px-4 text-sm gap-2 rounded-xl", lg: "h-11 px-5 text-[15px] gap-2 rounded-2xl" };

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        BTN[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ className, children, active, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-xl text-[rgb(var(--fg-muted))] transition-all hover:bg-[var(--hover)] hover:text-[rgb(var(--fg))] active:scale-95 disabled:opacity-40",
        active && "bg-[var(--hover)] text-[rgb(var(--fg))]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------- Inputs ---------------- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn("input-glass", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn("input-glass scroll-thin resize-none", className)} {...rest} />;
});

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "input-glass appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_0.7rem_center] bg-no-repeat pr-8",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-[13px] font-medium text-[rgb(var(--fg))]/85">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/* ---------------- Segmented control ---------------- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("glass-thin inline-flex rounded-2xl p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative z-0 inline-flex items-center gap-1.5 rounded-xl font-medium transition-colors",
            size === "sm" ? "h-7 px-3 text-xs" : "h-8 px-4 text-[13px]",
            value === o.value ? "text-[rgb(var(--fg))]" : "text-muted hover:text-[rgb(var(--fg))]",
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 -z-10 rounded-xl bg-white shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)] dark:bg-white/15"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Switch ---------------- */
export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-300 disabled:opacity-50",
        checked ? "bg-[#34c759]" : "bg-black/12 dark:bg-white/18",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={cn("block size-[22px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)]", checked ? "ml-auto" : "")}
      />
    </button>
  );
}

/* ---------------- Slider ---------------- */
export function Slider({ value, onChange, min = 0, max = 1, step = 0.01, className }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; className?: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        "h-1.5 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgb(0_0_0/0.25),0_0_0_0.5px_rgb(0_0_0/0.08)] [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white",
        className,
      )}
      style={{ background: `linear-gradient(90deg, var(--accent) ${pct}%, rgb(127 127 127 / 0.25) ${pct}%)` }}
    />
  );
}

/* ---------------- Badge ---------------- */
const BADGE = {
  gray: "bg-black/[0.05] text-[rgb(var(--fg-muted))] dark:bg-white/10",
  blue: "bg-accent/12 text-accent-strong dark:text-accent-soft",
  green: "bg-[#34c759]/15 text-[#1f8f3c] dark:text-[#5ee07f]",
  orange: "bg-[#ff9f0a]/15 text-[#b86e00] dark:text-[#ffc15a]",
  red: "bg-[#ff3b30]/12 text-[#d42a20] dark:text-[#ff7a72]",
  purple: "bg-[#bf5af2]/14 text-[#9a3ccc] dark:text-[#d891ff]",
};
export function Badge({ color = "gray", className, children, ...rest }: HTMLAttributes<HTMLSpanElement> & { color?: keyof typeof BADGE }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", BADGE[color], className)} {...rest}>
      {children}
    </span>
  );
}

/* ---------------- Misc ---------------- */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin text-accent", className)} />;
}

export function Empty({ icon, title, sub, action, className }: { icon?: ReactNode; title: ReactNode; sub?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      {icon && (
        <div className="glass-thin mb-4 flex size-16 items-center justify-center rounded-[22px] text-accent [&_svg]:size-7">{icon}</div>
      )}
      <div className="text-[15px] font-semibold">{title}</div>
      {sub && <div className="mt-1 max-w-sm text-[13px] text-muted">{sub}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-line bg-[var(--hover)] px-1.5 py-0.5 font-mono text-[10px] text-muted">{children}</kbd>;
}
