"use client";

import * as React from "react";
import { ArrowLeft, CalendarCheck, ChevronLeft, ChevronRight, CircleAlert, Clock, Globe, LoaderCircle, Phone, Video, Link2 } from "lucide-react";
import { addDays, formatDate, fromLocal, isoWeekday, localDateOf, type LocalDate } from "@/lib/availability/time";
import { cn } from "@/lib/utils";
import { groupedTimeZones } from "@/lib/time-zones";
import { Button } from "@/components/ui/button";

export interface WidgetEvent {
  slug: string;
  title: string;
  description: string;
  durationMin: number;
  locationKind: "google_meet" | "phone" | "custom";
  questions: { id: string; label: string; type: "text" | "textarea" | "select"; required: boolean; options?: string[] }[];
}

export interface WidgetOwner {
  username: string;
  displayName: string;
  image: string | null;
}

interface Props {
  owner: WidgetOwner;
  event: WidgetEvent;
  embed?: boolean;
  initialTopic?: string;
  /** When moving an existing booking: its manage token and a description of the current time. */
  reschedule?: { token: string; currentLabel: string; guestName: string; guestEmail?: string };
}

type Slot = { start: string; end: string };
type Step = "pick" | "details" | "done";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LOCATION = {
  google_meet: { icon: Video, label: "Google Meet" },
  phone: { icon: Phone, label: "Phone call" },
  custom: { icon: Link2, label: "Online" },
} as const;

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function monthStart(date: LocalDate): LocalDate {
  return { year: date.year, month: date.month, day: 1 };
}

function nextMonth(date: LocalDate): LocalDate {
  return date.month === 12 ? { year: date.year + 1, month: 1, day: 1 } : { year: date.year, month: date.month + 1, day: 1 };
}

function prevMonth(date: LocalDate): LocalDate {
  return date.month === 1 ? { year: date.year - 1, month: 12, day: 1 } : { year: date.year, month: date.month - 1, day: 1 };
}

function postToParent(message: Record<string, unknown>) {
  if (typeof window !== "undefined" && window.parent !== window) window.parent.postMessage(message, "*");
}

export function BookingWidget({ owner, event, embed = false, initialTopic, reschedule }: Props) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [timeZone, setTimeZone] = React.useState("UTC");
  const [hour12, setHour12] = React.useState(true);
  const [month, setMonth] = React.useState<LocalDate | null>(null);
  const [now, setNow] = React.useState<number | null>(null);
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("loading");
  const [errorText, setErrorText] = React.useState("");
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<Slot | null>(null);
  const [step, setStep] = React.useState<Step>("pick");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState("");
  const [result, setResult] = React.useState<{ locationUrl: string | null; manageUrl: string } | null>(null);

  // Guest time zone and clock format are only known in the browser.
  React.useEffect(() => {
    const zone = browserTimeZone();
    /* eslint-disable react-hooks/set-state-in-effect */
    setTimeZone(zone);
    setHour12(new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12 ?? true);
    const current = Date.now();
    setNow(current);
    setMonth(monthStart(localDateOf(current, zone)));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Load a month of slots whenever the month or zone changes.
  React.useEffect(() => {
    if (!month) return;
    const controller = new AbortController();
    const from = fromLocal({ ...month, hour: 0, minute: 0 }, timeZone) ?? Date.UTC(month.year, month.month - 1, 1);
    const end = nextMonth(month);
    const to = fromLocal({ ...end, hour: 0, minute: 0 }, timeZone) ?? Date.UTC(end.year, end.month - 1, 1);
    const params = new URLSearchParams({
      user: owner.username,
      event: event.slug,
      from: new Date(Math.max(from, Date.now())).toISOString(),
      to: new Date(to).toISOString(),
      tz: timeZone,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("loading");
    fetch(`/api/slots?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "Could not load availability");
        setSlots(body.slots ?? []);
        setStatus("idle");
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setSlots([]);
        setErrorText(error.message);
        setStatus("error");
      });
    return () => controller.abort();
  }, [month, timeZone, owner.username, event.slug]);

  // Embedded: tell the host page our height so its iframe can resize.
  React.useEffect(() => {
    if (!embed || !rootRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      postToParent({ type: "booking:height", height: Math.ceil(entry.contentRect.height) + 2 });
    });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [embed]);

  const slotsByDate = React.useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = formatDate(localDateOf(Date.parse(slot.start), timeZone));
      map.set(key, [...(map.get(key) ?? []), slot]);
    }
    return map;
  }, [slots, timeZone]);

  // Preselect the first day that has slots.
  React.useEffect(() => {
    if (status !== "idle") return;
    if (!selectedDate || !slotsByDate.has(selectedDate)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDate(slotsByDate.keys().next().value ?? null);
    }
  }, [status, slotsByDate, selectedDate]);

  const timeFormat = React.useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", hour12, timeZone }),
    [hour12, timeZone],
  );
  const longDate = React.useMemo(
    () => new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", timeZone }),
    [timeZone],
  );
  const monthLabel = month
    ? new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(month.year, month.month - 1, 1))
    : "";

  const timeZones = React.useMemo(() => (now === null ? [] : groupedTimeZones(now)), [now]);

  const today = now === null ? null : localDateOf(now, timeZone);
  const canGoBack = month && today ? formatDate(month) > formatDate(monthStart(today)) : false;
  const Location = LOCATION[event.locationKind];

  async function submit(form: HTMLFormElement) {
    if (!selectedSlot) return;
    const data = new FormData(form);
    const answers: Record<string, string> = {};
    for (const q of event.questions) answers[q.id] = String(data.get(`q_${q.id}`) ?? "");
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: owner.username,
          event: event.slug,
          start: selectedSlot.start,
          name: data.get("name"),
          email: data.get("email"),
          notes: data.get("notes") ?? "",
          timeZone,
          answers,
          website: data.get("website") ?? "",
          ...(reschedule ? { rescheduleToken: reschedule.token } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Booking failed. Please try another time.");
      setResult(body.manageUrl ? { locationUrl: body.locationUrl ?? null, manageUrl: body.manageUrl } : null);
      setStep("done");
      postToParent({ type: "booking:confirmed" });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Booking failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const summary = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {owner.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={owner.image} alt="" className="h-10 w-10 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent font-medium">
            {owner.displayName.slice(0, 1)}
          </span>
        )}
        <span className="text-sm text-muted">{owner.displayName}</span>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
      <ul className="flex flex-col gap-2 text-sm text-muted">
        <li className="flex items-center gap-2"><Clock className="h-4 w-4" aria-hidden />{event.durationMin} min</li>
        <li className="flex items-center gap-2"><Location.icon className="h-4 w-4" aria-hidden />{Location.label}</li>
        <li className="flex items-center gap-2"><Globe className="h-4 w-4" aria-hidden />{timeZone.replaceAll("_", " ")}</li>
      </ul>
      {event.description && <p className="text-sm leading-relaxed text-muted">{event.description}</p>}
      {selectedSlot && step !== "pick" && (
        <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-foreground">
          <CalendarCheck className="mr-2 inline h-4 w-4 text-accent" aria-hidden />
          {longDate.format(Date.parse(selectedSlot.start))}, {timeFormat.format(Date.parse(selectedSlot.start))} –{" "}
          {timeFormat.format(Date.parse(selectedSlot.end))}
        </p>
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={cn(
        "w-full rounded-card border border-border bg-surface shadow-sm",
        embed ? "border-0 shadow-none rounded-none" : "",
      )}
    >
      <div className="grid md:grid-cols-[280px_1fr]">
        <aside className="border-b border-border p-6 md:border-b-0 md:border-r md:p-8">{summary}</aside>

        <section className="p-6 md:p-8" aria-live="polite">
          {reschedule && step !== "done" && (
            <p className="mb-6 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm">
              Rescheduling your booking on <span className="font-medium">{reschedule.currentLabel}</span>. Pick a new time below.
            </p>
          )}
          {step === "pick" && (
            <div className="grid gap-8 lg:grid-cols-[1fr_220px] animate-fade-up">
              {/* Calendar */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-medium">{monthLabel || " "}</h2>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label="Previous month"
                      disabled={!canGoBack}
                      onClick={() => month && setMonth(prevMonth(month))}
                      className="rounded-full p-2 hover:bg-surface-muted disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Next month"
                      onClick={() => month && setMonth(nextMonth(month))}
                      className="rounded-full p-2 hover:bg-surface-muted"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
                  {WEEKDAYS.map((d) => (
                    <span key={d} className="py-2">{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1" role="grid" aria-busy={status === "loading"}>
                  {month &&
                    Array.from({ length: isoWeekday(month) - 1 }, (_, i) => <span key={`pad-${i}`} />)}
                  {month &&
                    Array.from({ length: 31 }, (_, i) => addDays(month, i))
                      .filter((d) => d.month === month.month)
                      .map((d) => {
                        const key = formatDate(d);
                        const available = slotsByDate.has(key);
                        const selected = key === selectedDate;
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={!available}
                            aria-pressed={selected}
                            aria-label={`${key}${available ? ", has available times" : ", unavailable"}`}
                            onClick={() => setSelectedDate(key)}
                            className={cn(
                              "aspect-square rounded-full text-sm transition",
                              available ? "font-medium text-foreground bg-accent-soft hover:ring-2 hover:ring-accent" : "text-muted/50",
                              selected && "bg-accent text-accent-foreground",
                              today !== null && key === formatDate(today) && !selected && "underline underline-offset-4",
                            )}
                          >
                            <span className="relative">
                              {d.day}
                              {available && !selected && (
                                <span className="absolute -bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" aria-hidden />
                              )}
                            </span>
                          </button>
                        );
                      })}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-2 text-muted">
                    <Globe className="h-4 w-4" aria-hidden />
                    <span className="sr-only">Time zone</span>
                    <select
                      value={timeZone}
                      onChange={(e) => {
                        setTimeZone(e.target.value);
                        setSelectedSlot(null);
                      }}
                      className="max-w-[220px] rounded-lg border border-border bg-surface px-2 py-1 text-foreground"
                    >
                      {timeZones.length === 0 && <option value={timeZone}>{timeZone.replaceAll("_", " ")}</option>}
                      {timeZones.map((g) => (
                        <optgroup key={g.region} label={g.region}>
                          {g.zones.map((z) => (
                            <option key={z.value} value={z.value}>{z.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <div className="flex overflow-hidden rounded-lg border border-border" role="group" aria-label="Clock format">
                    {[true, false].map((value) => (
                      <button
                        key={String(value)}
                        type="button"
                        aria-pressed={hour12 === value}
                        onClick={() => setHour12(value)}
                        className={cn("px-3 py-1", hour12 === value ? "bg-surface-muted text-foreground" : "text-muted")}
                      >
                        {value ? "12h" : "24h"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Slots */}
              <div className="flex flex-col">
                <h2 className="mb-4 font-medium">
                  {selectedDate ? longDate.format((fromLocal({ ...parseKey(selectedDate), hour: 12, minute: 0 }, timeZone) ?? 0)) : "Pick a date"}
                </h2>
                {status === "loading" && (
                  <div className="flex flex-col gap-2" aria-label="Loading available times">
                    {Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className="h-11 animate-pulse rounded-xl bg-surface-muted" />
                    ))}
                  </div>
                )}
                {status === "error" && (
                  <p className="flex items-start gap-2 text-sm text-danger">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {errorText}
                  </p>
                )}
                {status === "idle" && slots.length === 0 && (
                  <p className="text-sm text-muted">No free times this month. Try the next one.</p>
                )}
                {status === "idle" && selectedDate && (
                  <ul className="flex max-h-[380px] flex-col gap-2 overflow-y-auto pr-1">
                    {(slotsByDate.get(selectedDate) ?? []).map((slot) => (
                      <li key={slot.start}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSlot(slot);
                            setStep("details");
                          }}
                          className="h-11 w-full rounded-xl border border-accent/40 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
                        >
                          {timeFormat.format(Date.parse(slot.start))}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {step === "details" && (
            <form
              className="flex max-w-lg flex-col gap-4 animate-fade-up"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(e.currentTarget);
              }}
            >
              <button type="button" onClick={() => setStep("pick")} className="flex items-center gap-2 self-start text-sm text-muted hover:text-foreground">
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back
              </button>
              <h2 className="text-xl font-semibold">{reschedule ? "Confirm the new time" : "Your details"}</h2>
              <Field label="Name" name="name" required autoComplete="name" defaultValue={reschedule?.guestName} />
              <Field label="Email" name="email" type="email" required autoComplete="email" defaultValue={reschedule?.guestEmail} />
              {event.questions.map((q) => (
                <Field key={q.id} label={q.label} name={`q_${q.id}`} required={q.required} kind={q.type} options={q.options} />
              ))}
              <Field label="What would you like to discuss?" name="notes" kind="textarea" defaultValue={initialTopic} />
              {/* Honeypot for bots */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
              {submitError && (
                <p className="flex items-start gap-2 text-sm text-danger" role="alert">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {submitError}
                </p>
              )}
              <Button type="submit" size="lg" disabled={submitting} className="self-start">
                {submitting && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
                {reschedule ? "Move booking" : "Confirm booking"}
              </Button>
            </form>
          )}

          {step === "done" && selectedSlot && (
            <div className="flex flex-col items-start gap-4 animate-fade-up">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground animate-pop">
                <CalendarCheck className="h-7 w-7" aria-hidden />
              </span>
              <h2 className="text-2xl font-semibold">{reschedule ? "Your booking was moved" : "You're booked"}</h2>
              <p className="text-muted">
                {longDate.format(Date.parse(selectedSlot.start))}, {timeFormat.format(Date.parse(selectedSlot.start))}. A calendar
                invite is on its way to your inbox.
              </p>
              {result?.locationUrl && (
                <a href={result.locationUrl} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-accent hover:underline">
                  {result.locationUrl}
                </a>
              )}
              <div className="flex flex-wrap gap-2">
                <a
                  href={googleCalendarUrl(event.title, owner.displayName, selectedSlot, result?.locationUrl ?? null)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-border px-4 py-2 text-sm hover:border-accent/60"
                >
                  Add to Google Calendar
                </a>
                <a
                  href={outlookUrl(event.title, owner.displayName, selectedSlot, result?.locationUrl ?? null)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-border px-4 py-2 text-sm hover:border-accent/60"
                >
                  Add to Outlook
                </a>
              </div>
              {result?.manageUrl && (
                <a href={result.manageUrl} target={embed ? "_blank" : undefined} rel="noopener" className="text-sm text-muted underline underline-offset-4 hover:text-foreground">
                  Need to change it? Reschedule or cancel
                </a>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function parseKey(key: string): LocalDate {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

function Field({
  label,
  name,
  kind = "text",
  options,
  ...props
}: {
  label: string;
  name: string;
  kind?: "text" | "textarea" | "select";
  options?: string[];
} & React.InputHTMLAttributes<HTMLInputElement> & { defaultValue?: string }) {
  const classes = "w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted focus:border-accent outline-none";
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      <span>
        {label}
        {props.required && <span className="text-accent"> *</span>}
      </span>
      {kind === "textarea" ? (
        <textarea name={name} rows={4} required={props.required} defaultValue={props.defaultValue} maxLength={2000} className={cn(classes, "resize-none")} />
      ) : kind === "select" ? (
        <select name={name} required={props.required} className={classes} defaultValue="">
          <option value="" disabled>Choose…</option>
          {options?.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <input name={name} maxLength={254} className={classes} {...props} />
      )}
    </label>
  );
}

function googleCalendarUrl(title: string, host: string, slot: Slot, location: string | null) {
  const fmt = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${title} with ${host}`,
    dates: `${fmt(slot.start)}/${fmt(slot.end)}`,
    ...(location ? { location, details: `Join: ${location}` } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function outlookUrl(title: string, host: string, slot: Slot, location: string | null) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: `${title} with ${host}`,
    startdt: slot.start,
    enddt: slot.end,
    ...(location ? { location, body: `Join: ${location}` } : {}),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}
