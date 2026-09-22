"use client";

import * as React from "react";
import { ChevronDown, CircleAlert, LoaderCircle, RefreshCw, TriangleAlert, Video, XCircle } from "lucide-react";
import { cancelBookingByOwner, retryBookingSync } from "@/app/dashboard/actions";
import type { DashboardBooking } from "@/server/dashboard-data";
import { Button } from "@/components/ui/button";
import { ShareMenu } from "@/components/ui/share-menu";
import { cn } from "@/lib/utils";

export function BookingCard({ booking, timeZone }: { booking: DashboardBooking; timeZone: string }) {
  const [open, setOpen] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState("");

  const start = new Date(booking.start);
  const end = new Date(booking.end);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
  const cancelled = booking.status === "cancelled";
  const upcoming = booking.isUpcoming;
  const shareText = (() => {
    const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone }).format(start);
    const endLabel = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZoneName: "short", timeZone }).format(end);
    return [
      `You're invited: ${booking.eventTitle}`,
      `${day}, ${time.format(start)}–${endLabel}`,
      booking.locationUrl ? `Join: ${booking.locationUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  })();
  const initials = booking.guestName.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <li className={cn("rounded-card border border-border bg-surface transition", open && "ring-1 ring-accent/30")}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-4 text-left md:p-5"
      >
        <div className="w-20 shrink-0 text-sm">
          <p className={cn("font-medium", cancelled && "line-through text-muted")}>{time.format(start)}</p>
          <p className="text-muted">{time.format(end)}</p>
        </div>
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-medium text-accent sm:flex">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {booking.guestName}
            {booking.rescheduled && <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-normal text-muted">Rescheduled</span>}
          </p>
          <p className="truncate text-sm text-muted">{booking.eventTitle} · {booking.durationMin} min</p>
          {booking.syncError && (
            <p className="mt-1 flex items-center gap-1 text-xs text-danger">
              <CircleAlert className="h-3 w-3" aria-hidden /> Not in Google Calendar
            </p>
          )}
        </div>
        {upcoming && booking.locationUrl && (
          <a
            href={booking.locationUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent/60 sm:inline-flex"
          >
            <Video className="h-4 w-4 text-accent" aria-hidden /> Join
          </a>
        )}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-5 pt-4 text-sm animate-fade-up md:px-5">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Detail label="Email"><a href={`mailto:${booking.guestEmail}`} className="text-accent hover:underline">{booking.guestEmail}</a></Detail>
            <Detail label="Guest's time zone">
              {booking.guestTimeZone.replaceAll("_", " ")} ·{" "}
              {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: booking.guestTimeZone }).format(start)} for them
            </Detail>
            {booking.locationUrl && (
              <Detail label="Meeting link">
                <a href={booking.locationUrl} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">{booking.locationUrl}</a>
              </Detail>
            )}
            {booking.notes && <Detail label="Notes" wide>{booking.notes}</Detail>}
            {booking.answers.map((a) => (
              <Detail key={a.label} label={a.label} wide>{a.value}</Detail>
            ))}
            {cancelled && booking.cancelReason && <Detail label="Cancellation reason" wide>{booking.cancelReason}</Detail>}
            {booking.syncError && <Detail label="Google Calendar error" wide><span className="text-danger">{booking.syncError}</span></Detail>}
          </dl>

          {upcoming && !confirmCancel && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <ShareMenu title={booking.eventTitle} text={shareText} url={booking.locationUrl} label="Share invite" />
              {booking.syncError && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await retryBookingSync(booking.id);
                      setError(r.ok ? "" : r.error);
                    })
                  }
                >
                  <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} aria-hidden /> Retry Google sync
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)} className="ml-auto">
                <XCircle className="h-4 w-4" aria-hidden /> Cancel booking
              </Button>
            </div>
          )}

          {upcoming && confirmCancel && (
            <form
              className="mt-5 rounded-2xl border border-danger/30 bg-danger/5 p-4 animate-fade-up"
              onSubmit={(e) => {
                e.preventDefault();
                const reason = String(new FormData(e.currentTarget).get("reason") ?? "");
                startTransition(async () => {
                  const r = await cancelBookingByOwner(booking.id, reason);
                  setError(r.ok ? "" : r.error);
                  if (r.ok) setConfirmCancel(false);
                });
              }}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger">
                  <TriangleAlert className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">Cancel this booking?</p>
                  <p className="mt-0.5 text-muted">
                    {booking.guestName} gets an email and the calendar invite is removed. This can&apos;t be undone.
                  </p>
                </div>
              </div>
              <label className="mt-4 block">
                <span className="sr-only">Message to the guest</span>
                <textarea
                  name="reason"
                  rows={2}
                  maxLength={500}
                  autoFocus
                  placeholder="Add a message for the guest (optional)"
                  className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 outline-none transition focus:border-danger/60"
                />
              </label>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => setConfirmCancel(false)}>
                  Keep booking
                </Button>
                <Button type="submit" variant="dangerSolid" size="sm" disabled={pending}>
                  {pending ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <XCircle className="h-4 w-4" aria-hidden />}
                  Cancel &amp; notify guest
                </Button>
              </div>
            </form>
          )}
          {error && <p role="alert" className="mt-3 text-danger">{error}</p>}
        </div>
      )}
    </li>
  );
}

function Detail({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words">{children}</dd>
    </div>
  );
}
