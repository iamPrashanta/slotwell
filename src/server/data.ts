import "server-only";

import { pool } from "@server/db.mjs";
import type { DateOverride, Interval, WeeklyRule } from "@/lib/availability/engine";

export interface OwnerProfile {
  ownerId: string;
  username: string;
  displayName: string;
  bio: string;
  timeZone: string;
  image: string | null;
  busyCalendarIds: string[];
  bookingCalendarId: string;
}

export interface EventType {
  id: string;
  slug: string;
  title: string;
  description: string;
  durationMin: number;
  locationKind: "google_meet" | "phone" | "custom";
  locationValue: string;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
  slotIntervalMin: number;
  dailyLimit: number | null;
  questions: EventQuestion[];
  isActive: boolean;
}

export interface EventQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  options?: string[];
}

export async function getOwnerByUsername(username: string, opts: { includeBanned?: boolean } = {}): Promise<OwnerProfile | null> {
  const { rows } = await pool.query(
    `SELECT s.owner_id, s.username, s.display_name, s.bio, s.time_zone, s.busy_calendar_ids,
            s.booking_calendar_id, u.name, u.image
       FROM owner_settings s JOIN "user" u ON u.id = s.owner_id
      WHERE s.username = $1 AND (NOT u.banned OR $2)`,
    [username.toLowerCase(), Boolean(opts.includeBanned)],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ownerId: row.owner_id,
    username: row.username,
    displayName: row.display_name || row.name || row.username,
    bio: row.bio,
    timeZone: row.time_zone,
    image: row.image ?? null,
    busyCalendarIds: row.busy_calendar_ids,
    bookingCalendarId: row.booking_calendar_id,
  };
}

export async function getOwnerById(ownerId: string): Promise<OwnerProfile | null> {
  const { rows } = await pool.query("SELECT username FROM owner_settings WHERE owner_id = $1", [ownerId]);
  return rows[0] ? getOwnerByUsername(rows[0].username) : null;
}

function mapEventType(row: Record<string, unknown>): EventType {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: row.description as string,
    durationMin: row.duration_min as number,
    locationKind: row.location_kind as EventType["locationKind"],
    locationValue: row.location_value as string,
    bufferBeforeMin: row.buffer_before_min as number,
    bufferAfterMin: row.buffer_after_min as number,
    minNoticeMin: row.min_notice_min as number,
    maxDaysAhead: row.max_days_ahead as number,
    slotIntervalMin: row.slot_interval_min as number,
    dailyLimit: (row.daily_limit as number | null) ?? null,
    questions: (row.questions as EventQuestion[]) ?? [],
    isActive: row.is_active as boolean,
  };
}

export async function listEventTypes(ownerId: string, { activeOnly = true } = {}): Promise<EventType[]> {
  const { rows } = await pool.query(
    `SELECT * FROM event_types WHERE owner_id = $1 ${activeOnly ? "AND is_active" : ""} ORDER BY position, created_at`,
    [ownerId],
  );
  return rows.map(mapEventType);
}

export async function getEventType(ownerId: string, slug: string): Promise<EventType | null> {
  const { rows } = await pool.query("SELECT * FROM event_types WHERE owner_id = $1 AND slug = $2 AND is_active", [
    ownerId,
    slug.toLowerCase(),
  ]);
  return rows[0] ? mapEventType(rows[0]) : null;
}

export async function getWeeklyRules(ownerId: string): Promise<WeeklyRule[]> {
  const { rows } = await pool.query(
    `SELECT weekday, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS "end"
       FROM availability_rules WHERE owner_id = $1 ORDER BY weekday, start_time`,
    [ownerId],
  );
  return rows.map((r) => ({ weekday: r.weekday, start: r.start, end: r.end === "00:00" ? "24:00" : r.end }));
}

export async function getDateOverrides(ownerId: string, fromDate: string, toDate: string): Promise<DateOverride[]> {
  const { rows } = await pool.query(
    `SELECT to_char(date, 'YYYY-MM-DD') AS date, is_unavailable,
            to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS "end"
       FROM date_overrides WHERE owner_id = $1 AND date BETWEEN $2 AND $3`,
    [ownerId, fromDate, toDate],
  );
  return rows.map((r) => ({ date: r.date, unavailable: r.is_unavailable, start: r.start ?? undefined, end: r.end ?? undefined }));
}

/** Confirmed bookings (with buffers) overlapping [from, to), plus a per-day count in the owner's zone. */
export async function getBookedRanges(
  ownerId: string,
  from: Date,
  to: Date,
  timeZone: string,
  excludeBookingId?: string,
): Promise<{ blocked: Interval[]; perDay: Record<string, number> }> {
  const { rows } = await pool.query(
    `SELECT lower(blocked) AS b_start, upper(blocked) AS b_end,
            to_char(start_at AT TIME ZONE $4, 'YYYY-MM-DD') AS local_date
       FROM bookings
      WHERE owner_id = $1 AND status = 'confirmed' AND blocked && tstzrange($2, $3)
        AND ($5::uuid IS NULL OR id <> $5::uuid)`,
    [ownerId, from.toISOString(), to.toISOString(), timeZone, excludeBookingId ?? null],
  );
  const perDay: Record<string, number> = {};
  for (const row of rows) perDay[row.local_date] = (perDay[row.local_date] ?? 0) + 1;
  return {
    blocked: rows.map((r) => ({ start: new Date(r.b_start).getTime(), end: new Date(r.b_end).getTime() })),
    perDay,
  };
}

/** Event type by slug, active or not (owner-side use). */
export async function getEventTypeAnyState(ownerId: string, slug: string): Promise<EventType | null> {
  const { rows } = await pool.query("SELECT * FROM event_types WHERE owner_id = $1 AND slug = $2", [ownerId, slug.toLowerCase()]);
  return rows[0] ? mapEventType(rows[0]) : null;
}

export async function getEventTypeById(ownerId: string, id: string): Promise<EventType | null> {
  const { rows } = await pool.query("SELECT * FROM event_types WHERE owner_id = $1 AND id = $2", [ownerId, id]);
  return rows[0] ? mapEventType(rows[0]) : null;
}

/** Whether the owner has connected Google (and which account). */
export async function getGoogleAccount(ownerId: string): Promise<{ id: string; scope: string | null } | null> {
  const { rows } = await pool.query(
    `SELECT id, scope FROM account WHERE "userId" = $1 AND "providerId" = 'google' ORDER BY "updatedAt" DESC LIMIT 1`,
    [ownerId],
  );
  return rows[0] ? { id: rows[0].id, scope: rows[0].scope ?? null } : null;
}

/** The owner's sign-in email (where booking notifications go). */
export async function getOwnerEmail(ownerId: string): Promise<string | null> {
  const { rows } = await pool.query(`SELECT email FROM "user" WHERE id = $1`, [ownerId]);
  return rows[0]?.email ?? null;
}
