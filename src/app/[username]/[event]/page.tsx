import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingWidget } from "@/components/booking/booking-widget";
import { Logo } from "@/components/brand/logo";
import { loadBookingPage, themeParam, topicParam } from "@/server/booking-page";
import { getRescheduleContext } from "@/server/bookings";

interface Props {
  params: Promise<{ username: string; event: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, event } = await params;
  const page = await loadBookingPage(username, event);
  if (!page) return { title: "Not found" };
  return {
    referrer: "no-referrer",
    title: `${page.event.title} with ${page.owner.displayName}`,
    description: `Pick a time for a ${page.event.durationMin}-minute ${page.event.title.toLowerCase()} with ${page.owner.displayName}. Times are shown in your time zone.`,
  };
}

export default async function BookingPage({ params, searchParams }: Props) {
  const { username, event } = await params;
  const query = await searchParams;
  const page = await loadBookingPage(username, event);
  if (!page) notFound();
  const reschedule = await getRescheduleContext(
    typeof query.reschedule === "string" ? query.reschedule : undefined,
    username,
    event,
  );

  return (
    <div data-theme={themeParam(query.theme)} className="flex flex-1 flex-col bg-background text-foreground">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 md:px-6 md:py-16">
        <BookingWidget owner={page.owner} event={page.event} initialTopic={topicParam(query.topic)} reschedule={reschedule} />
        <div className="mt-8 flex justify-center">
          <Link href="/" className="opacity-60 transition hover:opacity-100" aria-label="Slotwell">
            <Logo className="scale-90" />
          </Link>
        </div>
      </main>
    </div>
  );
}
