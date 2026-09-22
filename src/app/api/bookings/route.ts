import { NextResponse } from "next/server";
import { createBookingSchema } from "@/lib/booking-schema";
import { BookingError, createBooking } from "@/server/bookings";
import { clientIp, rateLimit } from "@/server/rate-limit";

/** POST /api/bookings — create a booking, or move one when `rescheduleToken` is given. */
export async function POST(request: Request) {
  const limit = rateLimit(`book:${clientIp(request.headers)}`, 5, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many booking attempts. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check your details and try again." }, { status: 400 });
  }

  // Honeypot filled in: pretend it worked so bots learn nothing.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  try {
    const booking = await createBooking(parsed.data);
    return NextResponse.json(
      { ok: true, start: booking.start, end: booking.end, locationUrl: booking.locationUrl, manageUrl: booking.manageUrl },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("booking failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
