import { CalendarCheck, Check, ChevronLeft, ChevronRight, Clock, Globe, Video } from "lucide-react";

/** Static, decorative product preview for the landing page (not interactive). */
export function BookingPreview({ now }: { now: number }) {
  const today = new Date(now);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const todayNum = today.getUTCDate();
  const selected = Math.min(daysInMonth, todayNum + 2);
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const isAvailable = (d: number) => {
    const wd = (lead + d - 1) % 7;
    return d >= todayNum && wd < 5;
  };
  const slots = ["09:30", "10:00", "11:30", "14:00", "15:30", "16:00"];

  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(closest-side,rgba(161,0,255,0.28),transparent)] blur-2xl" />

      <div role="img" aria-label="Preview of a Slotwell booking page" className="overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-2xl shadow-black/40">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" /><span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" /><span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 truncate rounded-full bg-surface-muted px-3 py-1 font-mono text-[11px] text-muted">slotwell.app/alex/intro-call</span>
        </div>

        <div className="grid sm:grid-cols-[0.9fr_1.4fr]">
          <div className="flex items-center gap-3 border-b border-border p-5 sm:block sm:border-b-0 sm:border-r">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">AR</span>
            <div className="sm:mt-3">
              <p className="text-xs text-muted">Alex Rivera</p>
              <p className="text-lg font-semibold leading-tight">Intro call</p>
            </div>
            <ul className="ml-auto space-y-1 text-xs text-muted sm:ml-0 sm:mt-4 sm:space-y-2">
              <li className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" aria-hidden /> 30 min</li>
              <li className="flex items-center gap-2"><Video className="h-3.5 w-3.5" aria-hidden /> Google Meet</li>
              <li className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" aria-hidden /> Your time zone</li>
            </ul>
          </div>

          <div className="p-5">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-medium">{monthLabel}</span>
              <span className="flex gap-1 text-muted"><ChevronLeft className="h-4 w-4" aria-hidden /><ChevronRight className="h-4 w-4" aria-hidden /></span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-muted">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <span key={d}>{d}</span>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1 text-center text-xs">
              {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const sel = d === selected;
                const avail = isAvailable(d);
                return (
                  <span
                    key={d}
                    className={
                      sel
                        ? "mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-accent font-semibold text-white"
                        : avail
                          ? "mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft font-medium text-accent"
                          : "mx-auto flex h-7 w-7 items-center justify-center text-muted/60"
                    }
                  >
                    {d}
                  </span>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {slots.map((s, i) => (
                <span
                  key={s}
                  className={
                    i === 2
                      ? "rounded-lg border border-accent bg-accent py-1.5 text-center text-xs font-medium text-white"
                      : "rounded-lg border border-border py-1.5 text-center text-xs text-foreground/80"
                  }
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* floating confirmation */}
      <div className="absolute -bottom-6 -left-4 hidden items-center gap-3 sm:flex rounded-2xl border border-border bg-surface/95 px-4 py-3 shadow-xl shadow-black/30 backdrop-blur sm:-left-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"><Check className="h-4 w-4" aria-hidden /></span>
        <span className="text-xs">
          <span className="block font-medium">Booking confirmed</span>
          <span className="block text-muted">Invite + Meet link sent</span>
        </span>
      </div>
      <div className="absolute -right-3 -top-4 hidden items-center gap-2 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur sm:flex">
        <CalendarCheck className="h-3.5 w-3.5 text-accent" aria-hidden /> Synced with Google Calendar
      </div>
    </div>
  );
}
