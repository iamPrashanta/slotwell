import { NextResponse } from "next/server";
import { cancelBookingSchema } from "@/lib/booking-schema";
import { BookingError, cancelBooking } from "@/server/bookings";
import { clientIp, rateLimit } from "@/server/rate-limit";

/** POST /api/bookings/{token}/cancel — guest cancellation from the manage link. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const limit = rateLimit(`cancel:${clientIp(request.headers)}`, 10, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }
  const { token } = await params;
  const parsed = cancelBookingSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success || token.length < 20 || token.length > 100) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    await cancelBooking(token, parsed.data.reason);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("cancel failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
