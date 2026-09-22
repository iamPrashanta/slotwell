"use client";

import * as React from "react";
import { Copy, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { addDateOverride, removeDateOverride, saveAvailability } from "@/app/dashboard/actions";
import { Card, SaveStatus, Switch, TimeSelect, inputClass } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { groupedTimeZones } from "@/lib/time-zones";
import { cn } from "@/lib/utils";

type Range = { start: string; end: string };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function WeeklyHoursEditor({
  initialRules,
  initialTimeZone,
}: {
  initialRules: { weekday: number; start: string; end: string }[];
  initialTimeZone: string;
}) {
  const [week, setWeek] = React.useState<Range[][]>(() =>
    DAYS.map((_, i) => initialRules.filter((r) => r.weekday === i + 1).map((r) => ({ start: r.start, end: r.end }))),
  );
  const [timeZone, setTimeZone] = React.useState(initialTimeZone);
  const [status, setStatus] = React.useState<{ kind: "idle" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const [pending, startTransition] = React.useTransition();
  const zones = React.useMemo(() => groupedTimeZones(), []);

  const update = (next: Range[][]) => {
    setWeek(next);
    setStatus({ kind: "idle" });
  };
  const setDay = (day: number, ranges: Range[]) => update(week.map((r, i) => (i === day ? ranges : r)));

  const totalHours = week.flat().reduce((sum, r) => sum + (toMin(r.end) - toMin(r.start)) / 60, 0);

  return (
    <Card
      title="Weekly hours"
      description={`${totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)} hours a week open for bookings.`}
      actions={
        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only">Time zone</span>
          <select className={cn(inputClass, "max-w-[240px] py-2")} value={timeZone} onChange={(e) => { setTimeZone(e.target.value); setStatus({ kind: "idle" }); }}>
            {zones.map((g) => (
              <optgroup key={g.region} label={g.region}>
                {g.zones.map((z) => (
                  <option key={z.value} value={z.value}>{z.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      }
    >
      <ul className="flex flex-col divide-y divide-border">
        {DAYS.map((day, i) => {
          const ranges = week[i];
          const on = ranges.length > 0;
          return (
            <li key={day} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start">
              <div className="flex w-40 shrink-0 items-center gap-3 pt-1.5">
                <Switch
                  checked={on}
                  label={`${day} available`}
                  onChange={(v) => setDay(i, v ? [{ start: "10:00", end: "18:00" }] : [])}
                />
                <span className={cn("text-sm font-medium", !on && "text-muted")}>{day}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {!on && <p className="pt-2 text-sm text-muted">Unavailable</p>}
                {ranges.map((range, j) => (
                  <div key={j} className="flex flex-wrap items-center gap-2">
                    <TimeSelect label={`${day} start`} value={range.start} onChange={(v) => setDay(i, ranges.map((r, k) => (k === j ? { ...r, start: v, end: r.end > v ? r.end : bump(v) } : r)))} />
                    <span className="text-muted">–</span>
                    <TimeSelect label={`${day} end`} value={range.end} min={range.start} onChange={(v) => setDay(i, ranges.map((r, k) => (k === j ? { ...r, end: v } : r)))} />
                    <button type="button" aria-label="Remove hours" onClick={() => setDay(i, ranges.filter((_, k) => k !== j))} className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                    {j === 0 && (
                      <>
                        <button type="button" aria-label={`Add hours on ${day}`} title="Add another range" onClick={() => setDay(i, [...ranges, nextRange(ranges)])} className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground">
                          <Plus className="h-4 w-4" />
                        </button>
                        <button type="button" aria-label={`Copy ${day} to all weekdays`} title="Copy to Mon–Fri" onClick={() => update(week.map((r, k) => (k < 5 ? ranges.map((x) => ({ ...x })) : r)))} className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground">
                          <Copy className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 flex items-center gap-4 border-t border-border pt-5">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveAvailability({
                timeZone,
                rules: week.flatMap((ranges, i) => ranges.map((r) => ({ weekday: i + 1, ...r }))),
              });
              setStatus(r.ok ? { kind: "saved" } : { kind: "error", message: r.error });
            })
          }
        >
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Save hours
        </Button>
        <SaveStatus state={status} />
      </div>
    </Card>
  );
}

export function DateOverridesEditor({
  overrides,
}: {
  overrides: { id: string; date: string; unavailable: boolean; start: string | null; end: string | null }[];
}) {
  const [date, setDate] = React.useState("");
  const [mode, setMode] = React.useState<"off" | "hours">("off");
  const [range, setRange] = React.useState<Range>({ start: "10:00", end: "14:00" });
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [today, setToday] = React.useState("");
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(new Date().toLocaleDateString("en-CA"));
  }, []);
  const label = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <Card title="Date overrides" description="Take a day off or set special hours for one date. Overrides replace your weekly hours.">
      <form
        className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 sm:flex-row sm:flex-wrap sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await addDateOverride({ date, unavailable: mode === "off", ...(mode === "hours" ? range : {}) });
            if (r.ok) {
              setDate("");
              setError("");
            } else setError(r.error);
          });
        }}
      >
        <input type="date" required min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={cn(inputClass, "sm:w-auto")} />
        <div className="inline-flex rounded-full border border-border p-1" role="group" aria-label="Override type">
          {(["off", "hours"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={cn("rounded-full px-3 py-1 text-sm", mode === m ? "bg-accent text-accent-foreground" : "text-muted")}>
              {m === "off" ? "Day off" : "Custom hours"}
            </button>
          ))}
        </div>
        {mode === "hours" && (
          <div className="flex items-center gap-2">
            <TimeSelect label="Start" value={range.start} onChange={(v) => setRange({ start: v, end: range.end > v ? range.end : bump(v) })} />
            <span className="text-muted">–</span>
            <TimeSelect label="End" value={range.end} min={range.start} onChange={(v) => setRange({ ...range, end: v })} />
          </div>
        )}
        <Button type="submit" size="sm" disabled={pending || !date}>
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />} Add
        </Button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

      {overrides.length > 0 ? (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {overrides.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">{label.format(new Date(`${o.date}T00:00:00Z`))}</p>
                <p className="text-sm text-muted">{o.unavailable ? "Day off" : `${o.start} – ${o.end}`}</p>
              </div>
              <button
                type="button"
                aria-label="Remove override"
                disabled={pending}
                onClick={() => startTransition(async () => void (await removeDateOverride(o.id)))}
                className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">No upcoming overrides.</p>
      )}
    </Card>
  );
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMin(m: number) {
  const c = Math.min(m, 1440);
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
}
function bump(t: string) {
  return fromMin(toMin(t) + 60);
}
function nextRange(ranges: Range[]): Range {
  const last = ranges.at(-1);
  const start = last ? Math.min(toMin(last.end) + 60, 1380) : 600;
  return { start: fromMin(start), end: fromMin(start + 60) };
}
