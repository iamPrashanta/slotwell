"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { saveProfile } from "@/app/dashboard/actions";
import { Card, Field, SaveStatus, inputClass } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";

export function ProfileForm({ initial, appUrl }: { initial: { displayName: string; username: string; bio: string }; appUrl: string }) {
  const [data, setData] = React.useState(initial);
  const [status, setStatus] = React.useState<{ kind: "idle" | "saved" | "error"; message?: string }>({ kind: "idle" });
  const [pending, startTransition] = React.useTransition();
  const set = (patch: Partial<typeof data>) => {
    setData({ ...data, ...patch });
    setStatus({ kind: "idle" });
  };

  return (
    <Card title="Profile" description="Shown on your booking pages.">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await saveProfile(data);
            setStatus(r.ok ? { kind: "saved" } : { kind: "error", message: r.error });
          });
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name">
            <input className={inputClass} value={data.displayName} maxLength={80} required onChange={(e) => set({ displayName: e.target.value })} />
          </Field>
          <Field label="Username" hint={<span className="break-all">{appUrl}/<strong className="text-foreground">{data.username}</strong></span>}>
            <input
              className={inputClass}
              value={data.username}
              maxLength={39}
              required
              onChange={(e) => set({ username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
            />
          </Field>
        </div>
        <Field label="Short bio" hint="One or two lines under your name.">
          <textarea className={cn(inputClass, "resize-y")} rows={2} maxLength={300} value={data.bio} onChange={(e) => set({ bio: e.target.value })} />
        </Field>
        {data.username !== initial.username && (
          <p className="text-sm text-danger">Changing your username breaks links you&apos;ve already shared (including prashanta.dev&apos;s booking button).</p>
        )}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={pending}>
            {pending && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />} Save profile
          </Button>
          <SaveStatus state={status} />
        </div>
      </form>
    </Card>
  );
}

export function EmbedSnippets({ bookingUrl, embedUrl }: { bookingUrl: string; embedUrl: string }) {
  const [kind, setKind] = React.useState<"link" | "iframe">("link");
  const snippets = {
    link: `<a href="${bookingUrl}">Book a call</a>`,
    iframe: `<iframe src="${embedUrl}?theme=dark" title="Book a call" style="width:100%;border:0;height:720px"></iframe>`,
  };
  return (
    <Card title="Share & embed" description="Add booking to any website. Iframes only work on sites listed in EMBED_ALLOWED_ORIGINS.">
      <div className="mb-3 inline-flex rounded-full border border-border p-1" role="tablist">
        {(["link", "iframe"] as const).map((k) => (
          <button key={k} role="tab" type="button" aria-selected={kind === k} onClick={() => setKind(k)} className={cn("rounded-full px-3 py-1 text-sm", kind === k ? "bg-accent text-accent-foreground" : "text-muted")}>
            {k === "link" ? "Link" : "Inline embed"}
          </button>
        ))}
      </div>
      <pre className="overflow-x-auto rounded-xl border border-border bg-background p-4 font-mono text-xs leading-relaxed text-muted">{snippets[kind]}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton value={snippets[kind]} label="Copy code" />
        <CopyButton value={bookingUrl} label="Copy link" />
      </div>
    </Card>
  );
}
