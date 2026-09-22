import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { findSlots } from "@/server/availability";
import { getEventType, getOwnerByUsername } from "@/server/data";
import { CalendarNotConnectedError } from "@/server/google-calendar";
import { isValidTimeZone } from "@/lib/availability/time";
import { clientIp, rateLimit } from "@/server/rate-limit";

const MAX_RANGE_DAYS = 42;

const query = z.object({
  user: z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}$/i),
  event: z.string().regex(/^[a-z0-9][a-z0-9-]{0,48}$/i),
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
  tz: z.string().max(64).refine(isValidTimeZone, "Unknown time zone").optional(),
});

/**
 * GET /api/slots?user=iamprashanta&event=30min&from=2026-09-01T00:00:00Z&to=2026-10-01T00:00:00Z
 * Returns free slots as UTC ISO strings. The browser formats them in the guest's zone.
 */
export async function GET(request: NextRequest) {
  if (!rateLimit(`slots:${clientIp(request.headers)}`, 60, 60_000).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { user, event, from, to } = parsed.data;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (toDate <= fromDate || toDate.getTime() - fromDate.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    return NextResponse.json({ error: `Range must be between 1 minute and ${MAX_RANGE_DAYS} days` }, { status: 400 });
  }

  const owner = await getOwnerByUsername(user);
  const eventType = owner ? await getEventType(owner.ownerId, event) : null;
  if (!owner || !eventType) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const slots = await findSlots(owner, eventType, fromDate, toDate);
    return NextResponse.json(
      {
        ownerTimeZone: owner.timeZone,
        durationMin: eventType.durationMin,
        slots: slots.map((slot) => ({ start: new Date(slot.start).toISOString(), end: new Date(slot.end).toISOString() })),
      },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch (error) {
    if (error instanceof CalendarNotConnectedError) {
      return NextResponse.json({ error: "Booking is temporarily unavailable" }, { status: 503 });
    }
    console.error("slots failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not load availability" }, { status: 502 });
  }
}
