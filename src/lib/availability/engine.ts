// Slotwell availability engine: turns working hours, overrides and busy times into bookable slots.
// Pure and dependency-free so it can be unit-tested with `npm test`.

import {
  MINUTE,
  addDays,
  compareDates,
  formatDate,
  fromLocal,
  isoWeekday,
  localDateOf,
  parseTimeOfDay,
  type LocalDate,
} from "./time.ts";

export interface WeeklyRule {
  /** 1 = Monday … 7 = Sunday */
  weekday: number;
  /** "HH:MM" in the owner's time zone */
  start: string;
  end: string;
}

export interface DateOverride {
  /** "YYYY-MM-DD" in the owner's time zone */
  date: string;
  /** true = no availability that day; otherwise `start`/`end` replace the weekly rules */
  unavailable: boolean;
  start?: string;
  end?: string;
}

export interface EventRules {
  durationMin: number;
  slotIntervalMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
  dailyLimit?: number | null;
}

export interface Interval {
  start: number; // epoch ms
  end: number; // epoch ms
}

export interface AvailabilityInput {
  ownerTimeZone: string;
  rules: WeeklyRule[];
  overrides: DateOverride[];
  event: EventRules;
  /** Busy periods from calendars. Buffers of the event being booked are applied around them. */
  calendarBusy: Interval[];
  /** Existing confirmed bookings, already including their own buffers (the `blocked` range). */
  blockedByBookings: Interval[];
  /** Confirmed bookings per owner-local date ("YYYY-MM-DD" → count), for the daily limit. */
  bookingsPerDay?: Record<string, number>;
  /** Requested window (epoch ms). */
  from: number;
  to: number;
  now: number;
}

export interface Slot {
  start: number;
  end: number;
}

interface MinuteRange {
  start: number; // minutes after local midnight
  end: number;
}

function windowsForDate(date: LocalDate, rules: WeeklyRule[], overridesByDate: Map<string, DateOverride[]>): MinuteRange[] {
  const overrides = overridesByDate.get(formatDate(date));
  const source = overrides
    ? overrides.some((o) => o.unavailable)
      ? []
      : overrides.map((o) => ({ start: o.start ?? "", end: o.end ?? "" }))
    : rules.filter((rule) => rule.weekday === isoWeekday(date));

  const ranges: MinuteRange[] = [];
  for (const item of source) {
    const start = parseTimeOfDay(item.start);
    const end = parseTimeOfDay(item.end);
    if (start !== null && end !== null && start < end) ranges.push({ start, end });
  }
  return mergeRanges(ranges);
}

function mergeRanges(ranges: MinuteRange[]): MinuteRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: MinuteRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

function localInstant(date: LocalDate, minutesAfterMidnight: number, timeZone: string): number | null {
  const day = addDays(date, Math.floor(minutesAfterMidnight / 1440));
  const minutes = minutesAfterMidnight % 1440;
  return fromLocal({ ...day, hour: Math.floor(minutes / 60), minute: minutes % 60 }, timeZone);
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Returns bookable slots, sorted by start time, within [from, to). */
export function computeSlots(input: AvailabilityInput): Slot[] {
  const { ownerTimeZone: zone, event } = input;
  const duration = event.durationMin * MINUTE;
  const step = Math.max(event.slotIntervalMin, 1);
  const earliest = Math.max(input.from, input.now + event.minNoticeMin * MINUTE);
  const latest = Math.min(input.to, input.now + event.maxDaysAhead * 24 * 60 * MINUTE);
  if (earliest >= latest) return [];

  const overridesByDate = new Map<string, DateOverride[]>();
  for (const override of input.overrides) {
    const list = overridesByDate.get(override.date) ?? [];
    list.push(override);
    overridesByDate.set(override.date, list);
  }

  // Calendar busy times are widened by this event's buffers so the new meeting keeps its gaps.
  const calendarBusy: Interval[] = input.calendarBusy.map((b) => ({
    start: b.start - event.bufferAfterMin * MINUTE,
    end: b.end + event.bufferBeforeMin * MINUTE,
  }));

  const slots: Slot[] = [];
  const lastDate = localDateOf(latest, zone);
  // Start one day early so windows that began the previous local day are covered.
  for (let date = addDays(localDateOf(earliest, zone), -1); compareDates(date, lastDate) <= 0; date = addDays(date, 1)) {
    const dateKey = formatDate(date);
    const limit = event.dailyLimit ?? null;
    if (limit !== null && (input.bookingsPerDay?.[dateKey] ?? 0) >= limit) continue;

    for (const window of windowsForDate(date, input.rules, overridesByDate)) {
      for (let minute = window.start; minute + event.durationMin <= window.end; minute += step) {
        const start = localInstant(date, minute, zone);
        if (start === null) continue; // wall time skipped by daylight saving
        const end = start + duration;
        if (start < earliest || start >= latest) continue;

        // Existing bookings already carry their buffers; the new meeting needs its own around it.
        const needed = { start: start - event.bufferBeforeMin * MINUTE, end: end + event.bufferAfterMin * MINUTE };
        if (input.blockedByBookings.some((b) => overlaps(needed, b))) continue;
        if (calendarBusy.some((b) => overlaps({ start, end }, b))) continue;

        slots.push({ start, end });
      }
    }
  }

  // Deduplicate (overlapping windows) and sort.
  const unique = new Map<number, Slot>();
  for (const slot of slots) unique.set(slot.start, slot);
  return [...unique.values()].sort((a, b) => a.start - b.start);
}
