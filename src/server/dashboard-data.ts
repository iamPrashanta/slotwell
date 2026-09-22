import "server-only";

import { pool } from "@server/db.mjs";

export type BookingTab = "upcoming" | "past" | "cancelled";

export interface DashboardBooking {
  id: string;
  start: string;
  end: string;
  status: "confirmed" | "cancelled";
  guestName: string;
  guestEmail: string;
  guestTimeZone: string;
  notes: string;
  answers: { label: string; value: string }[];
  eventTitle: string;
  durationMin: number;
  locationUrl: string | null;
  syncError: string | null;
  cancelReason: string | null;
  rescheduled: boolean;
  /** Confirmed and not yet over (computed on the server). */
  isUpcoming: boolean;
}

export async function listBookings(ownerId: string, tab: BookingTab, limit = 100): Promise<DashboardBooking[]> {
  const where =
    tab === "upcoming"
      ? "b.status = 'confirmed' AND b.end_at > now()"
      : tab === "past"
        ? "b.status = 'confirmed' AND b.end_at <= now()"
        : "b.status = 'cancelled' AND coalesce(b.cancel_reason, '') <> 'Rescheduled'";
  const order = tab === "upcoming" ? "b.start_at ASC" : "b.start_at DESC";
  const { rows } = await pool.query(
    `SELECT b.id, b.start_at, b.end_at, b.status, b.guest_name, b.guest_email, b.guest_time_zone, b.notes, b.answers,
            b.location_url, b.sync_error, b.cancel_reason, b.rescheduled_from_id, e.title, e.duration_min, e.questions
       FROM bookings b JOIN event_types e ON e.id = b.event_type_id
      WHERE b.owner_id = $1 AND ${where}
      ORDER BY ${order} LIMIT $2`,
    [ownerId, limit],
  );
  return rows.map((r) => {
    const questions = (r.questions ?? []) as { id: string; label: string }[];
    const answers = Object.entries((r.answers ?? {}) as Record<string, string>).map(([id, value]) => ({
      label: questions.find((q) => q.id === id)?.label ?? id,
      value,
    }));
    return {
      id: r.id,
      start: new Date(r.start_at).toISOString(),
      end: new Date(r.end_at).toISOString(),
      status: r.status,
      guestName: r.guest_name,
      guestEmail: r.guest_email,
      guestTimeZone: r.guest_time_zone,
      notes: r.notes,
      answers,
      eventTitle: r.title,
      durationMin: r.duration_min,
      locationUrl: r.location_url,
      syncError: r.sync_error,
      cancelReason: r.cancel_reason,
      rescheduled: Boolean(r.rescheduled_from_id),
      isUpcoming: r.status === "confirmed" && new Date(r.end_at).getTime() > Date.now(),
    };
  });
}

export async function bookingCounts(ownerId: string) {
  const { rows } = await pool.query(
    `SELECT
       count(*) FILTER (WHERE status = 'confirmed' AND end_at > now())::int AS upcoming,
       count(*) FILTER (WHERE status = 'confirmed' AND start_at >= date_trunc('week', now()) AND start_at < date_trunc('week', now()) + interval '7 days')::int AS this_week,
       count(*) FILTER (WHERE status = 'confirmed' AND end_at <= now())::int AS past,
       count(*) FILTER (WHERE status = 'cancelled' AND coalesce(cancel_reason, '') <> 'Rescheduled')::int AS cancelled
     FROM bookings WHERE owner_id = $1`,
    [ownerId],
  );
  return rows[0] as { upcoming: number; this_week: number; past: number; cancelled: number };
}

export async function listDateOverrides(ownerId: string) {
  const { rows } = await pool.query(
    `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, is_unavailable,
            to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS "end"
       FROM date_overrides WHERE owner_id = $1 AND date >= current_date - 1 ORDER BY date, start_time`,
    [ownerId],
  );
  return rows.map((r) => ({ id: r.id as string, date: r.date as string, unavailable: r.is_unavailable as boolean, start: r.start as string | null, end: r.end as string | null }));
}
