import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingWidget } from "@/components/booking/booking-widget";
import { loadBookingPage, themeParam, topicParam } from "@/server/booking-page";
import { getRescheduleContext } from "@/server/bookings";

interface Props {
  params: Promise<{ username: string; event: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Chrome-less booking page for iframes on allow-listed sites (see EMBED_ALLOWED_ORIGINS). */
export default async function EmbedBookingPage({ params, searchParams }: Props) {
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
    <div data-theme={themeParam(query.theme)} className="bg-background text-foreground">
      <BookingWidget owner={page.owner} event={page.event} embed initialTopic={topicParam(query.topic)} reschedule={reschedule} />
    </div>
  );
}
