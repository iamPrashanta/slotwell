import { Copy, Mail, MessageCircle, Send } from "lucide-react";

/** Small decorative visuals for the feature grid. */

export function AvailabilityVisual() {
  const rows = [
    { day: "Mon", busy: [[10, 25], [55, 75]] },
    { day: "Tue", busy: [[30, 50]] },
    { day: "Wed", busy: [[5, 20], [40, 48], [70, 90]] },
    { day: "Thu", busy: [[20, 45]] },
  ];
  return (
    <div className="space-y-2.5" aria-hidden>
      {rows.map((r) => (
        <div key={r.day} className="flex items-center gap-3">
          <span className="w-8 text-[11px] text-muted">{r.day}</span>
          <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-emerald-500/10">
            {r.busy.map(([a, b]) => (
              <span key={a} className="absolute inset-y-0 rounded-md bg-surface-muted ring-1 ring-border" style={{ left: `${a}%`, width: `${b - a}%` }} />
            ))}
          </div>
        </div>
      ))}
      <div className="flex gap-4 pt-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-500/40" />Bookable</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-surface-muted ring-1 ring-border" />Busy in your calendar</span>
      </div>
    </div>
  );
}

export function TimeZoneVisual() {
  const zones = [
    ["London", "09:30"],
    ["New York", "04:30"],
    ["Kolkata", "15:00"],
    ["Tokyo", "18:30"],
  ];
  return (
    <ul className="grid grid-cols-2 gap-2" aria-hidden>
      {zones.map(([city, time], i) => (
        <li key={city} className={i === 2 ? "rounded-xl border border-accent/40 bg-accent-soft px-3 py-2" : "rounded-xl border border-border px-3 py-2"}>
          <span className="block text-[11px] text-muted">{city}</span>
          <span className="block font-mono text-sm font-medium">{time}</span>
        </li>
      ))}
    </ul>
  );
}

export function InviteVisual() {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 text-xs" aria-hidden>
      <div className="flex items-center gap-2 text-muted"><Mail className="h-3.5 w-3.5" /> Confirmed: Intro call</div>
      <p className="mt-2 font-medium">Thu, 15:00–15:30</p>
      <p className="mt-1 truncate font-mono text-[11px] text-accent">meet.google.com/abc-defg-hij</p>
      <div className="mt-3 flex gap-1.5">
        <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-medium text-white">Add to calendar</span>
        <span className="rounded-full border border-border px-2.5 py-1 text-[10px]">Reschedule</span>
      </div>
    </div>
  );
}

export function RulesVisual() {
  const rules = ["15 min buffer", "4 h notice", "Max 5 / day", "Fridays off", "60 days ahead"];
  return (
    <div className="flex flex-wrap gap-1.5" aria-hidden>
      {rules.map((r) => <span key={r} className="rounded-full border border-border px-3 py-1 text-[11px]">{r}</span>)}
    </div>
  );
}

export function EmbedVisual() {
  return (
    <pre className="overflow-hidden rounded-xl border border-border bg-background/60 p-3 font-mono text-[11px] leading-relaxed text-muted" aria-hidden>
      <span className="text-accent">&lt;iframe</span>{"\n"}  src=<span className="text-emerald-500">&quot;slotwell.app/embed/you/30min&quot;</span>{"\n"}  width=<span className="text-emerald-500">&quot;100%&quot;</span> height=<span className="text-emerald-500">&quot;700&quot;</span><span className="text-accent">&gt;</span>
    </pre>
  );
}

export function ShareVisual() {
  const items = [
    { icon: MessageCircle, label: "WhatsApp", cls: "text-[#25D366]" },
    { icon: Send, label: "Telegram", cls: "text-[#229ED9]" },
    { icon: Mail, label: "Email", cls: "text-accent" },
    { icon: Copy, label: "Copy link", cls: "text-muted" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2" aria-hidden>
      {items.map(({ icon: Icon, label, cls }) => (
        <span key={label} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs">
          <Icon className={`h-3.5 w-3.5 ${cls}`} /> {label}
        </span>
      ))}
    </div>
  );
}
