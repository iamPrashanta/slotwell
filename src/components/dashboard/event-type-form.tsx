"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Clock, Link2, LoaderCircle, Phone, Plus, Trash2, Video } from "lucide-react";
import { deleteEventType, saveEventType, type EventTypeInput } from "@/app/dashboard/actions";
import { Card, Field, SaveStatus, Switch, inputClass } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Question = EventTypeInput["questions"][number];

const DURATIONS = [15, 30, 45, 60, 90];
const LOCATIONS = [
  { id: "google_meet", label: "Google Meet", hint: "A Meet link is created for each booking", icon: Video },
  { id: "phone", label: "Phone call", hint: "Ask for the guest's number in a question", icon: Phone },
  { id: "custom", label: "Custom link", hint: "Zoom, Teams or any URL you add", icon: Link2 },
] as const;
const NOTICE = [
  { value: 0, label: "No minimum" },
  { value: 60, label: "1 hour" },
  { value: 240, label: "4 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
];

const slugify = (value: string) =>
  value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 49) || "meeting";

export function EventTypeForm({ initial, publicBase }: { initial: EventTypeInput; publicBase: string }) {
  const router = useRouter();
  const [data, setData] = React.useState<EventTypeInput>(initial);
  const [slugTouched, setSlugTouched] = React.useState(Boolean(initial.id));
  const [status, setStatus] = React.useState<{ kind: "idle" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const [pending, startTransition] = React.useTransition();
  const isNew = !initial.id;

  const set = <K extends keyof EventTypeInput>(key: K, value: EventTypeInput[K]) => {
    setData((d) => ({ ...d, [key]: value }));
    setStatus({ kind: "idle" });
  };
  const setQuestion = (index: number, patch: Partial<Question>) =>
    set("questions", data.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  const moveQuestion = (index: number, dir: -1 | 1) => {
    const next = [...data.questions];
    const [q] = next.splice(index, 1);
    next.splice(index + dir, 0, q);
    set("questions", next);
  };

  function save() {
    startTransition(async () => {
      const result = await saveEventType(data);
      if (!result.ok) return setStatus({ kind: "error", message: result.error });
      setStatus({ kind: "saved" });
      if (isNew && result.id) router.replace(`/dashboard/event-types/${result.id}`);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="grid gap-6 lg:grid-cols-[1fr_280px]"
    >
      <div className="flex flex-col gap-6">
        <Card title="Basics">
          <div className="flex flex-col gap-5">
            <Field label="Title">
              <input
                className={inputClass}
                value={data.title}
                maxLength={120}
                required
                placeholder="Intro call"
                onChange={(e) => {
                  set("title", e.target.value);
                  if (!slugTouched) setData((d) => ({ ...d, title: e.target.value, slug: slugify(e.target.value) }));
                }}
              />
            </Field>
            <Field label="Link" hint={<span className="break-all">{publicBase}/<strong className="text-foreground">{data.slug || "…"}</strong></span>}>
              <input
                className={inputClass}
                value={data.slug}
                maxLength={49}
                required
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                }}
              />
            </Field>
            <Field label="Description" hint="Shown on the booking page. Say what the call is for.">
              <textarea
                className={cn(inputClass, "resize-y")}
                rows={3}
                maxLength={2000}
                value={data.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Duration</span>
              <div className="flex flex-wrap items-center gap-2">
                {DURATIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={data.durationMin === m}
                    onClick={() => set("durationMin", m)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm transition",
                      data.durationMin === m ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent/60",
                    )}
                  >
                    {m} min
                  </button>
                ))}
                <label className="flex items-center gap-2 text-sm text-muted">
                  or
                  <input
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    aria-label="Custom duration in minutes"
                    className={cn(inputClass, "w-24")}
                    value={data.durationMin}
                    onChange={(e) => set("durationMin", Number(e.target.value))}
                  />
                  min
                </label>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Location">
          <div className="grid gap-3 sm:grid-cols-3">
            {LOCATIONS.map(({ id, label, hint, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={data.locationKind === id}
                onClick={() => set("locationKind", id)}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition",
                  data.locationKind === id ? "border-accent bg-accent-soft" : "border-border hover:border-accent/50",
                )}
              >
                <Icon className={cn("h-5 w-5", data.locationKind === id ? "text-accent" : "text-muted")} aria-hidden />
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted">{hint}</span>
              </button>
            ))}
          </div>
          {data.locationKind === "custom" && (
            <Field label="Meeting link or address" className="mt-4">
              <input
                className={inputClass}
                value={data.locationValue}
                placeholder="https://zoom.us/j/…"
                onChange={(e) => set("locationValue", e.target.value)}
              />
            </Field>
          )}
        </Card>

        <Card
          title="Questions"
          description="Name and email are always asked. Add up to 10 more."
          actions={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={data.questions.length >= 10}
              onClick={() =>
                set("questions", [
                  ...data.questions,
                  { id: `q_${Math.random().toString(36).slice(2, 8)}`, label: "", type: "text", required: false },
                ])
              }
            >
              <Plus className="h-4 w-4" aria-hidden /> Add question
            </Button>
          }
        >
          {data.questions.length === 0 ? (
            <p className="text-sm text-muted">No extra questions. Try &ldquo;What&apos;s your budget?&rdquo; or &ldquo;Company website&rdquo;.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {data.questions.map((q, i) => (
                <li key={q.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      aria-label={`Question ${i + 1}`}
                      className={cn(inputClass, "flex-1")}
                      placeholder="Question"
                      value={q.label}
                      maxLength={200}
                      onChange={(e) => setQuestion(i, { label: e.target.value })}
                    />
                    <select
                      aria-label="Answer type"
                      className={cn(inputClass, "sm:w-40")}
                      value={q.type}
                      onChange={(e) => setQuestion(i, { type: e.target.value as Question["type"] })}
                    >
                      <option value="text">Short answer</option>
                      <option value="textarea">Paragraph</option>
                      <option value="select">Dropdown</option>
                    </select>
                  </div>
                  {q.type === "select" && (
                    <input
                      aria-label="Dropdown options"
                      className={cn(inputClass, "mt-3")}
                      placeholder="Options, separated by commas"
                      value={(q.options ?? []).join(", ")}
                      onChange={(e) => setQuestion(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                    />
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-muted">
                      <Switch checked={q.required} onChange={(v) => setQuestion(i, { required: v })} label="Required" />
                      Required
                    </label>
                    <div className="flex gap-1">
                      <IconButton label="Move up" disabled={i === 0} onClick={() => moveQuestion(i, -1)}><ArrowUp className="h-4 w-4" /></IconButton>
                      <IconButton label="Move down" disabled={i === data.questions.length - 1} onClick={() => moveQuestion(i, 1)}><ArrowDown className="h-4 w-4" /></IconButton>
                      <IconButton label="Remove question" onClick={() => set("questions", data.questions.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></IconButton>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card title="Scheduling rules" description="Protect your day with gaps, notice and limits.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Buffer before" hint="Free time kept before each meeting">
              <MinutesSelect value={data.bufferBeforeMin} onChange={(v) => set("bufferBeforeMin", v)} options={[0, 5, 10, 15, 30, 60]} />
            </Field>
            <Field label="Buffer after" hint="Free time kept after each meeting">
              <MinutesSelect value={data.bufferAfterMin} onChange={(v) => set("bufferAfterMin", v)} options={[0, 5, 10, 15, 30, 60]} />
            </Field>
            <Field label="Minimum notice" hint="How soon someone can book">
              <select className={inputClass} value={data.minNoticeMin} onChange={(e) => set("minNoticeMin", Number(e.target.value))}>
                {NOTICE.concat(NOTICE.some((n) => n.value === data.minNoticeMin) ? [] : [{ value: data.minNoticeMin, label: `${data.minNoticeMin} min` }]).map((n) => (
                  <option key={n.value} value={n.value}>{n.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Booking window" hint="How far ahead people can book">
              <select className={inputClass} value={data.maxDaysAhead} onChange={(e) => set("maxDaysAhead", Number(e.target.value))}>
                {[7, 14, 30, 60, 90, 180].concat([7, 14, 30, 60, 90, 180].includes(data.maxDaysAhead) ? [] : [data.maxDaysAhead]).map((d) => (
                  <option key={d} value={d}>{d} days</option>
                ))}
              </select>
            </Field>
            <Field label="Start times every" hint="Spacing between offered times">
              <MinutesSelect value={data.slotIntervalMin} onChange={(v) => set("slotIntervalMin", v)} options={[10, 15, 20, 30, 45, 60]} />
            </Field>
            <Field label="Daily limit" hint="Most bookings of this type per day">
              <select
                className={inputClass}
                value={data.dailyLimit ?? ""}
                onChange={(e) => set("dailyLimit", e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">No limit</option>
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                  <option key={n} value={n}>{n} per day</option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        {!isNew && (
          <DeleteZone
            onDelete={async () => {
              const r = await deleteEventType(initial.id!);
              if (!r.ok) return r.error;
              router.replace("/dashboard/event-types");
              return null;
            }}
          />
        )}
      </div>

      {/* Preview + save */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-card border border-border bg-surface p-5">
          <p className="mb-3 text-xs uppercase tracking-wide text-muted">Preview</p>
          <h3 className="text-lg font-semibold">{data.title || "Untitled"}</h3>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted"><Clock className="h-4 w-4" aria-hidden />{data.durationMin} min</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            {React.createElement(LOCATIONS.find((l) => l.id === data.locationKind)!.icon, { className: "h-4 w-4", "aria-hidden": true })}
            {LOCATIONS.find((l) => l.id === data.locationKind)!.label}
          </p>
          {data.description && <p className="mt-3 line-clamp-4 text-sm text-muted">{data.description}</p>}
        </div>
        <div className="flex items-center justify-between rounded-card border border-border bg-surface p-4">
          <span className="text-sm">Bookable</span>
          <Switch checked={data.isActive} onChange={(v) => set("isActive", v)} label="Bookable" />
        </div>
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />}
          {isNew ? "Create meeting type" : "Save changes"}
        </Button>
        <SaveStatus state={status} />
      </aside>
    </form>
  );
}

function MinutesSelect({ value, onChange, options }: { value: number; onChange: (v: number) => void; options: number[] }) {
  const all = options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {all.map((m) => (
        <option key={m} value={m}>{m === 0 ? "None" : `${m} min`}</option>
      ))}
    </select>
  );
}

function IconButton({ label, children, ...props }: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" aria-label={label} title={label} className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-30" {...props}>
      {children}
    </button>
  );
}

function DeleteZone({ onDelete }: { onDelete: () => Promise<string | null> }) {
  const [confirm, setConfirm] = React.useState(false);
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger/30 p-5">
      <div>
        <p className="font-medium">Delete meeting type</p>
        <p className="text-sm text-muted">Only possible when it has no bookings. Otherwise switch it off.</p>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </div>
      {confirm ? (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-danger"
            disabled={pending}
            onClick={() => startTransition(async () => setError((await onDelete()) ?? ""))}
          >
            Delete
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirm(false)}>Keep</Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="secondary" onClick={() => setConfirm(true)}>
          <Trash2 className="h-4 w-4" aria-hidden /> Delete
        </Button>
      )}
    </div>
  );
}
