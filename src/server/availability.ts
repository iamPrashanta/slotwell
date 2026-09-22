import "server-only";

import { computeSlots, type Slot } from "@/lib/availability/engine";
import { addDays, formatDate, localDateOf } from "@/lib/availability/time";
import { getBookedRanges, getDateOverrides, getWeeklyRules, type EventType, type OwnerProfile } from "./data";
import { getBusyTimes } from "./google-calendar";

const BUSY_CACHE_MS = 60_000;
const busyCache = new Map<string, { at: number; value: Awaited<ReturnType<typeof getBusyTimes>> }>();

async function cachedBusy(owner: OwnerProfile, from: Date, to: Date, fresh: boolean) {
  const key = `${owner.ownerId}:${from.toISOString()}:${to.toISOString()}`;
  const hit = busyCache.get(key);
  if (!fresh && hit && Date.now() - hit.at < BUSY_CACHE_MS) return hit.value;
  const value = await getBusyTimes(owner.ownerId, owner.busyCalendarIds, from, to);
  busyCache.set(key, { at: Date.now(), value });
  if (busyCache.size > 500) busyCache.delete(busyCache.keys().next().value!);
  return value;
}

/**
 * Bookable slots for an event type in [from, to).
 * `fresh` skips the short calendar cache — use it right before saving a booking.
 * `excludeBookingId` ignores one booking (the one being rescheduled).
 */
export async function findSlots(
  owner: OwnerProfile,
  event: EventType,
  from: Date,
  to: Date,
  { fresh = false, excludeBookingId }: { fresh?: boolean; excludeBookingId?: string } = {},
): Promise<Slot[]> {
  const pad = 24 * 60 * 60 * 1000; // cover windows that start the previous local day
  const fromDate = formatDate(addDays(localDateOf(from.getTime(), owner.timeZone), -1));
  const toDate = formatDate(localDateOf(to.getTime(), owner.timeZone));

  const [rules, overrides, booked, calendarBusy] = await Promise.all([
    getWeeklyRules(owner.ownerId),
    getDateOverrides(owner.ownerId, fromDate, toDate),
    getBookedRanges(owner.ownerId, new Date(from.getTime() - pad), new Date(to.getTime() + pad), owner.timeZone, excludeBookingId),
    cachedBusy(owner, new Date(from.getTime() - pad), new Date(to.getTime() + pad), fresh),
  ]);

  return computeSlots({
    ownerTimeZone: owner.timeZone,
    rules,
    overrides,
    event,
    calendarBusy,
    blockedByBookings: booked.blocked,
    bookingsPerDay: booked.perDay,
    from: from.getTime(),
    to: to.getTime(),
    now: Date.now(),
  });
}
