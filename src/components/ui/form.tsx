"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50";

export function Label({ children, hint, htmlFor }: { children: React.ReactNode; hint?: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1">
      <span className="text-sm font-medium text-foreground">{children}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const id = React.useId();
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} hint={hint}>{label}</Label>
      {React.isValidElement<{ id?: string }>(children) ? React.cloneElement(children, { id }) : children}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50",
        checked ? "bg-accent" : "bg-surface-muted border border-border",
      )}
    >
      <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

export function Card({ title, description, children, actions }: { title?: string; description?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-card border border-border bg-surface">
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 md:px-6">
          <div>
            {title && <h2 className="font-medium">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

/** Small "Saved" / error status line used next to form buttons. */
export function SaveStatus({ state }: { state: { kind: "idle" | "saved" | "error"; message?: string } }) {
  if (state.kind === "idle") return null;
  return (
    <p role="status" className={cn("text-sm animate-fade-up", state.kind === "error" ? "text-danger" : "text-muted")}>
      {state.kind === "saved" ? "✓ Saved" : state.message}
    </p>
  );
}

/** 15-minute time options "00:00" … "24:00" with friendly labels. */
export const TIME_OPTIONS = Array.from({ length: 97 }, (_, i) => {
  const minutes = i * 15;
  const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const h = Math.floor(minutes / 60) % 24;
  const label = minutes === 1440 ? "Midnight" : `${h % 12 === 0 ? 12 : h % 12}:${String(minutes % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  return { value, label };
});

export function TimeSelect({ value, onChange, label, min }: { value: string; onChange: (v: string) => void; label: string; min?: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputClass, "w-auto py-2 pr-8")}>
      {TIME_OPTIONS.filter((o) => (min ? o.value > min : o.value < "24:00")).map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
