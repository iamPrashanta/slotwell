import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function formatDateTime(value: string | null, timeZone: string, opts: { withYear?: boolean } = {}) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", ...(opts.withYear ? { year: "numeric" } : {}),
    hour: "2-digit", minute: "2-digit", timeZone,
  }).format(new Date(value));
}

export function formatDate(value: string | null, timeZone: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(value));
}

/** "3 min ago" style label, computed on the server at request time. */
export function timeAgo(value: string | null, now: number) {
  if (!value) return "never";
  const s = Math.max(0, Math.round((now - new Date(value).getTime()) / 1000));
  if (s < 60) return "just now";
  const units: [number, string][] = [[60, "min"], [3600, "h"], [86400, "d"], [2592000, "mo"], [31536000, "y"]];
  let label = `${Math.floor(s / 60)} min`;
  for (let i = units.length - 1; i >= 0; i--) {
    if (s >= units[i][0]) {
      label = `${Math.floor(s / units[i][0])} ${units[i][1]}`;
      break;
    }
  }
  return `${label} ago`;
}

export function Avatar({ name, image, size = "md" }: { name: string; image?: string | null; size?: "sm" | "md" | "lg" }) {
  const initials = (name || "?").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const cls = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" }[size];
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" referrerPolicy="no-referrer" className={cn("shrink-0 rounded-full object-cover", cls)} />
  ) : (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent", cls)} aria-hidden>{initials}</span>
  );
}

const tones = {
  neutral: "border-border bg-surface-muted text-muted",
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  bad: "border-danger/30 bg-danger/10 text-danger",
  accent: "border-accent/30 bg-accent-soft text-accent",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function StatTile({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "warn" | "bad" }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 md:p-5">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums tracking-tight", tone === "warn" && "text-amber-500", tone === "bad" && "text-danger")}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-card border border-border bg-surface", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </div>
      <div className="p-2 md:p-3">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-8 text-center text-sm text-muted">{children}</p>;
}

/** Filter bar as a plain GET form: works without JavaScript and keeps state in the URL. */
export function FilterBar({ q, placeholder, children }: { q: string; placeholder: string; children?: React.ReactNode }) {
  return (
    <form method="get" className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
      <label className="relative flex-1">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={100}
          placeholder={placeholder}
          className="h-10 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-sm outline-none transition focus:border-accent"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <button type="submit" className="h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground hover:opacity-90">Apply</button>
      </div>
    </form>
  );
}

export function FilterSelect({ name, value, options, label }: { name: string; value: string; options: [string, string][]; label: string }) {
  return (
    <select name={name} defaultValue={value} aria-label={label}
      className="h-10 rounded-full border border-border bg-surface px-4 pr-8 text-sm outline-none focus:border-accent">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Pagination({ page, total, pageSize, params }: { page: number; total: number; pageSize: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `?${s}` : "?";
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = "inline-flex h-9 items-center gap-1 rounded-full border border-border px-3 text-sm transition hover:border-accent/60";
  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
      <span className="tabular-nums">{from}–{to} of {total}</span>
      <span className="flex gap-2">
        {page > 1 ? <Link className={btn} href={href(page - 1)}><ChevronLeft className="h-4 w-4" aria-hidden />Prev</Link> : <span className={cn(btn, "opacity-40")}><ChevronLeft className="h-4 w-4" aria-hidden />Prev</span>}
        {page < pages ? <Link className={btn} href={href(page + 1)}>Next<ChevronRight className="h-4 w-4" aria-hidden /></Link> : <span className={cn(btn, "opacity-40")}>Next<ChevronRight className="h-4 w-4" aria-hidden /></span>}
      </span>
    </div>
  );
}

/** Simple dual bar chart (signups + bookings per day). Pure CSS, no chart library. */
export function DailyBars({ data }: { data: { day: string; signups: number; bookings: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.signups, d.bookings)));
  const total = { signups: data.reduce((a, d) => a + d.signups, 0), bookings: data.reduce((a, d) => a + d.bookings, 0) };
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 px-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden />Bookings ({total.bookings})</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" aria-hidden />Sign-ups ({total.signups})</span>
      </div>
      <div className="flex h-40 items-end gap-[3px] px-2" role="img" aria-label={`Last 30 days: ${total.bookings} bookings, ${total.signups} sign-ups`}>
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end gap-px" title={`${d.day}: ${d.bookings} bookings, ${d.signups} sign-ups`}>
            <div className="w-1/2 rounded-t-sm bg-accent/80 transition group-hover:bg-accent" style={{ height: `${(d.bookings / max) * 100}%`, minHeight: d.bookings ? 3 : 0 }} />
            <div className="w-1/2 rounded-t-sm bg-amber-500/80 transition group-hover:bg-amber-500" style={{ height: `${(d.signups / max) * 100}%`, minHeight: d.signups ? 3 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between px-2 text-[11px] text-muted">
        <span>{data[0]?.day.slice(5)}</span><span>{data.at(-1)?.day.slice(5)}</span>
      </div>
    </div>
  );
}
