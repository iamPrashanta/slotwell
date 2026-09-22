import { cn } from "@/lib/utils";

/** Slotwell mark: a rounded square cut by one slot, with a booked dot. */
export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-foreground", className)}>
      <svg viewBox="0 0 64 64" aria-hidden className="h-7 w-7">
        <rect x="4" y="4" width="56" height="56" rx="16" fill="none" stroke="var(--accent)" strokeWidth="4" />
        <rect x="14" y="29" width="30" height="6" rx="3" fill="currentColor" />
        <circle cx="50" cy="32" r="5" fill="var(--accent)" />
      </svg>
      {withWordmark && <span className="text-lg font-medium tracking-tight">slotwell</span>}
    </span>
  );
}
