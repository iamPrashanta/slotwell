"use client";

import * as React from "react";
import Link from "next/link";
import { Clock, ExternalLink, Link2, Phone, Video } from "lucide-react";
import { setEventTypeActive } from "@/app/dashboard/actions";
import { Switch } from "@/components/ui/form";
import { CopyButton } from "./copy-button";
import { ShareMenu } from "@/components/ui/share-menu";
import { cn } from "@/lib/utils";

const LOCATION = { google_meet: { icon: Video, label: "Google Meet" }, phone: { icon: Phone, label: "Phone" }, custom: { icon: Link2, label: "Custom" } };

export function EventTypeRow({
  event,
  url,
}: {
  event: { id: string; title: string; slug: string; durationMin: number; locationKind: keyof typeof LOCATION; isActive: boolean };
  url: string;
}) {
  const [active, setActive] = React.useState(event.isActive);
  const [pending, startTransition] = React.useTransition();
  const Location = LOCATION[event.locationKind];

  return (
    <li className={cn("flex flex-wrap items-center gap-4 rounded-card border border-border bg-surface p-4 md:p-5", !active && "opacity-60")}>
      <span className="h-10 w-1 rounded-full bg-accent" aria-hidden />
      <div className="min-w-0 flex-1">
        <Link href={`/dashboard/event-types/${event.id}`} className="font-medium hover:text-accent">
          {event.title}
        </Link>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{event.durationMin} min</span>
          <span className="inline-flex items-center gap-1"><Location.icon className="h-3.5 w-3.5" aria-hidden />{Location.label}</span>
          <span className="truncate">/{event.slug}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <CopyButton value={url} />
        <ShareMenu
          size="icon"
          align="right"
          label={`Share ${event.title} booking link`}
          title={event.title}
          text={`Book a time with me: ${event.title} (${event.durationMin} min)`}
          url={url}
        />
        <a href={url} target="_blank" rel="noopener" aria-label={`Open ${event.title} booking page`} className="rounded-full border border-border p-2 hover:border-accent/60">
          <ExternalLink className="h-4 w-4" aria-hidden />
        </a>
        <Switch
          checked={active}
          disabled={pending}
          label={active ? `Turn off ${event.title}` : `Turn on ${event.title}`}
          onChange={(value) => {
            setActive(value);
            startTransition(async () => {
              const r = await setEventTypeActive(event.id, value);
              if (!r.ok) setActive(!value);
            });
          }}
        />
      </div>
    </li>
  );
}
