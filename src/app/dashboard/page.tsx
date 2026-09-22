import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, CircleAlert, Info } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { BookingCard } from "@/components/dashboard/booking-card";
import { requireOwner } from "@/server/session";
import { getGoogleAccount, getOwnerById } from "@/server/data";
import { bookingCounts, listBookings, type BookingTab } from "@/server/dashboard-data";
import { calendarEnabled } from "@/server/google-calendar";
import { GOOGLE_CALENDAR_SCOPES } from "@server/auth.mjs";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bookings", robots: { index: false, follow: false } };

const TABS: { id: BookingTab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
];

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await requireOwner();
  const ownerId = session.user.id;
  const tabParam = (await searchParams).tab;
  const tab: BookingTab = tabParam === "past" || tabParam === "cancelled" ? tabParam : "upcoming";

  const [owner, bookings, counts, google] = await Promise.all([
    getOwnerById(ownerId),
    listBookings(ownerId, tab),
    bookingCounts(ownerId),
    getGoogleAccount(ownerId),
  ]);
  const timeZone = owner?.timeZone ?? "UTC";
  const granted = google?.scope?.split(/[ ,]+/) ?? [];
  const calendarReady = GOOGLE_CALENDAR_SCOPES.every((s) => granted.includes(s));

  // Group by day in the owner's time zone.
  const dayLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone });
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone });
  const todayKey = dayKey.format(new Date());
  const groups = new Map<string, { label: string; items: typeof bookings }>();
  for (const b of bookings) {
    const key = dayKey.format(new Date(b.start));
    const label = key === todayKey ? `Today · ${dayLabel.format(new Date(b.start))}` : dayLabel.format(new Date(b.start));
    const group = groups.get(key) ?? { label, items: [] };
    group.items.push(b);
    groups.set(key, group);
  }

  const stats = [
    { label: "Upcoming", value: counts.upcoming },
    { label: "This week", value: counts.this_week },
    { label: "Completed", value: counts.past },
    { label: "Cancelled", value: counts.cancelled },
  ];

  return (
    <>
      <PageHeader
        title={`Hi ${(owner?.displayName ?? "there").split(" ")[0]}`}
        description={`Times are shown in ${timeZone.replaceAll("_", " ")}.`}
        actions={owner && <ButtonLink href={`/${owner.username}`} target="_blank" variant="secondary" size="sm"><CalendarPlus className="h-4 w-4" aria-hidden /> Booking page</ButtonLink>}
      />

      {!calendarEnabled ? (
        <p className="mb-6 flex items-start gap-3 rounded-card border border-border bg-surface p-4 text-sm text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          Demo mode: Google Calendar is off (CALENDAR_PROVIDER=none). Busy times aren&apos;t checked and no Meet links are created.
        </p>
      ) : (
        !calendarReady && (
          <p className="mb-6 flex items-start gap-3 rounded-card border border-danger/40 bg-surface p-4 text-sm">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
            Google Calendar access is missing. Sign out and sign in with Google again, and allow calendar access.
          </p>
        )
      )}

      <dl className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card border border-border bg-surface p-4">
            <dt className="text-xs uppercase tracking-wide text-muted">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div role="tablist" aria-label="Bookings" className="mb-6 inline-flex rounded-full border border-border bg-surface p-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            href={t.id === "upcoming" ? "/dashboard" : `/dashboard?tab=${t.id}`}
            className={cn("rounded-full px-4 py-1.5 text-sm transition", tab === t.id ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground")}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-border px-6 py-16 text-center">
          <CalendarPlus className="mb-4 h-8 w-8 text-accent" aria-hidden />
          <p className="font-medium">
            {tab === "upcoming" ? "No upcoming bookings yet" : tab === "past" ? "No past meetings" : "No cancellations"}
          </p>
          {tab === "upcoming" && owner && (
            <p className="mt-2 max-w-sm text-sm text-muted">
              Share your link to get booked:{" "}
              <Link href={`/${owner.username}`} className="text-accent hover:underline">/{owner.username}</Link>
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {[...groups.entries()].map(([key, group]) => (
            <section key={key}>
              <h2 className="mb-3 text-sm font-medium text-muted">{group.label}</h2>
              <ul className="flex flex-col gap-2">
                {group.items.map((b) => (
                  <BookingCard key={b.id} booking={b} timeZone={timeZone} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
