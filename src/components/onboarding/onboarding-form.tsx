"use client";

import * as React from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { completeOnboarding } from "@/app/onboarding/actions";
import { Field, inputClass } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { groupedTimeZones } from "@/lib/time-zones";

const detectZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const noop = () => () => {};

export function OnboardingForm({ appUrl, initial }: { appUrl: string; initial: { displayName: string; username: string } }) {
  const browserZone = React.useSyncExternalStore(noop, detectZone, () => "UTC");
  const [zone, setZone] = React.useState<string | null>(null);
  const [data, setData] = React.useState(initial);
  const [error, setError] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const groups = React.useMemo(() => groupedTimeZones(), []);
  const timeZone = zone ?? browserZone;

  return (
    <form
      className="mt-8 flex flex-col gap-5 rounded-card border border-border bg-surface p-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        startTransition(async () => {
          const r = await completeOnboarding({ ...data, timeZone });
          if (r && !r.ok) setError(r.error);
        });
      }}
    >
      <Field label="Your name">
        <input className={inputClass} value={data.displayName} maxLength={80} required autoComplete="name"
          onChange={(e) => setData({ ...data, displayName: e.target.value })} />
      </Field>
      <Field label="Your link" hint={<span className="break-all">{appUrl}/<strong className="text-foreground">{data.username || "your-name"}</strong></span>}>
        <input className={inputClass} value={data.username} maxLength={39} required autoCapitalize="none" spellCheck={false}
          onChange={(e) => setData({ ...data, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
      </Field>
      <Field label="Time zone">
        <select className={inputClass} value={timeZone} onChange={(e) => setZone(e.target.value)}>
          {groups.map((g) => (
            <optgroup key={g.region} label={g.region}>
              {g.zones.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}
            </optgroup>
          ))}
        </select>
      </Field>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Create my page <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </form>
  );
}
