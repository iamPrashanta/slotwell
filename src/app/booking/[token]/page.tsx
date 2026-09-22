import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck, CalendarX, Clock, Video } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { CancelForm } from "@/components/booking/cancel-form";
import { formatWhen, getManagedBooking } from "@/server/bookings";

export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false }, referrer: "no-referrer" };

interface Props {
  params: Promise<{ token: string }>;
}

/** Guest's manage page, reached from the link in the confirmation email. */
export default async function ManageBookingPage({ params }: Props) {
  const { token } = await params;
  if (token.length < 20 || token.length > 100) notFound();
  const booking = await getManagedBooking(token);
  if (!booking) notFound();

  const start = new Date(booking.start);
  const end = new Date(booking.end);
  const cancelled = booking.status === "cancelled";
  const canChange = !cancelled && !booking.isPast;
  const bookingPath = `/${booking.owner.username}/${booking.event.slug}`;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-16">
      <div className="rounded-card border border-border bg-surface p-8 animate-fade-up">
        <span
          className={`mb-6 flex h-12 w-12 items-center justify-center rounded-full ${cancelled ? "bg-surface-muted text-muted" : "bg-accent text-accent-foreground"}`}
        >
          {cancelled ? <CalendarX className="h-6 w-6" aria-hidden /> : <CalendarCheck className="h-6 w-6" aria-hidden />}
        </span>
        <h1 className="text-2xl font-semibold">
          {cancelled ? "This booking was cancelled" : booking.isPast ? "This meeting has passed" : "You're booked"}
        </h1>
        <p className="mt-2 text-muted">
          {booking.event.title} with {booking.owner.displayName}
        </p>

        <ul className="mt-6 flex flex-col gap-3 text-sm">
          <li className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
            <span className={cancelled ? "line-through text-muted" : ""}>{formatWhen(start, end, booking.guestTimeZone)}</span>
          </li>
          {booking.locationUrl && !cancelled && (
            <li className="flex items-start gap-3">
              <Video className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
              <a href={booking.locationUrl} target="_blank" rel="noopener noreferrer" className="break-all text-accent hover:underline">
                {booking.locationUrl}
              </a>
            </li>
          )}
        </ul>
        {cancelled && booking.cancelReason && booking.cancelReason !== "Rescheduled" && (
          <p className="mt-4 text-sm text-muted">Reason: {booking.cancelReason}</p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {canChange && (
            <>
              <ButtonLink href={`${bookingPath}?reschedule=${encodeURIComponent(token)}`}>Reschedule</ButtonLink>
              <CancelForm token={token} />
            </>
          )}
          {cancelled && <ButtonLink href={bookingPath}>Book a new time</ButtonLink>}
        </div>
      </div>
      <div className="mt-8 flex justify-center opacity-60">
        <Logo className="scale-90" />
      </div>
    </main>
  );
}
