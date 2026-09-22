// Dependency-free time-zone helpers built on Intl. All instants are epoch milliseconds (UTC).

export interface LocalDate {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
}

export interface LocalDateTime extends LocalDate {
  hour: number;
  minute: number;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** True if the IANA time zone name is known to the runtime. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock date and time of an instant in a time zone. */
export function toLocal(instant: number, timeZone: string): LocalDateTime & { second: number } {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(instant))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Offset of the zone from UTC at an instant, in milliseconds (e.g. +19_800_000 for India). */
export function zoneOffset(instant: number, timeZone: string): number {
  const local = toLocal(instant, timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return asUtc - (instant - (instant % 1000));
}

/**
 * Converts a wall-clock time in a zone to an instant.
 * Returns null when that wall time does not exist (skipped by a daylight-saving jump).
 * For repeated wall times (clocks going back) the earlier instant is returned.
 */
export function fromLocal(local: LocalDateTime, timeZone: string): number | null {
  const wall = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
  const candidates = new Set<number>();
  for (const probe of [wall - DAY, wall, wall + DAY]) {
    candidates.add(wall - zoneOffset(probe, timeZone));
  }
  const matches = [...candidates]
    .filter((instant) => {
      const back = toLocal(instant, timeZone);
      return (
        back.year === local.year &&
        back.month === local.month &&
        back.day === local.day &&
        back.hour === local.hour &&
        back.minute === local.minute
      );
    })
    .sort((a, b) => a - b);
  return matches[0] ?? null;
}

/** Calendar date of an instant in a zone. */
export function localDateOf(instant: number, timeZone: string): LocalDate {
  const { year, month, day } = toLocal(instant, timeZone);
  return { year, month, day };
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: LocalDate): number {
  const day = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

/** "2026-09-17" */
export function formatDate(date: LocalDate): string {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

/** Parses "2026-09-17"; returns null for anything else. */
export function parseDate(value: string): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const check = addDays(date, 0);
  return compareDates(check, date) === 0 ? date : null;
}

/** Parses "HH:MM" or "HH:MM:SS" into minutes after midnight (24:00 allowed as end of day). */
export function parseTimeOfDay(value: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) return null;
  return hours * 60 + minutes;
}

export { MINUTE, DAY };
